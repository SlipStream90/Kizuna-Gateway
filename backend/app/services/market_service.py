from app.domain.mcda import rank_regions
from app.seed.regions import REGIONS
def ranking(assessment):
 result=rank_regions(assessment.weights,REGIONS); result.assessment_id=str(assessment.id); return result
