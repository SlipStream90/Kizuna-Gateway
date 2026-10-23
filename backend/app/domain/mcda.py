from decimal import Decimal
from typing import Sequence
from app.schemas.market import Region, MarketRanking, RankedRegion
def rank_regions(weights: dict[str, Decimal], regions: Sequence[Region]) -> MarketRanking:
    if not weights or any(Decimal(v)<0 for v in weights.values()) or sum(Decimal(v) for v in weights.values()) != Decimal('1'): raise ValueError('weights must be non-negative and total exactly 1')
    rows=[]
    for r in regions:
        components={k: Decimal(r.component_scores.get(k,0)) for k in weights}; score=sum((weights[k]*components[k] for k in weights),Decimal('0'))
        rows.append((r,score,components))
    rows.sort(key=lambda x:(-x[1],x[0].id))
    return MarketRanking(rows=[RankedRegion(rank=i+1,region_id=r.id,name=r.name,score=s,components=c,coverage=r.coverage,source_ids=r.source_ids,warnings=r.warnings) for i,(r,s,c) in enumerate(rows)])
