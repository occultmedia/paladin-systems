"""
Terminal spider fleet: one BaseSpider subclass per agency site.

To add an agency: copy kw_aruba.py, change the class attributes and the
selectors, and add the class to SPIDERS below. Nothing else changes.
"""

from .all_property_aruba import AllPropertyArubaSpider
from .bhhs_aruba import BhhsArubaSpider
from .bold_aruba import BoldArubaSpider
from .coldwell_banker_aruba import ColdwellBankerArubaSpider
from .base import BaseSpider, SiteBlockedError, SpiderStats
from .kw_aruba import KWArubaSpider
from .mpg_aruba import MpgArubaSpider
from .remax_aruba import RemaxArubaSpider
from .weichert_aruba import WeichertArubaSpider

SPIDERS: dict[str, type[BaseSpider]] = {
    KWArubaSpider.agency_id: KWArubaSpider,
    AllPropertyArubaSpider.agency_id: AllPropertyArubaSpider,
    RemaxArubaSpider.agency_id: RemaxArubaSpider,
    BoldArubaSpider.agency_id: BoldArubaSpider,
    WeichertArubaSpider.agency_id: WeichertArubaSpider,
    ColdwellBankerArubaSpider.agency_id: ColdwellBankerArubaSpider,
    MpgArubaSpider.agency_id: MpgArubaSpider,
    BhhsArubaSpider.agency_id: BhhsArubaSpider,
}

__all__ = ["SPIDERS", "AllPropertyArubaSpider", "BhhsArubaSpider", "BoldArubaSpider", "BaseSpider", "ColdwellBankerArubaSpider", "KWArubaSpider", "MpgArubaSpider", "RemaxArubaSpider", "SiteBlockedError", "SpiderStats", "WeichertArubaSpider"]
