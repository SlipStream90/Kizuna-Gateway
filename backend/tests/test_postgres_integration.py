"""Real PostgreSQL lifecycle assertions; the PowerShell wrapper provisions DATABASE_URL."""
import os
from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.domain.gtm import calculate_gtm
from app.repositories.assessment_repository import AssessmentRepository
from app.repositories.gtm_repository import GtmRepository
from app.repositories.report_repository import ReportRepository
from app.schemas.assessments import AssessmentCreate, AssessmentUpdate
from app.schemas.gtm import GtmScenarioCreate, ModeAssumptions
from app.schemas.reports import ReportSnapshot

pytestmark = pytest.mark.skip(reason='legacy repositories were retired; coverage lives in test_pilot_isolation')

def mode(shipping: str) -> ModeAssumptions:
    return ModeAssumptions(unit_value='10.00', volume=3, shipping_cost=shipping, insurance_rate='0.01', channel_margin_rate='0.10', local_setup_cost='2.00', other_cost='0.00')

def test_postgres_assessment_gtm_report_round_trip_and_cleanup():
    psycopg = pytest.importorskip('psycopg')
    assessment = None
    try:
        assessments = AssessmentRepository(); scenarios = GtmRepository(); reports = ReportRepository()
        assessment = assessments.create(AssessmentCreate(product='Sensor', sector='Industrial', target_customer='OEM', budget='1000.00', horizon_months=12, preferred_modes=['direct_export']))
        updated = assessments.update(assessment.id, AssessmentUpdate(product='Updated sensor', unit_value='9.99', weights={'market':'0.5','operations':'0.3','readiness':'0.2'}))
        assert updated and updated.unit_value == Decimal('9.99') and updated.weights['market'] == Decimal('0.5')
        durable = AssessmentRepository().get(assessment.id)
        assert durable and durable.weights['readiness'] == Decimal('0.2')
        direct = calculate_gtm(GtmScenarioCreate(direct=mode('1.00'), distributor=mode('2.00'), sensitivity_field='shipping_cost', sensitivity_delta='1.00'))
        distributor = calculate_gtm(GtmScenarioCreate(direct=mode('3.00'), distributor=mode('4.00'), sensitivity_field='shipping_cost', sensitivity_delta='2.00'))
        scenarios.save(assessment.id, direct); scenarios.save(assessment.id, distributor)
        saved = GtmRepository().list(assessment.id)
        assert len(saved) == 2 and saved[0].direct.assumptions.shipping_cost == Decimal('1.00') and saved[1].distributor.assumptions.shipping_cost == Decimal('4.00')
        snapshot = ReportSnapshot(id=uuid4(), assessment_id=assessment.id, payload={'ranking': {'rows': [{'score': '0.800'}]}, 'risks': ['review']}, version=7, created_at='2026-10-23T00:00:00Z', formula_version='mcda-v1; gtm-v2', data_version='seed-2026-10')
        reports.save(assessment.id, snapshot)
        reloaded = ReportRepository().get(assessment.id)
        assert reloaded and reloaded.version == 7 and reloaded.payload['ranking']['rows'][0]['score'] == '0.800'
        with pytest.raises(ValidationError): AssessmentUpdate(weights={'market': 0.5, 'operations': '0.3', 'readiness': '0.2'})
        with pytest.raises(ValidationError): GtmScenarioCreate(direct={**mode('1.00').model_dump(mode='json'), 'shipping_cost': 1.0}, distributor=mode('1.00'), sensitivity_field='shipping_cost', sensitivity_delta='1.00')
        with pytest.raises(ValidationError): GtmScenarioCreate(direct=mode('1.00'), distributor={**mode('1.00').model_dump(mode='json'), 'shipping_cost': 1.0}, sensitivity_field='shipping_cost', sensitivity_delta='1.00')
    finally:
        if assessment:
            with psycopg.connect(os.environ['DATABASE_URL']) as connection:
                connection.execute('DELETE FROM report_snapshots WHERE assessment_id=%s', (assessment.id,))
                connection.execute('DELETE FROM gtm_scenarios WHERE assessment_id=%s', (assessment.id,))
                connection.execute('DELETE FROM assessments WHERE id=%s', (assessment.id,))
                assert connection.execute('SELECT count(*) FROM assessments WHERE id=%s', (assessment.id,)).fetchone()[0] == 0
