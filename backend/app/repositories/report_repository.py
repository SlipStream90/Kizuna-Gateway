class ReportRepository:
 def __init__(self):self.items={}
 def save(self,assessment_id,report):self.items[assessment_id]=report;return report
 def get(self,assessment_id):return self.items.get(assessment_id)
