"""Retired legacy repository; report replay is tenant-scoped in PilotRepository."""


class ReportRepository:
 def __init__(self):
  raise RuntimeError('ReportRepository is retired; use PilotRepository with a tenant principal')
