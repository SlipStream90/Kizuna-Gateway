from datetime import datetime,timezone
from decimal import Decimal,ROUND_HALF_UP
from app.schemas.gtm import GtmScenarioCreate,GtmScenarioResult,GtmLineItem,ModeAssumptions,ModeResult
CENT=Decimal('0.01')
def _money(value):return value.quantize(CENT,rounding=ROUND_HALF_UP)
def _calculate(mode,assumptions):
 revenue=_money(assumptions.unit_value*assumptions.volume);shipping=_money(assumptions.shipping_cost);insurance=_money(revenue*assumptions.insurance_rate);margin=_money(revenue*assumptions.channel_margin_rate) if mode=='distributor' else Decimal('0.00');setup,other=_money(assumptions.local_setup_cost),_money(assumptions.other_cost);total=_money(revenue-shipping-insurance-margin-setup-other)
 return ModeResult(assumptions=assumptions,line_items=[GtmLineItem(label='Gross revenue',amount=revenue),GtmLineItem(label='Shipping',amount=-shipping),GtmLineItem(label='Insurance',amount=-insurance),GtmLineItem(label='Channel margin',amount=-margin),GtmLineItem(label='Local setup',amount=-setup),GtmLineItem(label='Other cost',amount=-other)],total=total)
def calculate_gtm(scenario):
 direct,distributor=_calculate('direct',scenario.direct),_calculate('distributor',scenario.distributor);is_distributor=scenario.sensitivity_field=='channel_margin_rate';base=scenario.distributor if is_distributor else scenario.direct;baseline=distributor.total if is_distributor else direct.total;adjusted=base.model_copy(update={scenario.sensitivity_field:getattr(base,scenario.sensitivity_field)+scenario.sensitivity_delta});affected=_calculate('distributor' if is_distributor else 'direct',adjusted)
 return GtmScenarioResult(generated_at=datetime.now(timezone.utc).isoformat(),assumptions={'direct':scenario.direct,'distributor':scenario.distributor},direct=direct,distributor=distributor,comparison={'direct_minus_distributor':_money(direct.total-distributor.total),'recommended_total':max(direct.total,distributor.total)},sensitivity={'baseline_total':baseline,'adjusted_total':affected.total,'delta':_money(affected.total-baseline)})
