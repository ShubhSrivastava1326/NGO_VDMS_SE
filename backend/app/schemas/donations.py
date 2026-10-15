from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import DonationStatus, PaymentMethod
from app.schemas.common import Email, MoneyIn, MoneyOut, ORMModel, PanTaxId, PersonName, Phone


class GuestDonorDetails(BaseModel):
    """Required when donating without being logged in as a Donor (Donation.Guest)."""

    name: PersonName
    email: Email
    phone_number: Phone | None = None


class DonationCreate(BaseModel):
    campaign_id: int
    amount: MoneyIn
    payment_method: PaymentMethod
    donor: GuestDonorDetails | None = Field(
        default=None,
        description="Required for guests. Ignored when logged in as a Donor (profile is used instead).",
    )
    pan_tax_id: PanTaxId | None = Field(default=None, description="Optional; printed on the receipt")


class ConfirmDonationRequest(BaseModel):
    simulate_outcome: Literal["success", "failure"] | None = Field(
        default=None,
        description="Demo/testing only: force the simulated payment result "
        "(ignored when PAYMENT_ALLOW_FORCED_OUTCOME=false)",
    )


class DonationOut(ORMModel):
    donation_id: int
    campaign_id: int
    campaign_title: str
    donor_id: int
    donor_name: str
    amount: MoneyOut
    payment_method: PaymentMethod
    status: DonationStatus
    receipt_number: str | None = None
    donation_date: datetime
    completed_at: datetime | None = None
    failure_reason: str | None = None
    retry_of_id: int | None = None


class DonationConfirmationSummary(BaseModel):
    """What the Donor sees on the 'please confirm' screen (Donation.Confirm)."""

    campaign_title: str
    amount: MoneyOut
    payment_method: PaymentMethod
    donor_name: str


class DonationInitiated(BaseModel):
    donation: DonationOut
    confirmation: DonationConfirmationSummary
    access_token: str = Field(
        description="Secret for this donation. Send as the X-Donation-Token header (or ?token=) on "
        "confirm/cancel/retry/receipt calls. Required for guests; logged-in donors may use their JWT instead."
    )


class ReceiptOut(BaseModel):
    receipt_number: str
    ngo_name: str
    donor_name: str
    donor_email: str
    pan_tax_id: str | None
    amount: MoneyOut
    currency: str
    campaign_title: str
    payment_method: PaymentMethod
    payment_reference: str | None
    donation_date: datetime
