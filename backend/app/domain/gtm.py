from decimal import Decimal
from app.schemas.gtm import GtmScenarioCreate,GtmScenarioResult,GtmLineItem
def calculate_gtm(scenario:GtmScenarioCreate)->GtmScenarioResult:
 revenue=scenario.unit_value*Decimal(scenario.volume); logistics=scenario.logistics_per_unit*Decimal(scenario.volume); margin=revenue*scenario.channel_margin_rate if scenario.mode=='distributor_led' else Decimal('0'); total=revenue-logistics-margin; r=scenario.sensitivity_rate
 return GtmScenarioResult(mode=scenario.mode,assumptions={'unit_value':format(scenario.unit_value,'f'),'volume':str(scenario.volume),'tariffs':'Not calculated; classification, origin, schedule and inputs require verification.'},line_items=[GtmLineItem(label='Gross revenue',amount=revenue),GtmLineItem(label='Logistics',amount=-logistics),GtmLineItem(label='Channel margin',amount=-margin)],total=total,sensitivity={'downside':total*(Decimal('1')-r),'upside':total*(Decimal('1')+r)})
