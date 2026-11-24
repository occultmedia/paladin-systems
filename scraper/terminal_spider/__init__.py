"""
Terminal spider fleet: one BaseSpider subclass per agency site.

To add an agency: copy kw_aruba.py, change the class attributes and the
selectors, and add the class to SPIDERS below. Nothing else changes.
"""

from .all_property_aruba import AllPropertyArubaSpider
from .base import BaseSpider, SiteBlockedError, SpiderStats
from .kw_aruba import KWArubaSpider

SPIDERS: dict[str, type[BaseSpider]] = {
    KWArubaSpider.agency_id: KWArubaSpider,
    AllPropertyArubaSpider.agency_id: AllPropertyArubaSpider,
}

__all__ = ["SPIDERS", "AllPropertyArubaSpider", "BaseSpider", "KWArubaSpider", "SiteBlockedError", "SpiderStats"]
