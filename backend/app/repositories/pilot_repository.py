"""Organization-scoped persistence for revisions, citations and report replay."""

import hashlib
import json
from datetime import date
from uuid import UUID

from psycopg.errors import UniqueViolation
from psycopg_pool import ConnectionPool

from app.repositories.database import transaction_for_org
from app.schemas.pilot import (AbstentionReason, Assessment, AssessmentUpdate, Citation,
    ComplianceSearchResult, Principal, ReportSnapshot, SourceVersion, SourceVersionCreate)


class PilotRepository:
    """Repository with explicit organization predicates in every tenant query."""

    def __init__(self, pool: ConnectionPool):
        self.pool = pool

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

    def compliance_search(self, assessment_id: UUID, query: str, org_id: UUID) -> ComplianceSearchResult:
        """Only return fresh, approved passages. All other states abstain."""
        with self.pool.connection() as conn, transaction_for_org(conn, org_id):
            exists = conn.execute("SELECT 1 FROM assessments WHERE id=%s AND org_id=%s", (assessment_id, org_id)).fetchone()
            if not exists:
                return ComplianceSearchResult(status="abstained", abstention_reasons=[AbstentionReason.INSUFFICIENT_COVERAGE])
            rows = conn.execute("""SELECT sv.id,sp.id,sv.authority,sv.url,sp.locator,sp.text,sv.content_hash,sp.content_hash,sv.retrieved_at,sv.effective_date,sv.reviewed_at
              FROM source_versions sv JOIN source_passages sp ON sp.source_version_id=sv.id
              WHERE sv.status='approved' AND sv.reviewed_at IS NOT NULL AND (sv.expires_at IS NULL OR sv.expires_at >= CURRENT_DATE)
              AND sp.text ILIKE %s ORDER BY sv.reviewed_at DESC LIMIT 20""", (f"%{query}%",)).fetchall()
        if not rows:
            return ComplianceSearchResult(status="abstained", abstention_reasons=[AbstentionReason.NO_APPROVED_CORPUS])
        return ComplianceSearchResult(status="answered", citations=[Citation(source_version_id=r[0], passage_id=r[1], authority=r[2], url=r[3], locator=r[4], text=r[5], content_hash=r[6], passage_hash=r[7], retrieved_at=r[8], effective_date=r[9], reviewed_at=r[10]) for r in rows])

    def create_source_version(self, source_id: UUID, data: SourceVersionCreate, actor_id: UUID) -> SourceVersion | None:
        with self.pool.connection() as conn:
            try:
                with conn.transaction():
                    row = conn.execute("""INSERT INTO source_versions(source_id,authority,url,retrieved_at,effective_date,expires_at,content_hash,status)
                      VALUES(%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id,source_id,authority,url,retrieved_at,effective_date,reviewed_at,expires_at,content_hash,reviewed_by,status""",
                      (source_id,data.authority,str(data.url),data.retrieved_at,data.effective_date,data.expires_at,data.content_hash,data.status)).fetchone()
            except UniqueViolation:
                return None
        return SourceVersion(id=row[0], source_id=row[1], authority=row[2], url=row[3], retrieved_at=row[4], effective_date=row[5], reviewed_at=row[6], expires_at=row[7], content_hash=row[8], reviewed_by=row[9], status=row[10])
