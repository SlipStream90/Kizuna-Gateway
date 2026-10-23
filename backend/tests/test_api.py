from fastapi.testclient import TestClient
from app.main import app
def test_create_patch_rank():
 with TestClient(app) as c:
  bad=c.post('/api/v1/assessments',json={});assert bad.status_code==422
  r=c.post('/api/v1/assessments',json={'product':'Sensor','sector':'Industrial','target_customer':'OEM','budget':'1000.00','horizon_months':12,'preferred_modes':['direct_export'],'weights':{'market':'0.4','operations':'0.3','readiness':'0.3'}});assert r.status_code==201
  aid=r.json()['id'];assert c.get(f'/api/v1/assessments/{aid}/market-ranking').status_code==200
  assert c.patch(f'/api/v1/assessments/{aid}',json={'weights':{'market':.4,'operations':.3,'readiness':.3}}).status_code==422
  assert c.post('/api/v1/assessments',json={'product':'Sensor','sector':'Industrial','target_customer':'OEM','budget':1000.0,'horizon_months':12,'preferred_modes':['direct_export']}).status_code==422
