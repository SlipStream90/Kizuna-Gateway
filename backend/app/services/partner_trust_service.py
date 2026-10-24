"""Directory listing and audits for the Partner Trust & Verification Engine."""

from decimal import Decimal
from uuid import UUID

from app.domain.partner_trust import DISCLOSURE, SCORING_VERSION, audit
from app.repositories.partner_registry_repository import PartnerRegistryRepository
from app.schemas.partner_registry import PartnerDirectory, PartnerDirectoryItem, TrustAudit


def directory(
    repository: PartnerRegistryRepository,
    sector: str | None = None,
    state: str | None = None,
    min_otd: Decimal | None = None,
    min_trust_score: Decimal | None = None,
) -> PartnerDirectory:
    items: list[PartnerDirectoryItem] = []
    for record in repository.list(sector, state):
        a = audit(record)
        if min_otd is not None and a.otd_trailing_pct < min_otd:
            continue
        if min_trust_score is not None and a.score < min_trust_score:
            continue
        items.append(PartnerDirectoryItem(
            id=record.id, partner_name=record.partner_name, record_source=record.record_source, simulated=a.simulated,
            sector=record.sector, state=record.state, city=record.city, partner_type=record.partner_type,
            score=a.score, tier=a.tier, otd_trailing_pct=a.otd_trailing_pct, litigation_flag=record.litigation_flag,
            credit_band=record.credit_rating.band,
            iso_verified=[c.standard for c in record.iso_certifications if c.status == "verified"],
            block_flags=sum(f.level == "block" for f in a.flags), warn_flags=sum(f.level == "warn" for f in a.flags),
        ))
    items.sort(key=lambda i: (-i.score, i.partner_name))
    return PartnerDirectory(
        partners=items, total=len(items),
        filters={"sector": sector, "state": state,
                 "min_otd": None if min_otd is None else str(min_otd),
                 "min_trust_score": None if min_trust_score is None else str(min_trust_score)},
        scoring_version=SCORING_VERSION, disclosure=DISCLOSURE,
    )


def audit_partner(repository: PartnerRegistryRepository, partner_id: UUID) -> TrustAudit | None:
    record = repository.get(partner_id)
    return audit(record) if record else None
