from datetime import date
from uuid import UUID
from pydantic import BaseModel
class PartnerSummary(BaseModel):
 id:UUID; name:str; fictional:bool; region_id:str; fit:dict[str,str]; evidence:dict[str,str]; coverage:str; unknowns:list[str]; verification_state:str; verification_date:date | None; missing_checks:list[str]
class PartnerList(BaseModel): partners:list[PartnerSummary]
class PartnerScorecard(PartnerSummary): disclosure:str='Fictional illustrative partner; this scorecard does not establish trustworthiness.'
