from app.repositories.assessment_repository import AssessmentRepository
repo=AssessmentRepository()
def create(payload): return repo.create(payload)
def get(id): return repo.get(id)
def update(id,payload):
 value=repo.update(id,payload)
 if value: repo.items[id]=value
 return value
