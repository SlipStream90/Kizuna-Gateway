"""Exercise PostgreSQL persistence when DATABASE_URL names an integration database."""
import os
from decimal import Decimal
from uuid import uuid4
import pytest
from app.schemas.assessments import AssessmentCreate, AssessmentUpdate
from app.schemas.gtm import GtmScenarioCreate, ModeAssumptions

pytestmark=pytest.mark.skipif(not os.getenv('DATABASE_URL'),reason='DATABASE_URL is required for PostgreSQL integration tests')

def test_postgres_assessment_gtm_and_report_round_trip():
 from app.repositories.assessment_repository import AssessmentRepository
 from app.repositories.gtm_repository import GtmRepository
 from app.repositories.report_repository import ReportRepository
 from app.domain.gtm import calculate_gtm
 from app.schemas.reports import ReportSnapshot
 assessment=AssessmentRepository().create(AssessmentCreate(product='Sensor',sector='Industrial',target_customer='OEM',budget='1000.00',horizon_months=12,preferred_modes=['direct_export']))
 changed=AssessmentRepository().update(assessment.id,AssessmentUpdate(product='Updated sensor',unit_value='9.99'))
 assert changed and changed.product=='Updated sensor' and changed.unit_value==Decimal('9.99')
 mode=ModeAssumptions(unit_value='10.00',volume=1,shipping_cost='1.00',insurance_rate='0',channel_margin_rate='0',local_setup_cost='0',other_cost='0')
 result=GtmRepository().save(assessment.id,calculate_gtm(GtmScenarioCreate(direct=mode,distributor=mode,sensitivity_field='shipping_cost',sensitivity_delta='1.00')))
 assert GtmRepository().list(assessment.id)[0].id==result.id
 report=ReportSnapshot(id=uuid4(),assessment_id=assessment.id,payload={'ok':True},version=1,created_at='2026-10-23T00:00:00Z',formula_version='v1',data_version='v1')
 ReportRepository().save(assessment.id,report);assert ReportRepository().get(assessment.id).payload=={'ok':True}
