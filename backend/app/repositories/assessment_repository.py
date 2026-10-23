import os
from uuid import UUID
from app.schemas.assessments import Assessment, AssessmentCreate, AssessmentUpdate
from datetime import datetime, timezone
class AssessmentRepository:
 def __init__(self): self.items={};self.database_url=os.getenv('DATABASE_URL')
 def _connection(self):
  if not self.database_url:return None
  import psycopg
  return psycopg.connect(self.database_url)
 def create(self, payload:AssessmentCreate):
  from uuid import uuid4
  now=datetime.now(timezone.utc); item=Assessment(id=uuid4(),**payload.model_dump(),version=1,score_version='mcda-v1',data_version='seed-2026-10',created_at=now,updated_at=now)
  if conn:=self._connection():
   with conn:
    conn.execute('INSERT INTO assessments (id,product,sector,target_customer,budget,horizon_months,preferred_modes,hs_code,unit_value,volume,weights,version,score_version,data_version,created_at,updated_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',(item.id,item.product,item.sector,item.target_customer,item.budget,item.horizon_months,__import__('json').dumps(item.preferred_modes),item.hs_code,item.unit_value,item.volume,__import__('json').dumps(item.model_dump(mode='json')['weights']),item.version,item.score_version,item.data_version,item.created_at,item.updated_at))
   conn.close()
  self.items[item.id]=item; return item
 def get(self,id:UUID):
  if conn:=self._connection():
   from psycopg.rows import dict_row
   with conn.cursor(row_factory=dict_row) as cur:cur.execute('SELECT * FROM assessments WHERE id=%s',(id,));row=cur.fetchone()
   conn.close();return Assessment.model_validate(row) if row else None
  return self.items.get(id)
 def update(self,id:UUID,payload:AssessmentUpdate):
  item=self.get(id)
  if not item:return None
  updated=Assessment.model_validate({**item.model_dump(),**payload.model_dump(exclude_none=True),'version':item.version+1,'updated_at':datetime.now(timezone.utc)})
  if conn:=self._connection():
   with conn:conn.execute('UPDATE assessments SET weights=%s,budget=%s,horizon_months=%s,version=%s,updated_at=%s WHERE id=%s',(__import__('json').dumps(updated.model_dump(mode='json')['weights']),updated.budget,updated.horizon_months,updated.version,updated.updated_at,id))
   conn.close()
  self.items[id]=updated;return updated
