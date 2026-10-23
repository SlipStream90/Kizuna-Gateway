from app.domain.compliance_search import search_passages
from app.seed.sources import SOURCES
def search(query): return search_passages(query,SOURCES)
def source(source_id): return next((s for s in SOURCES if s.id==source_id),None)
