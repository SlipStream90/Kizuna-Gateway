from pydantic import BaseModel
class ComplianceCitation(BaseModel): source_id:str; authority:str; canonical_url:str; passage:str; page:str; effective_at:str; checked_at:str
class ComplianceItem(BaseModel): item:str; applicability:str; review_required:bool; citation:ComplianceCitation
class ComplianceSearchResult(BaseModel): query:str; status:str; review_required:bool; items:list[ComplianceItem]
