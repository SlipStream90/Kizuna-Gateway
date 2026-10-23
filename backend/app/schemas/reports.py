from uuid import UUID
from pydantic import BaseModel
class ReportSnapshot(BaseModel): id:UUID; assessment_id:UUID; payload:dict; version:int; created_at:str; label:str='Cached illustrative offline report'
