from uuid import uuid4
from datetime import datetime,timezone
from app.schemas.reports import ReportSnapshot
from app.services.market_service import ranking
from app.services.gtm_service import list_for
from app.seed.partners import PARTNERS
from app.seed.sources import SOURCES
from app.repositories.report_repository import ReportRepository
repo=ReportRepository()
def build(assessment):
 cached=repo.get(assessment.id)
 if cached:return cached
 report=ReportSnapshot(id=uuid4(),assessment_id=assessment.id,version=1,created_at=datetime.now(timezone.utc).isoformat(),payload={'assessment':assessment.model_dump(mode='json'),'ranking':ranking(assessment).model_dump(mode='json'),'partners':[p.model_dump(mode='json') for p in PARTNERS],'gtm':[x.model_dump(mode='json') for x in list_for(assessment.id)],'sources':[s.model_dump() for s in SOURCES],'risks':['Human verification required for all compliance and partner checks.'],'next_steps':['Verify classification, origin, schedules, and counterparties.']})
 return repo.save(assessment.id,report)
