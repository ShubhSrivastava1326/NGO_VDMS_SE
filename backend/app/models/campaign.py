from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.clock import utcnow
from app.db.session import Base
from app.db.types import Money, UTCDateTime
from app.models.enums import (
    CampaignCloseReason,
    CampaignStatus,
    DonationStatus,
    PaymentMethod,
    enum_col,
)
from app.models.user import Donor


class Campaign(Base):
    __tablename__ = "campaigns"
    __table_args__ = (
        CheckConstraint("goal_amount > 0", name="ck_campaign_goal_positive"),
        CheckConstraint("end_date > start_date", name="ck_campaign_dates"),
    )

    campaign_id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(60), index=True)
    goal_amount: Mapped[Decimal] = mapped_column(Money)
    amount_raised: Mapped[Decimal] = mapped_column(Money, default=Decimal("0.00"))
    start_date: Mapped[date]
    end_date: Mapped[date]
    status: Mapped[CampaignStatus] = mapped_column(
        enum_col(CampaignStatus), default=CampaignStatus.DRAFT, index=True
    )
    closed_reason: Mapped[CampaignCloseReason | None] = mapped_column(
        enum_col(CampaignCloseReason), nullable=True
    )
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    published_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)


class Donation(Base):
    __tablename__ = "donations"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_donation_amount_positive"),
        Index("ix_donations_campaign_status", "campaign_id", "status"),
    )

    donation_id: Mapped[int] = mapped_column(primary_key=True)
    donor_id: Mapped[int] = mapped_column(ForeignKey("donors.donor_id"), index=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("campaigns.campaign_id"))
    amount: Mapped[Decimal] = mapped_column(Money)
    payment_method: Mapped[PaymentMethod] = mapped_column(enum_col(PaymentMethod))
    status: Mapped[DonationStatus] = mapped_column(
        enum_col(DonationStatus), default=DonationStatus.PENDING, index=True
    )
    receipt_number: Mapped[str | None] = mapped_column(String(40), unique=True, nullable=True)
    donation_date: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(String(200), nullable=True)
    pan_tax_id: Mapped[str | None] = mapped_column(String(20), nullable=True)
    payment_reference: Mapped[str | None] = mapped_column(String(60), nullable=True)
    retry_of_id: Mapped[int | None] = mapped_column(ForeignKey("donations.donation_id"), nullable=True)
    # Secret returned once at creation so guests (no account) can confirm/cancel/fetch the receipt.
    access_token: Mapped[str] = mapped_column(String(64))

    donor: Mapped[Donor] = relationship(lazy="joined")
    campaign: Mapped[Campaign] = relationship(lazy="joined")

    @property
    def campaign_title(self) -> str:
        return self.campaign.title

    @property
    def donor_name(self) -> str:
        return self.donor.name
