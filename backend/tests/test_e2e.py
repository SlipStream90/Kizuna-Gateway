from fastapi.testclient import TestClient
from app.main import app
def test_seeded_workflow():
 with TestClient(app) as c:
  a=c.post('/api/v1/assessments',json={'product':'Sensor','sector':'Industrial','target_customer':'OEM','budget':'1000.00','horizon_months':12,'preferred_modes':['direct_export'],'weights':{'market':'0.4','operations':'0.3','readiness':'0.3'}}).json();aid=a['id']
  assert c.patch(f'/api/v1/assessments/{aid}',json={'weights':{'market':'0.5','operations':'0.2','readiness':'0.3'}}).status_code==200
  assert c.post(f'/api/v1/assessments/{aid}/gtm-scenarios',json={'mode':'direct_export','unit_value':'10.00','volume':3,'logistics_per_unit':'1.00','channel_margin_rate':'0','sensitivity_rate':'0.1'}).status_code==201
  assert c.get(f'/api/v1/assessments/{aid}/report').status_code==200
