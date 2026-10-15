from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.enums import CampaignStatus
from app.schemas.common import LongText, MoneyIn, MoneyOut, ORMModel, ShortText
from app.schemas.donations import DonationOut


class UtilizationCreate(BaseModel):
    category: ShortText = Field(examples=["supplies"])
    amount: MoneyIn
    description: LongText
    reference_number: ShortText = Field(description="Invoice / voucher number", examples=["INV-2026-0042"])
    utilization_date: date | None = Field(default=None, description="Date money was spent; defaults to today")


class UtilizationOut(ORMModel):
    utilization_id: int
    campaign_id: int
    category: str
    amount: MoneyOut
    description: str
    reference_number: str
    utilization_date: date
    recorded_by: int
    recorded_by_name: str
    recorded_date: datetime


class CategoryBreakdown(BaseModel):
    category: str
    amount: MoneyOut
    entries: int
    percent_of_utilized: float


class FundReport(BaseModel):
    campaign_id: int
    campaign_title: str
    campaign_status: CampaignStatus
    total_raised: MoneyOut
    total_utilized: MoneyOut
    remaining_balance: MoneyOut
    breakdown: list[CategoryBreakdown]
    entries: list[UtilizationOut]
    generated_at: datetime


class CampaignCounts(BaseModel):
    draft: int
    active: int
    closed: int


class AdminDashboard(BaseModel):
    """Fund.Report.Dashboard + the quick stats an admin needs on the landing page."""

    total_raised: MoneyOut
    total_utilized: MoneyOut
    total_remaining: MoneyOut
    campaigns: CampaignCounts
    total_donors: int
    pending_volunteers: int
    approved_volunteers: int
    upcoming_events: int
    recent_donations: list[DonationOut]
