from app.domain.gtm import calculate_gtm
from app.schemas.gtm import GtmScenarioCreate
def test_two_mode_decimal_golden():
 payload={'direct':{'unit_value':'100.00','volume':3,'shipping_cost':'12.00','insurance_rate':'0.02','channel_margin_rate':'0.00','local_setup_cost':'5.00','other_cost':'1.00'},'distributor':{'unit_value':'100.00','volume':3,'shipping_cost':'10.00','insurance_rate':'0.02','channel_margin_rate':'0.10','local_setup_cost':'2.00','other_cost':'1.00'},'sensitivity_field':'shipping_cost','sensitivity_delta':'3.00'}
 r=calculate_gtm(GtmScenarioCreate(**payload));assert str(r.direct.total)=='276.00' and str(r.distributor.total)=='251.00' and str(r.sensitivity['delta'])=='-3.00'
