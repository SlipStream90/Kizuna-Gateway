"""PostgreSQL-only trust-boundary integration coverage.

Set PILOT_TEST_DATABASE_URL to a disposable PostgreSQL 18 database after
applying migrations 001 and 002.  The suite intentionally skips rather than
pretending in-memory tests exercise RLS.
"""

import os
from uuid import uuid4

import pytest
connect = pytest.importorskip('psycopg').connect

pytestmark = pytest.mark.skipif(
    not os.getenv("PILOT_TEST_DATABASE_URL"),
    reason="requires disposable PostgreSQL 18 app-role database (PILOT_TEST_DATABASE_URL)",
)


def test_integration_environment_is_explicit():
    """Protect against accidentally running tenant tests against a developer DB."""
    assert os.environ["PILOT_TEST_DATABASE_URL"].startswith(("postgresql://", "postgres://"))


def test_app_role_is_non_owner_non_bypassrls():
    """CI connects with the real application role, not the migration owner."""
    with connect(os.environ['PILOT_TEST_DATABASE_URL']) as conn:
        bypass, owner = conn.execute("""SELECT r.rolbypassrls,
          EXISTS(SELECT 1 FROM pg_class c WHERE c.relname='assessments' AND c.relowner = r.oid)
          FROM pg_roles r WHERE r.rolname=current_user""").fetchone()
    assert bypass is False and owner is False


def test_direct_sql_rls_hides_cross_tenant_rows():
    """An app-role session can only read the transaction-local organization."""
    one, two, actor = uuid4(), uuid4(), uuid4()
    with connect(os.environ['PILOT_TEST_DATABASE_URL']) as conn:
        for org in (one, two):
            conn.execute("SELECT set_config('app.org_id', %s, false)", (str(org),))
            conn.execute("INSERT INTO organizations(id,name) VALUES(%s,%s)", (org, str(org)))
            conn.execute("INSERT INTO assessments(org_id,created_by,payload) VALUES(%s,%s,'{}')", (org, actor))
        conn.execute("SELECT set_config('app.org_id', %s, false)", (str(one),))
        assert conn.execute("SELECT count(*) FROM assessments").fetchone()[0] == 1


def test_http_assessment_revision_report_and_cross_org_denial(monkeypatch):
    """Exercise the app role through HTTP: create, read, revise, replay, deny."""
    import jwt
    from fastapi.testclient import TestClient
    from app.main import app

    org_one, org_two, actor = uuid4(), uuid4(), uuid4()
    with connect(os.environ['PILOT_TEST_DATABASE_URL']) as conn:
        for org in (org_one, org_two):
            conn.execute("SELECT set_config('app.org_id', %s, false)", (str(org),))
            conn.execute("INSERT INTO organizations(id,name) VALUES(%s,%s)", (org, str(org)))
    def token(org):
        return jwt.encode({'sub': str(actor), 'org_id': str(org), 'roles': ['member'], 'iss': os.environ['OIDC_ISSUER'], 'aud': os.environ['OIDC_AUDIENCE'], 'exp': 4102444800}, os.environ['OIDC_SIGNING_KEY'], algorithm='HS256')
    payload = {'product':'Sensor','sector':'Industrial','buyer':'OEM','budget':'1000.00','horizon_months':12,'modes':['direct'],'hs_code':'9026','jurisdiction':'IN','origin':'JP'}
    with TestClient(app) as client:
        created = client.post('/api/v1/assessments', json=payload, headers={'Authorization': 'Bearer ' + token(org_one)} )
        assert created.status_code == 201
        assessment = created.json()
        assessment_id = assessment['id']
        assert client.get(f'/api/v1/assessments/{assessment_id}', headers={'Authorization': 'Bearer ' + token(org_two)}).status_code == 404
        changed = client.patch(f'/api/v1/assessments/{assessment_id}', json={'buyer':'Updated OEM'}, headers={'Authorization': 'Bearer ' + token(org_one), 'If-Match':'1'})
        assert changed.status_code == 200 and changed.json()['version'] == 2
        assert client.patch(f'/api/v1/assessments/{assessment_id}', json={'buyer':'stale'}, headers={'Authorization': 'Bearer ' + token(org_one), 'If-Match':'1'}).status_code == 409
        report = client.post(f'/api/v1/assessments/{assessment_id}/report', headers={'Authorization': 'Bearer ' + token(org_one)})
        assert report.status_code == 201 and report.json()['assessment_revision'] == 2
        assert client.get(f'/api/v1/assessments/{assessment_id}/report?revision=2', headers={'Authorization': 'Bearer ' + token(org_one)}).json()['id'] == report.json()['id']
