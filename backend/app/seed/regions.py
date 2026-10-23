from decimal import Decimal
from app.schemas.market import Region
REGIONS=[
 Region(id='maharashtra',name='Maharashtra',component_scores={'market':Decimal('85'),'operations':Decimal('78'),'readiness':Decimal('80')},coverage=Decimal('0.90'),source_ids=['dpiit-investment'],warnings=['Illustrative seeded indicators; validate locally.']),
 Region(id='tamil-nadu',name='Tamil Nadu',component_scores={'market':Decimal('80'),'operations':Decimal('86'),'readiness':Decimal('82')},coverage=Decimal('0.88'),source_ids=['dpiit-investment'],warnings=['Illustrative seeded indicators; validate locally.']),
 Region(id='karnataka',name='Karnataka',component_scores={'market':Decimal('82'),'operations':Decimal('76'),'readiness':Decimal('88')},coverage=Decimal('0.85'),source_ids=['dpiit-investment'],warnings=['Illustrative seeded indicators; validate locally.'])]
