"""Static / configuration data the frontend needs to render forms and the help page."""
from decimal import Decimal

from pydantic import BaseModel
from fastapi import APIRouter

from app.core.config import settings
from app.models import (
    AttendanceStatus,
    CampaignStatus,
    DonationStatus,
    EventStatus,
    PaymentMethod,
    VolunteerStatus,
)
from app.schemas.common import MoneyOut

router = APIRouter(prefix="/meta", tags=["Meta"])


class MetaConfig(BaseModel):
    ngo_name: str
    currency: str
    max_single_donation: MoneyOut
    payment_methods: list[str]
    campaign_statuses: list[str]
    donation_statuses: list[str]
    event_statuses: list[str]
    volunteer_statuses: list[str]
    attendance_statuses: list[str]
    suggested_campaign_categories: list[str]
    suggested_utilization_categories: list[str]
    suggested_volunteer_interests: list[str]
    payment_simulation_allows_forced_outcome: bool


class FaqItem(BaseModel):
    topic: str
    question: str
    answer: str


@router.get("/config", response_model=MetaConfig, summary="Enums, limits and suggestion lists for forms")
def config() -> MetaConfig:
    return MetaConfig(
        ngo_name=settings.ngo_name,
        currency=settings.currency,
        max_single_donation=Decimal(settings.max_single_donation),
        payment_methods=[m.value for m in PaymentMethod],
        campaign_statuses=[s.value for s in CampaignStatus],
        donation_statuses=[s.value for s in DonationStatus],
        event_statuses=[s.value for s in EventStatus],
        volunteer_statuses=[s.value for s in VolunteerStatus],
        attendance_statuses=[s.value for s in AttendanceStatus],
        suggested_campaign_categories=["education", "healthcare", "disaster relief", "food & nutrition", "environment"],
        suggested_utilization_categories=["supplies", "logistics", "beneficiary disbursement", "venue", "administration"],
        suggested_volunteer_interests=["logistics", "teaching", "fundraising", "medical aid", "event management", "photography"],
        payment_simulation_allows_forced_outcome=settings.payment_allow_forced_outcome,
    )


FAQ = [
    FaqItem(
        topic="Donating",
        question="How do I donate?",
        answer="Open an active campaign, enter the amount and your details (no account needed), choose a payment "
        "method, confirm, and your receipt is shown straight away and e-mailed to you.",
    ),
    FaqItem(
        topic="Donating",
        question="Is my payment real?",
        answer="No. In this release payments are simulated for demonstration; no money is charged.",
    ),
    FaqItem(
        topic="Donating",
        question="My payment failed. What now?",
        answer="You can retry with one click or cancel. A failed attempt never counts towards the campaign total.",
    ),
    FaqItem(
        topic="Volunteering",
        question="How do I become a volunteer?",
        answer="Register with your name, e-mail, phone number and areas of interest. An admin will review and approve "
        "your account before you can sign up for events.",
    ),
    FaqItem(
        topic="Volunteering",
        question="How do I sign up for an event?",
        answer="After approval, open Events, pick one with open slots and press Sign up. You will get a confirmation "
        "e-mail, and you can see your tasks under My Tasks.",
    ),
    FaqItem(
        topic="Volunteering",
        question="Can I withdraw from an event?",
        answer="Yes, any time before it starts, which frees your slot for another volunteer.",
    ),
]


@router.get("/faq", response_model=list[FaqItem], summary="On-screen help / FAQ content")
def faq():
    return FAQ
