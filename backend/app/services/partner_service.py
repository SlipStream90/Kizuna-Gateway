from uuid import UUID
from app.seed.partners import PARTNERS
from app.schemas.partners import PartnerList,PartnerScorecard
def list_partners(region_id=None,q=None):
 values=PARTNERS
 if region_id: values=[p for p in values if p.region_id==region_id]
 if q: values=[p for p in values if q.lower() in p.name.lower()]
 return PartnerList(partners=values)
def scorecard(partner_id:UUID):
 p=next((x for x in PARTNERS if x.id==partner_id),None)
 return PartnerScorecard(**p.model_dump()) if p else None
