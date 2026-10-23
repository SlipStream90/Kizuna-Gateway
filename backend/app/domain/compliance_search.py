import re
from app.schemas.compliance import ComplianceSearchResult,ComplianceItem,ComplianceCitation
from app.schemas.sources import SourceRecord
def search_passages(query:str,sources:list[SourceRecord])->ComplianceSearchResult:
 terms=set(re.findall(r'[a-z0-9]+',query.lower())); matched=[]
 for source in sources:
  score=len(terms & set(re.findall(r'[a-z0-9]+',source.passage.lower())))
  if score: matched.append((score,source))
 matched.sort(key=lambda x:(-x[0],x[1].id)); weak=not matched or matched[0][0]<2
 return ComplianceSearchResult(query=query,status='uncertain' if weak else 'review_required',review_required=True,items=[ComplianceItem(item='Stored source passage',applicability='Human review required; no legal, tariff, origin, CEPA, or classification conclusion is made.',review_required=True,citation=ComplianceCitation(source_id=s.id,authority=s.authority,canonical_url=s.canonical_url,passage=s.passage,page=s.page,effective_at=s.effective_at,checked_at=s.checked_at)) for _,s in matched])
