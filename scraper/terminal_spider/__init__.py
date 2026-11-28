"""
Terminal spider fleet: one BaseSpider subclass per agency site.

To add an agency: copy kw_aruba.py, change the class attributes and the
selectors, and add the class to SPIDERS below. Nothing else changes.
"""

from .all_property_aruba import AllPropertyArubaSpider
from .bold_aruba import BoldArubaSpider
from .coldwell_banker_aruba import ColdwellBankerArubaSpider
from .base import BaseSpider, SiteBlockedError, SpiderStats
from .kw_aruba import KWArubaSpider
from .remax_aruba import RemaxArubaSpider
from .weichert_aruba import WeichertArubaSpider

SPIDERS: dict[str, type[BaseSpider]] = {
    KWArubaSpider.agency_id: KWArubaSpider,
    AllPropertyArubaSpider.agency_id: AllPropertyArubaSpider,
    RemaxArubaSpider.agency_id: RemaxArubaSpider,
    BoldArubaSpider.agency_id: BoldArubaSpider,
    WeichertArubaSpider.agency_id: WeichertArubaSpider,
    ColdwellBankerArubaSpider.agency_id: ColdwellBankerArubaSpider,
}

__all__ = ["SPIDERS", "AllPropertyArubaSpider", "BoldArubaSpider", "BaseSpider", "ColdwellBankerArubaSpider", "KWArubaSpider", "RemaxArubaSpider", "SiteBlockedError", "SpiderStats", "WeichertArubaSpider"]
