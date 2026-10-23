"""Organization-scoped persistence for revisions, citations and report replay."""

import hashlib
import json
from datetime import date
from uuid import UUID

from psycopg.errors import UniqueViolation
from psycopg_pool import ConnectionPool

from app.repositories.database import transaction_for_org
from app.schemas.pilot import (AbstentionReason, Assessment, AssessmentCreate, AssessmentUpdate, Citation,
    ComplianceSearchResult, Principal, ReportSnapshot, SourceVersion, SourceVersionCreate, SourceVersionReview)


class PilotRepository:
    """Repository with explicit organization predicates in every tenant query."""

    def __init__(self, pool: ConnectionPool):
        self.pool = pool

    def create_assessment(self, data: AssessmentCreate, principal: Principal, request_id: str) -> Assessment:
        """Persist an assessment and its first immutable revision."""
        payload = data.model_dump(mode="json")
        with self.pool.connection() as conn, transaction_for_org(conn, principal.org_id):
            row = conn.execute("""INSERT INTO assessments (org_id,created_by,payload)
                VALUES (%s,%s,%s::jsonb) RETURNING id,org_id,created_by,version,payload,updated_at""",
                (principal.org_id, principal.user_id, json.dumps(payload))).fetchone()
            conn.execute("""INSERT INTO assessment_revisions (assessment_id,org_id,version,payload,actor_id)
                VALUES (%s,%s,1,%s::jsonb,%s)""", (row[0], principal.org_id, json.dumps(payload), principal.user_id))
            digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
            conn.execute("""INSERT INTO audit_events (org_id,actor_id,action,entity_type,entity_id,request_id,after_hash)
                VALUES (%s,%s,'assessment.created','assessment',%s,%s,%s)""",
                (principal.org_id, principal.user_id, row[0], request_id, digest))
        return Assessment(id=row[0], org_id=row[1], created_by=row[2], version=row[3], payload=row[4], updated_at=row[5])

    def get_assessment(self, assessment_id: UUID, org_id: UUID) -> Assessment | None:
        """Read one assessment using application and RLS tenant predicates."""
        with self.pool.connection() as conn, transaction_for_org(conn, org_id):
            row = conn.execute("""SELECT id,org_id,created_by,version,payload,updated_at FROM assessments
                WHERE id=%s AND org_id=%s""", (assessment_id, org_id)).fetchone()
        return None if row is None else Assessment(id=row[0], org_id=row[1], created_by=row[2], version=row[3], payload=row[4], updated_at=row[5])

    def update_assessment(self, assessment_id: UUID, update: AssessmentUpdate, expected_version: int, principal: Principal, request_id: str) -> Assessment | None:
        """Atomically apply an optimistic update; return None on absent/stale version."""
        patch = update.model_dump(exclude_none=True)
        with self.pool.connection() as conn, transaction_for_org(conn, principal.org_id):
            row = conn.execute("""
              UPDATE assessments SET payload = payload || %s::jsonb, version = version + 1, updated_at = now()
              WHERE id = %s AND org_id = %s AND version = %s
              RETURNING id, org_id, created_by, version, payload, updated_at
            """, (json.dumps(patch), assessment_id, principal.org_id, expected_version)).fetchone()
            if row is None:
                return None
            conn.execute("""INSERT INTO assessment_revisions (assessment_id,org_id,version,payload,actor_id)
                VALUES (%s,%s,%s,%s::jsonb,%s)""", (row[0], row[1], row[3], json.dumps(row[4]), principal.user_id))
            after_hash = hashlib.sha256(json.dumps(row[4], sort_keys=True).encode()).hexdigest()
            conn.execute("""INSERT INTO audit_events (org_id,actor_id,action,entity_type,entity_id,request_id,after_hash)
                VALUES (%s,%s,'assessment.updated','assessment',%s,%s,%s)""", (principal.org_id, principal.user_id, assessment_id, request_id, after_hash))
        return Assessment(id=row[0], org_id=row[1], created_by=row[2], version=row[3], payload=row[4], updated_at=row[5])

    def report(self, assessment_id: UUID, revision: int, org_id: UUID) -> ReportSnapshot | None:
        with self.pool.connection() as conn, transaction_for_org(conn, org_id):
            row = conn.execute("""SELECT id,org_id,assessment_id,assessment_revision,formula_version,data_version,label_version,source_passage_hashes,payload,created_at
              FROM report_snapshots WHERE assessment_id=%s AND org_id=%s AND assessment_revision=%s""", (assessment_id, org_id, revision)).fetchone()
        return None if row is None else ReportSnapshot(id=row[0], org_id=row[1], assessment_id=row[2], assessment_revision=row[3], formula_version=row[4], data_version=row[5], label_version=row[6], source_passage_hashes=row[7], payload=row[8], created_at=row[9])

    def create_report(self, assessment_id: UUID, principal: Principal, request_id: str) -> ReportSnapshot | None:
        """Persist a minimal immutable, replayable report envelope for its revision."""
        with self.pool.connection() as conn, transaction_for_org(conn, principal.org_id):
            assessment = conn.execute("SELECT version,payload FROM assessments WHERE id=%s AND org_id=%s", (assessment_id, principal.org_id)).fetchone()
            if assessment is None:
                return None
            payload = {"assessment": assessment[1], "limits": ["Decision support only; compliance requires reviewed corpus."], "source_passage_hashes": []}
            row = conn.execute("""INSERT INTO report_snapshots(org_id,assessment_id,assessment_revision,formula_version,data_version,label_version,source_passage_hashes,payload)
              VALUES(%s,%s,%s,'gtm-v2','seed-2026-10','pilot-v1','[]'::jsonb,%s::jsonb)
              ON CONFLICT(assessment_id,org_id,assessment_revision) DO UPDATE SET payload=report_snapshots.payload
              RETURNING id,org_id,assessment_id,assessment_revision,formula_version,data_version,label_version,source_passage_hashes,payload,created_at""",
              (principal.org_id, assessment_id, assessment[0], json.dumps(payload))).fetchone()
            conn.execute("""INSERT INTO audit_events(org_id,actor_id,action,entity_type,entity_id,request_id,after_hash)
              VALUES(%s,%s,'report.snapshotted','report_snapshot',%s,%s,%s)""",
              (principal.org_id, principal.user_id, row[0], request_id, hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()))
        return ReportSnapshot(id=row[0], org_id=row[1], assessment_id=row[2], assessment_revision=row[3], formula_version=row[4], data_version=row[5], label_version=row[6], source_passage_hashes=row[7], payload=row[8], created_at=row[9])

    def compliance_search(self, assessment_id: UUID, query: str, org_id: UUID) -> ComplianceSearchResult:
        """Only return fresh, approved passages. All other states abstain."""
        with self.pool.connection() as conn, transaction_for_org(conn, org_id):
            assessment = conn.execute("SELECT payload FROM assessments WHERE id=%s AND org_id=%s", (assessment_id, org_id)).fetchone()
            if not assessment:
                return ComplianceSearchResult(status="abstained", abstention_reasons=[AbstentionReason.INSUFFICIENT_COVERAGE])
            payload = assessment[0]
            reasons = []
            if not payload.get("hs_code"):
                reasons.append(AbstentionReason.INSUFFICIENT_CLASSIFICATION)
            if not payload.get("jurisdiction") or not payload.get("origin"):
                reasons.append(AbstentionReason.OUT_OF_JURISDICTION)
            if reasons:
                return ComplianceSearchResult(status="abstained", abstention_reasons=reasons)
            unapproved, expired = conn.execute("SELECT EXISTS(SELECT 1 FROM source_versions WHERE status <> 'approved' OR reviewed_at IS NULL), EXISTS(SELECT 1 FROM source_versions WHERE expires_at < CURRENT_DATE)").fetchone()
            if unapproved:
                return ComplianceSearchResult(status="abstained", abstention_reasons=[AbstentionReason.UNAPPROVED_SOURCE])
            if expired:
                return ComplianceSearchResult(status="abstained", abstention_reasons=[AbstentionReason.EXPIRED_SOURCE])
            rows = conn.execute("""SELECT sv.id,sp.id,sv.authority,sv.url,sp.locator,sp.text,sv.content_hash,sp.content_hash,sv.retrieved_at,sv.effective_date,sv.reviewed_at
              FROM source_versions sv JOIN source_passages sp ON sp.source_version_id=sv.id
              WHERE sv.status='approved' AND sv.reviewed_at IS NOT NULL AND (sv.expires_at IS NULL OR sv.expires_at >= CURRENT_DATE)
              AND sp.text ILIKE %s ORDER BY sv.reviewed_at DESC LIMIT 20""", (f"%{query}%",)).fetchall()
        if not rows:
            return ComplianceSearchResult(status="abstained", abstention_reasons=[AbstentionReason.NO_APPROVED_CORPUS])
        return ComplianceSearchResult(status="answered", citations=[Citation(source_version_id=r[0], passage_id=r[1], authority=r[2], url=r[3], locator=r[4], text=r[5], content_hash=r[6], passage_hash=r[7], retrieved_at=r[8], effective_date=r[9], reviewed_at=r[10]) for r in rows])

    def create_source_version(self, source_id: UUID, data: SourceVersionCreate, principal: Principal, request_id: str) -> SourceVersion | None:
        with self.pool.connection() as conn, transaction_for_org(conn, principal.org_id):
            try:
                with conn.transaction():
                    if data.status != 'draft':
                        return None
                    if conn.execute("SELECT 1 FROM source_documents WHERE id=%s", (source_id,)).fetchone() is None:
                        return None
                    row = conn.execute("""INSERT INTO source_versions(source_id,authority,url,retrieved_at,effective_date,expires_at,content_hash,status)
                      VALUES(%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id,source_id,authority,url,retrieved_at,effective_date,reviewed_at,expires_at,content_hash,reviewed_by,status""",
                      (source_id,data.authority,str(data.url),data.retrieved_at,data.effective_date,data.expires_at,data.content_hash,data.status)).fetchone()
                    # Source editorial activity is global; audit it in the actor's organization.
                    conn.execute("""INSERT INTO audit_events(org_id,actor_id,action,entity_type,entity_id,request_id,after_hash)
                      VALUES (%s,%s,'source_version.created','source_version',%s,%s,%s)""",
                      (principal.org_id, principal.user_id, row[0], request_id, data.content_hash))
            except UniqueViolation:
                return None
        return SourceVersion(id=row[0], source_id=row[1], authority=row[2], url=row[3], retrieved_at=row[4], effective_date=row[5], reviewed_at=row[6], expires_at=row[7], content_hash=row[8], reviewed_by=row[9], status=row[10])

    def review_source_version(self, version_id: UUID, data: SourceVersionReview, principal: Principal, request_id: str) -> SourceVersion | None:
        """Record the reviewer, transition, and audit event for a draft version."""
        with self.pool.connection() as conn, transaction_for_org(conn, principal.org_id):
            row = conn.execute("""UPDATE source_versions SET status=%s, reviewed_at=now(), reviewed_by=%s
              WHERE id=%s AND status='draft'
              RETURNING id,source_id,authority,url,retrieved_at,effective_date,reviewed_at,expires_at,content_hash,reviewed_by,status""",
              (data.status, principal.user_id, version_id)).fetchone()
            if row is None:
                return None
            conn.execute("""INSERT INTO audit_events(org_id,actor_id,action,entity_type,entity_id,request_id,after_hash)
              VALUES (%s,%s,%s,'source_version',%s,%s,%s)""",
              (principal.org_id, principal.user_id, 'source_version.' + data.status, version_id, request_id, row[8]))
        return SourceVersion(id=row[0], source_id=row[1], authority=row[2], url=row[3], retrieved_at=row[4], effective_date=row[5], reviewed_at=row[6], expires_at=row[7], content_hash=row[8], reviewed_by=row[9], status=row[10])
