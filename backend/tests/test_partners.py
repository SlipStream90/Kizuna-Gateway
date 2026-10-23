from app.services.partner_service import list_partners,scorecard
def test_fictional_disclosure_and_separation():
 p=list_partners().partners[0];assert p.fictional and p.fit and p.evidence and p.unknowns
 assert 'does not establish trustworthiness' in scorecard(p.id).disclosure
