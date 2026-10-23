from uuid import UUID
from pydantic import BaseModel
class ReportSnapshot(BaseModel):
 id:UUID;assessment_id:UUID;payload:dict;version:int;created_at:str;formula_version:str;data_version:str;label:str='Cached illustrative offline report'
