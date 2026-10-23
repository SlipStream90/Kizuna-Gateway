import os,json
from uuid import uuid4
from app.schemas.gtm import GtmScenarioResult
class GtmRepository:
 def __init__(self):self.items={};self.database_url=os.getenv('DATABASE_URL')
 def _connection(self):
  if not self.database_url:return None
  import psycopg
  return psycopg.connect(self.database_url)
 def save(self,assessment_id,result):
  result=result.model_copy(update={'id':str(uuid4())})
  if conn:=self._connection():
   with conn:conn.execute('INSERT INTO gtm_scenarios (id,assessment_id,assumptions,calculation,version,created_at) VALUES (%s,%s,%s,%s,%s,%s)',(result.id,assessment_id,json.dumps(result.assumptions,default=str),json.dumps(result.model_dump(mode='json'),default=str),2,result.generated_at))
   conn.close()
  self.items.setdefault(assessment_id,[]).append(result);return result
 def list(self,assessment_id):
  if conn:=self._connection():
   from psycopg.rows import dict_row
   with conn.cursor(row_factory=dict_row) as cur:cur.execute('SELECT calculation FROM gtm_scenarios WHERE assessment_id=%s ORDER BY created_at',(assessment_id,));rows=cur.fetchall()
   conn.close();return [GtmScenarioResult.model_validate(row['calculation']) for row in rows]
  return self.items.get(assessment_id,[])
