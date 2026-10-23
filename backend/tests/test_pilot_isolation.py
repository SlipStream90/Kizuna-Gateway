"""PostgreSQL-only trust-boundary integration coverage.

Set PILOT_TEST_DATABASE_URL to a disposable PostgreSQL 18 database after
applying migrations 001 and 002.  The suite intentionally skips rather than
pretending in-memory tests exercise RLS.
"""

import os

import pytest

pytestmark = pytest.mark.skipif(
    not os.getenv("PILOT_TEST_DATABASE_URL"),
    reason="requires disposable PostgreSQL 18 app-role database (PILOT_TEST_DATABASE_URL)",
)


def test_integration_environment_is_explicit():
    """Protect against accidentally running tenant tests against a developer DB."""
    assert os.environ["PILOT_TEST_DATABASE_URL"].startswith(("postgresql://", "postgres://"))


@pytest.mark.parametrize(
    "scenario, expected_status",
    [
        ("cross_org_get_patch_report_and_source", 404),
        ("missing_or_invalid_jwt", 401),
        ("insufficient_role_on_write", 403),
        ("stale_if_match_has_no_revision_or_audit_event", 409),
    ],
)
def test_required_authorization_scenarios_are_documented_for_real_postgres(scenario, expected_status):
    """Placeholder guard until CI provides the app-role JWT/fixture harness.

    This is deliberately not a mock: the actual assertions must run against
    PostgreSQL because only it can prove RLS behavior.
    """
    pytest.fail(f"Integration fixture harness missing for {scenario}: expected HTTP {expected_status}")


def test_corpus_abstention_and_replay_contracts_need_real_fixture_data():
    """Ensure future fixture work includes the non-negotiable corpus/replay cases."""
    pytest.fail(
        "Add approved/expired/unapproved source fixtures and assert abstention has no citations; "
        "add a revision snapshot fixture and assert decimal strings, version labels, and passage hashes replay exactly."
    )
