"""Grounded answer generation: evidence gate, citation enforcement, figure checks, failure modes."""

import json

import pytest
from fastapi.testclient import TestClient

from app.api import compliance
import httpx

from app.rag import answer as answer_module
from app.rag.answer import ANSWER_SCHEMA, GenerationUnavailable, GroqAnswerModel, ModelReply, answer_question
from app.rag.embeddings import HashingEmbedder
from app.schemas.statutes import StatuteAnswerRequest
from tests.test_rag_api import _hit, make_client


class Repo:
    def __init__(self, hits):
        self.hits = hits

    def search(self, vector, model, k, codes, min_similarity):
        return self.hits[:k]


class FakeModel:
    model_name = "openai/gpt-oss-120b"

    def __init__(self, reply: ModelReply | Exception):
        self.reply = reply
        self.calls = []

    def complete(self, system, user):
        self.calls.append((system, user))
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply


def reply(paragraphs, status="answered", stop="end_turn"):
    return ModelReply(stop, json.dumps({"status": status, "paragraphs": paragraphs}), "openai/gpt-oss-120b")


HITS = [_hit("Paragraph 4.2", 0.71, verified=True), _hit("Paragraph 4.1", 0.42)]


def ask(model, hits=HITS, query="FC-GPR deadline?", lang="en"):
    return answer_question(StatuteAnswerRequest(query=query, lang=lang), Repo(hits), HashingEmbedder(), model)


def test_answer_cites_only_retrieved_clauses_and_drops_unsupported_paragraphs():
    model = FakeModel(reply([
        {"text": "Form FC-GPR must be filed within 30 days of the date of issue.", "source_ids": ["S1"]},
        {"text": "An invented claim citing a clause that was never retrieved.", "source_ids": ["S9"]},
        {"text": "Uncited paragraph.", "source_ids": []},
    ]))
    res = ask(model)
    assert res.status == "answered" and res.removed_paragraphs == 2
    assert [p.citations for p in res.answer] == [["RBI-MD-FI/Paragraph 4.2"]]
    assert res.answer[0].figures_verified is True
    assert res.answer[0].badges[0]["label"]["en"] == "[RBI Master Direction (FI), Paragraph 4.2]"
    assert res.citation_index == ["[1] RBI — RBI Master Direction — Foreign Investment in India, Paragraph 4.2 (verified 2026-10-01)"]
    assert [s.clause_reference for s in res.sources] == ["Paragraph 4.2", "Paragraph 4.1"]  # all retrieved
    # The model saw exactly the retrieved clauses, labelled S1..Sk, as quoted material.
    system, user = model.calls[0]
    assert "Use ONLY the clauses inside <sources>" in system
    assert '<source id="S1" citation="RBI-MD-FI/Paragraph 4.2"' in user and 'id="S3"' not in user


def test_figures_not_in_cited_text_are_flagged():
    res = ask(FakeModel(reply([{"text": "Filing is due within 45 days.", "source_ids": ["S1"]}])))
    assert res.answer[0].figures_verified is False


def test_full_width_digits_in_japanese_answers_are_checked():
    ok = ask(FakeModel(reply([{"text": "様式FC-GPRは発行日から３０日以内に提出する必要があります。", "source_ids": ["S1"]}])), lang="ja")
    bad = ask(FakeModel(reply([{"text": "様式FC-GPRは発行日から６０日以内に提出します。", "source_ids": ["S1"]}])), lang="ja")
    assert ok.answer[0].figures_verified is True and bad.answer[0].figures_verified is False
    assert ok.citation_index[0].endswith("パラグラフ4.2（2026-10-01 確認）")


def test_weak_retrieval_never_calls_the_model():
    model = FakeModel(reply([]))
    res = ask(model, hits=[_hit("Paragraph 4.1", 0.05)])
    assert res.status == "insufficient_evidence" and model.calls == [] and res.answer == []
    assert res.sources[0].clause_reference == "Paragraph 4.1" and res.notice.startswith("No ingested clause")


def test_no_model_configured_still_returns_sources():
    res = ask(None)
    assert res.status == "generation_unavailable" and "GROQ_API_KEY" in res.notice and len(res.sources) == 2


@pytest.mark.parametrize("model, status", [
    (FakeModel(ModelReply("refusal", "", "openai/gpt-oss-120b")), "refused"),
    (FakeModel(ModelReply("max_tokens", '{"status": "answ', "openai/gpt-oss-120b")), "generation_unavailable"),
    (FakeModel(ModelReply("end_turn", "not json", "openai/gpt-oss-120b")), "generation_unavailable"),
    (FakeModel(GenerationUnavailable("Could not reach the Anthropic API.")), "generation_unavailable"),
])
def test_failure_modes_keep_sources_and_never_fabricate(model, status):
    res = ask(model)
    assert res.status == status and res.answer == [] and len(res.sources) == 2 and res.notice


