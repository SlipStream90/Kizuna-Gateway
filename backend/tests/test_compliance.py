from app.domain.compliance_search import search_passages
from app.seed.sources import SOURCES
def test_weak_query_uncertain_and_citations_resolve():
 r=search_passages('unrelated phrase',SOURCES);assert r.status=='uncertain' and r.review_required
 r=search_passages('classification origin',SOURCES);assert all(x.citation.source_id in {s.id for s in SOURCES} for x in r.items)
