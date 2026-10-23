from uuid import UUID
from app.schemas.assessments import Assessment, AssessmentCreate, AssessmentUpdate
from datetime import datetime, timezone
class AssessmentRepository:
 def __init__(self): self.items={}
 def create(self, payload:AssessmentCreate):
  from uuid import uuid4
  now=datetime.now(timezone.utc); item=Assessment(id=uuid4(),**payload.model_dump(),version=1,score_version='mcda-v1',data_version='seed-2026-10',created_at=now,updated_at=now); self.items[item.id]=item; return item
 def get(self,id:UUID): return self.items.get(id)
 def update(self,id:UUID,payload:AssessmentUpdate):
  item=self.get(id)
  if not item:return None
  return Assessment.model_validate({**item.model_dump(),**payload.model_dump(exclude_none=True),'version':item.version+1,'updated_at':datetime.now(timezone.utc)})
