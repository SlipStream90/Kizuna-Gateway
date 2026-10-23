from uuid import uuid4
from datetime import datetime,timezone
from app.schemas.reports import ReportSnapshot
from app.services.market_service import ranking
from app.services.gtm_service import list_for
from app.seed.partners import PARTNERS
from app.seed.sources import SOURCES
from app.services.compliance_service import search
from app.repositories.report_repository import ReportRepository
repo=ReportRepository()
def build(assessment):
 cached=repo.get(assessment.id)
 if cached:return cached
 now=datetime.now(timezone.utc).isoformat()
 checklist=search('classification origin schedule').model_dump(mode='json')
 report=ReportSnapshot(id=uuid4(),assessment_id=assessment.id,version=1,created_at=now,formula_version='mcda-v1; gtm-v2',data_version='seed-2026-10',payload={'assessment':assessment.model_dump(mode='json'),'ranking':ranking(assessment).model_dump(mode='json'),'partners':[p.model_dump(mode='json') for p in PARTNERS],'gtm':[x.model_dump(mode='json') for x in list_for(assessment.id)],'compliance_checklist':checklist,'sources':[s.model_dump(mode='json') for s in SOURCES],'assumptions':['GTM outputs are illustrative; no duty, tariff, CEPA, or origin rate is calculated.'],'risks':['Human verification required for all compliance and partner checks.'],'next_steps':['Verify classification, origin, schedules, and counterparties.'],'formula_version':'mcda-v1; gtm-v2','data_version':'seed-2026-10','generated_at':now})
 return repo.save(assessment.id,report)
