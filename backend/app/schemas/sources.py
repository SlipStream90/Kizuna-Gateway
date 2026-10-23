from pydantic import BaseModel
class SourceRecord(BaseModel):
 id:str; authority:str; canonical_url:str; passage:str; page:str; effective_at:str; checked_at:str; retrieved_at:str; status:str
