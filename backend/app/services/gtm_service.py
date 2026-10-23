from app.domain.gtm import calculate_gtm
from app.repositories.gtm_repository import GtmRepository
repo=GtmRepository()
def create(assessment_id,payload):return repo.save(assessment_id,calculate_gtm(payload))
def list_for(assessment_id):return repo.list(assessment_id)
