from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.campaigns import CampaignOut
from app.schemas.common import MoneyOut, ORMModel, PersonName, Phone
from app.schemas.donations import DonationOut


class DonorOut(ORMModel):
    donor_id: int
    name: str
    email: str
    phone_number: str | None = None
    is_registered: bool
    created_at: datetime


class DonorUpdate(BaseModel):
    name: PersonName | None = None
    phone_number: Phone | None = None


class DonorSummary(DonorOut):
    """Admin list row: donor + lifetime totals (completed donations only)."""

    total_donated: MoneyOut
    donation_count: int


class CampaignContribution(BaseModel):
    campaign_id: int
    campaign_title: str
    total_amount: MoneyOut
    donation_count: int
    last_donation_date: datetime


class DonorDetail(DonorSummary):
    """Donor.Record.View: every campaign contributed to, with amounts and dates."""

    by_campaign: list[CampaignContribution]
    donations: list[DonationOut]


class DuplicateGroup(BaseModel):
    """Donor.Merge.Flag: several donor records sharing one e-mail address."""

    email: str
    donors: list[DonorSummary]


class MergeDonorsRequest(BaseModel):
    primary_donor_id: int
    duplicate_donor_ids: list[int] = Field(min_length=1)


class DonorDashboard(BaseModel):
    donor: DonorSummary
    recent_donations: list[DonationOut]
    featured_campaigns: list[CampaignOut]
