from decimal import Decimal
import pytest
from app.domain.mcda import rank_regions
from app.seed.regions import REGIONS
def test_stable_and_deterministic():
 r=rank_regions({'market':Decimal('.4'),'operations':Decimal('.3'),'readiness':Decimal('.3')},REGIONS);assert len(r.rows)==3 and r.rows[0].score==Decimal('82.4')
def test_invalid_weights():
 with pytest.raises(ValueError):rank_regions({'market':Decimal('1.1')},REGIONS)
