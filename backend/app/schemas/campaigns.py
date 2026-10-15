from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, ValidationInfo, computed_field, field_validator

from app.models.enums import CampaignCloseReason, CampaignStatus
from app.schemas.common import LongText, MoneyIn, MoneyOut, ORMModel, ShortText


def _check_end_after_start(end: date, info: ValidationInfo) -> date:
    start = info.data.get("start_date")
    if start is not None and end <= start:
        raise ValueError("End date must be later than the start date")
    return end


class CampaignCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: LongText
    category: ShortText = Field(examples=["education"])
    goal_amount: MoneyIn
    start_date: date
    end_date: date

    _check_dates = field_validator("end_date")(_check_end_after_start)


class CampaignUpdate(BaseModel):
    """All optional. Draft: any field. Active: only description and end_date (Campaign.Edit)."""

    title: str | None = Field(default=None, min_length=1, max_length=100)
    description: LongText | None = None
    category: ShortText | None = None
    goal_amount: MoneyIn | None = None
    start_date: date | None = None
    end_date: date | None = None


class CampaignOut(ORMModel):
    campaign_id: int
    title: str
    description: str
    category: str
    goal_amount: MoneyOut
    amount_raised: MoneyOut
    start_date: date
    end_date: date
    status: CampaignStatus
    closed_reason: CampaignCloseReason | None = None
    created_at: datetime
    published_at: datetime | None = None
    closed_at: datetime | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def progress_percent(self) -> float:
        if not self.goal_amount:
            return 0.0
        return round(float(self.amount_raised / self.goal_amount * 100), 1)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def amount_remaining(self) -> MoneyOut:
        return max(self.goal_amount - self.amount_raised, Decimal("0.00"))
