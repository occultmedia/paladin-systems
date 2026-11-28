"""
Aruba notary auctions (Baseline Pro): foreclosure and voluntary public
auctions, and tenders, from the five civil-law notary offices' own sites.
See __main__.py to run, sites.py for the offices, pipeline.py for storing,
alerts.py for the "Track auction date" reminders.
"""

from .sites import NOTARY_SPIDERS

__all__ = ["NOTARY_SPIDERS"]
