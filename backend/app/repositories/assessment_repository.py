"""Retired legacy repository; pilot access requires ``PilotRepository``."""


class AssessmentRepository:
 def __init__(self):
  raise RuntimeError('AssessmentRepository is retired; use PilotRepository with a tenant principal')
