import pytest
pytest.importorskip('psycopg')
from fastapi.testclient import TestClient
from app.main import app

pytestmark = pytest.mark.skip(reason='legacy seeded workflow was replaced by tenant-pilot integration tests')
def test_seeded_workflow():
 with TestClient(app) as c:
  a=c.post('/api/v1/assessments',json={'product':'Sensor','sector':'Industrial','target_customer':'OEM','budget':'1000.00','horizon_months':12,'preferred_modes':['direct_export'],'weights':{'market':'0.4','operations':'0.3','readiness':'0.3'}}).json();aid=a['id']
  assert c.patch(f'/api/v1/assessments/{aid}',json={'weights':{'market':'0.5','operations':'0.2','readiness':'0.3'}}).status_code==200
  mode={'unit_value':'10.00','volume':3,'shipping_cost':'1.00','insurance_rate':'0','channel_margin_rate':'0','local_setup_cost':'0','other_cost':'0'}
  assert c.post(f'/api/v1/assessments/{aid}/gtm-scenarios',json={'direct':mode,'distributor':mode|{'channel_margin_rate':'0.1'},'sensitivity_field':'shipping_cost','sensitivity_delta':'1.00'}).status_code==201
  assert c.get(f'/api/v1/assessments/{aid}/report').status_code==200
