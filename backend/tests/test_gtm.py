from app.domain.gtm import calculate_gtm
from app.schemas.gtm import GtmScenarioCreate
def test_decimal_gtm():
 r=calculate_gtm(GtmScenarioCreate(mode='distributor_led',unit_value='100.10',volume=3,logistics_per_unit='2.20',channel_margin_rate='0.1'));assert str(r.total)=='263.670' and str(r.sensitivity['downside'])=='237.30300'
