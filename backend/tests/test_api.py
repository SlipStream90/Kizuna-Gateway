from fastapi.testclient import TestClient
from app.main import app
BASE={'product':'Sensor','sector':'Industrial','target_customer':'OEM','budget':'1000.00','horizon_months':12,'preferred_modes':['direct_export'],'unit_value':'10.00','weights':{'market':'0.4','operations':'0.3','readiness':'0.3'}}
MODE={'unit_value':'10.00','volume':3,'shipping_cost':'1.00','insurance_rate':'0','channel_margin_rate':'0','local_setup_cost':'0','other_cost':'0'}
def test_create_patch_rank():
 with TestClient(app) as c:
  bad=c.post('/api/v1/assessments',json={});assert bad.status_code==422
  r=c.post('/api/v1/assessments',json={'product':'Sensor','sector':'Industrial','target_customer':'OEM','budget':'1000.00','horizon_months':12,'preferred_modes':['direct_export'],'weights':{'market':'0.4','operations':'0.3','readiness':'0.3'}});assert r.status_code==201
  aid=r.json()['id'];assert c.get(f'/api/v1/assessments/{aid}/market-ranking').status_code==200
  assert c.patch(f'/api/v1/assessments/{aid}',json={'weights':{'market':.4,'operations':.3,'readiness':.3}}).status_code==422
  assert c.post('/api/v1/assessments',json={'product':'Sensor','sector':'Industrial','target_customer':'OEM','budget':1000.0,'horizon_months':12,'preferred_modes':['direct_export']}).status_code==422

def test_every_decimal_api_input_rejects_json_floats():
 with TestClient(app) as c:
  for field in ('budget','unit_value'):
   payload=BASE|{field:1.0};assert c.post('/api/v1/assessments',json=payload).status_code==422
  for weight in BASE['weights']:
   weights=BASE['weights']|{weight:0.4};assert c.post('/api/v1/assessments',json=BASE|{'weights':weights}).status_code==422
  aid=c.post('/api/v1/assessments',json=BASE).json()['id']
  for field in ('budget','unit_value'):
   assert c.patch(f'/api/v1/assessments/{aid}',json={field:1.0}).status_code==422
  assert c.patch(f'/api/v1/assessments/{aid}',json={'weights':{'market':0.4,'operations':'0.3','readiness':'0.3'}}).status_code==422
  for mode_name in ('direct','distributor'):
   for field in ('unit_value','shipping_cost','insurance_rate','channel_margin_rate','local_setup_cost','other_cost'):
    invalid=MODE|{field:1.0}; body={'direct':MODE,'distributor':MODE,'sensitivity_field':'shipping_cost','sensitivity_delta':'1.00'}|{mode_name:invalid}
    assert c.post(f'/api/v1/assessments/{aid}/gtm-scenarios',json=body).status_code==422
  body={'direct':MODE,'distributor':MODE,'sensitivity_field':'shipping_cost','sensitivity_delta':1.0}
  assert c.post(f'/api/v1/assessments/{aid}/gtm-scenarios',json=body).status_code==422
