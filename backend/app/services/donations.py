import secrets
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.config import settings
from app.core.errors import AppError, bad_request, conflict, forbidden, not_found
from app.models import Campaign, CampaignStatus, Donation, DonationStatus, Donor, Role, User
from app.schemas.donations import DonationCreate
from app.services.campaigns import get_campaign, sync_campaign
from app.services.locks import critical_section
from app.services.payment import get_gateway


# --- Donor records (Donor.Record.Create) ----------------------------------------------
def _resolve_donor(db: Session, payload: DonationCreate, user: User | None) -> Donor:
    if user is not None and user.role == Role.DONOR:
        donor = db.scalar(select(Donor).where(Donor.user_id == user.id))
        if donor is not None:
            return donor
    if payload.donor is None:
        raise bad_request(
            "DONOR_DETAILS_REQUIRED",
            "Name and e-mail are required to donate without a Donor account",
            field="donor",
        )
    d = payload.donor
    # Guests are matched on (e-mail, name). A guest never attaches to a registered account that
    # merely shares the e-mail; that situation is surfaced to admins by Donor.Merge.Flag instead.
    existing = db.scalar(
        select(Donor).where(
            Donor.user_id.is_(None),
            func.lower(Donor.email) == d.email,
            func.lower(Donor.name) == d.name.lower(),
        )
    )
    if existing is not None:
        if d.phone_number and not existing.phone_number:
            existing.phone_number = d.phone_number
        return existing
    donor = Donor(name=d.name, email=d.email, phone_number=d.phone_number, is_registered=False)
    db.add(donor)
    db.flush()
    return donor


def _new_pending(db: Session, donor: Donor, campaign: Campaign, payload_amount, method, pan, retry_of=None) -> Donation:
    donation = Donation(
        donor_id=donor.donor_id,
        campaign_id=campaign.campaign_id,
        amount=payload_amount,
        payment_method=method,
        status=DonationStatus.PENDING,
        pan_tax_id=pan,
        retry_of_id=retry_of,
        access_token=secrets.token_urlsafe(32),
    )
    db.add(donation)
    db.flush()
    return donation


def _ensure_accepting(db: Session, campaign: Campaign) -> None:
    if sync_campaign(campaign):
        db.commit()
    if campaign.status != CampaignStatus.ACTIVE:  # BR-3
        raise conflict("CAMPAIGN_NOT_ACTIVE", "This campaign is not accepting donations")


# --- Donation.Initiate -------------------------------------------------------------------
def initiate_donation(db: Session, payload: DonationCreate, user: User | None) -> Donation:
    campaign = get_campaign(db, payload.campaign_id)
    _ensure_accepting(db, campaign)
    if payload.amount > settings.max_single_donation:  # Donation.Amount.Validate
        raise bad_request(
            "DONATION_LIMIT_EXCEEDED",
            f"The maximum single donation is {settings.max_single_donation:.2f} {settings.currency}",
            field="amount",
        )
    donor = _resolve_donor(db, payload, user)
    donation = _new_pending(db, donor, campaign, payload.amount, payload.payment_method, payload.pan_tax_id)
    db.commit()
    return donation


# --- Access control for the guest-capable flow endpoints -----------------------------------
def get_donation_for_caller(
    db: Session, donation_id: int, user: User | None, token: str | None, *, admin_ok: bool = False
) -> Donation:
    donation = db.get(Donation, donation_id)
    if donation is None:
        raise not_found("Donation")
    if token and secrets.compare_digest(token, donation.access_token):
        return donation
    if user is not None:
        if admin_ok and user.role == Role.ADMIN:
            return donation
        if donation.donor.user_id == user.id:  # SE-5: only your own donations
            return donation
    if user is None and not token:
        raise AppError(401, "NOT_AUTHENTICATED", "Log in or provide the donation access token")
    raise forbidden("You do not have access to this donation")


# --- Donation.Process.* ------------------------------------------------------------------------
def make_receipt_number(donation: Donation, when: datetime) -> str:
    return f"RCP-{when:%Y%m%d}-{donation.donation_id:06d}"


def confirm_donation(db: Session, donation: Donation, forced_outcome: str | None) -> Donation:
    with critical_section:
        campaign = get_campaign(db, donation.campaign_id, lock=True)
        db.refresh(donation)  # re-read under the lock: guards against a double-submitted confirm
        if donation.status != DonationStatus.PENDING:
            raise conflict("DONATION_NOT_PENDING", f"This donation is already {donation.status.value}")

        if sync_campaign(campaign) or campaign.status != CampaignStatus.ACTIVE:
            donation.status = DonationStatus.FAILED
            donation.failure_reason = "Campaign is no longer accepting donations"
            db.commit()
            raise conflict("CAMPAIGN_NOT_ACTIVE", "This campaign is no longer accepting donations")

        result = get_gateway().authorize_and_capture(donation.amount, donation.payment_method, forced_outcome)
        donation.payment_reference = result.reference
        if result.success:
            now = utcnow()
            donation.status = DonationStatus.COMPLETED
            donation.completed_at = now
            donation.receipt_number = make_receipt_number(donation, now)
            campaign.amount_raised = campaign.amount_raised + donation.amount  # Campaign.Progress.Update
            sync_campaign(campaign)  # goal reached -> auto-close
        else:
            donation.status = DonationStatus.FAILED  # Donation.Process.Failure: total untouched
            donation.failure_reason = result.message
        db.commit()
    return donation


def cancel_donation(db: Session, donation: Donation) -> Donation:
    with critical_section:
        db.refresh(donation)
        if donation.status != DonationStatus.PENDING:
            raise conflict("DONATION_NOT_PENDING", f"Only a pending donation can be cancelled (it is {donation.status.value})")
        donation.status = DonationStatus.FAILED  # BR-2 has no 'cancelled' state
        donation.failure_reason = "Cancelled by donor"
        db.commit()
    return donation


def retry_donation(db: Session, failed: Donation) -> Donation:
    """Fig. 4: a Donor may retry from Failed, creating a *new* Pending attempt."""
    if failed.status != DonationStatus.FAILED:
        raise conflict("DONATION_NOT_FAILED", "Only a failed donation can be retried")
    campaign = get_campaign(db, failed.campaign_id)
    _ensure_accepting(db, campaign)
    new = _new_pending(
        db, failed.donor, campaign, failed.amount, failed.payment_method, failed.pan_tax_id, retry_of=failed.donation_id
    )
    db.commit()
    return new


def require_completed(donation: Donation) -> None:
    if donation.status != DonationStatus.COMPLETED:
        raise conflict("RECEIPT_NOT_AVAILABLE", "A receipt is only available for completed donations")
