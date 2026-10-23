"""Retired legacy repository; it cannot safely retain tenant data."""


class GtmRepository:
 def __init__(self):
  raise RuntimeError('GtmRepository is retired; use the tenant-scoped API')
