import os,json
from app.schemas.reports import ReportSnapshot
class ReportRepository:
 def __init__(self):self.items={};self.database_url=os.getenv('DATABASE_URL')
 def _connection(self):
  if not self.database_url:return None
  import psycopg
  return psycopg.connect(self.database_url)
 def save(self,assessment_id,report):
  if conn:=self._connection():
   with conn:conn.execute('INSERT INTO report_snapshots (id,assessment_id,payload,version,created_at) VALUES (%s,%s,%s,%s,%s)',(report.id,assessment_id,json.dumps(report.model_dump(mode='json')),report.version,report.created_at))
   conn.close()
  self.items[assessment_id]=report;return report
 def get(self,assessment_id):
  if conn:=self._connection():
   from psycopg.rows import dict_row
   with conn.cursor(row_factory=dict_row) as cur:cur.execute('SELECT payload FROM report_snapshots WHERE assessment_id=%s ORDER BY created_at DESC LIMIT 1',(assessment_id,));row=cur.fetchone()
   conn.close();return ReportSnapshot.model_validate(row['payload']) if row else None
  return self.items.get(assessment_id)