def test_model_saying_insufficient_is_respected():
    res = ask(FakeModel(reply([{"text": "The sources cover FC-GPR timing only.", "source_ids": ["S1"]}],
                              status="insufficient_evidence")))
    assert res.status == "insufficient_evidence" and len(res.answer) == 1


def groq(handler):
    return GroqAnswerModel("gsk_test", client=httpx.Client(transport=httpx.MockTransport(handler)))


def completion(content, finish="stop", **message):
    return httpx.Response(200, json={
        "model": "openai/gpt-oss-120b",
        "choices": [{"finish_reason": finish, "message": {"role": "assistant", "content": content, "reasoning": "...", **message}}],
    })


def test_groq_request_shape():
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        seen["auth"] = request.headers["Authorization"]
        seen["body"] = json.loads(request.content)
        return completion('{"status": "answered", "paragraphs": []}')

    out = groq(handler).complete("system prompt", "user prompt")
    body = seen["body"]
    assert seen["url"] == "https://api.groq.com/openai/v1/chat/completions"
    assert seen["auth"] == "Bearer gsk_test"
    assert body["model"] == "openai/gpt-oss-120b"
    assert body["messages"] == [{"role": "system", "content": "system prompt"}, {"role": "user", "content": "user prompt"}]
    assert body["response_format"] == {
        "type": "json_schema", "json_schema": {"name": "grounded_answer", "strict": True, "schema": ANSWER_SCHEMA},
    }
    assert out == ModelReply("stop", '{"status": "answered", "paragraphs": []}', "openai/gpt-oss-120b")  # reasoning ignored


@pytest.mark.parametrize("response, stop", [
    (completion("{}", finish="length"), "max_tokens"),
    (completion("{}", finish="content_filter"), "refusal"),
    (completion(None, refusal="I can't help with that."), "refusal"),
])
def test_groq_finish_reasons_map_to_answer_statuses(response, stop):
    assert groq(lambda request: response).complete("s", "u").stop_reason == stop


@pytest.mark.parametrize("handler, message", [
    (lambda r: httpx.Response(401, json={}), "credentials were rejected"),
    (lambda r: httpx.Response(429, json={}), "rate limit"),
    (lambda r: httpx.Response(503, json={}), "Groq API error 503"),
    (lambda r: httpx.Response(200, text="not json"), "unexpected response"),
])
def test_groq_errors_become_generation_unavailable(handler, message):
    with pytest.raises(GenerationUnavailable, match=message):
        groq(handler).complete("s", "u")


def test_groq_network_failure_is_generation_unavailable():
    def handler(request):
        raise httpx.ConnectError("refused", request=request)

    with pytest.raises(GenerationUnavailable, match="Could not reach"):
        groq(handler).complete("s", "u")


def test_model_is_configured_only_with_a_groq_key(monkeypatch):
    answer_module.get_answer_model.cache_clear()
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    assert answer_module.get_answer_model() is None
    answer_module.get_answer_model.cache_clear()
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test")
    assert isinstance(answer_module.get_answer_model(), GroqAnswerModel)
    answer_module.get_answer_model.cache_clear()


def test_answer_endpoint_wiring():
    client, _ = make_client()
    model = FakeModel(reply([{"text": "Form FC-GPR is filed within 30 days.", "source_ids": ["S1"]}]))
    client.app.dependency_overrides[compliance._answer_model] = lambda: model
    res = client.post("/api/v1/compliance/answer", json={"query": "FC-GPR deadline", "lang": "en"})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "answered" and body["review_required"] is True
    assert body["answer"][0]["citations"] == ["RBI-MD-FI/Paragraph 4.2"]
    assert client.post("/api/v1/compliance/answer", json={"query": "x", "k": 13}).status_code == 422


def test_source_labels_are_not_treated_as_figures():
    res = ask(FakeModel(reply([{"text": "S1 and S2 cover filing only; neither addresses GST.", "source_ids": ["S1", "S2"]}],
                              status="insufficient_evidence")))
    assert res.answer[0].figures_verified is True


def test_groq_rate_limit_retries_once_when_retry_after_is_short():
    calls, slept = [], []

    def handler(request):
        calls.append(1)
        if len(calls) == 1:
            return httpx.Response(429, headers={"retry-after": "2"}, json={})
        return completion('{"status": "answered", "paragraphs": []}')

    model = GroqAnswerModel("gsk_test", client=httpx.Client(transport=httpx.MockTransport(handler)), sleep=slept.append)
    assert model.complete("s", "u").stop_reason == "stop"
    assert len(calls) == 2 and slept == [2.0]


def test_groq_rate_limit_with_long_wait_fails_fast():
    slept = []
    model = GroqAnswerModel("gsk_test", sleep=slept.append, client=httpx.Client(
        transport=httpx.MockTransport(lambda r: httpx.Response(429, headers={"retry-after": "60"}, json={}))))
    with pytest.raises(GenerationUnavailable, match="rate limit"):
        model.complete("s", "u")
    assert slept == []
