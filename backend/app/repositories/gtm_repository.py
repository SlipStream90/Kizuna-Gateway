class GtmRepository:
 def __init__(self):self.items={}
 def save(self,assessment_id,result):self.items.setdefault(assessment_id,[]).append(result);return result
 def list(self,assessment_id):return self.items.get(assessment_id,[])
