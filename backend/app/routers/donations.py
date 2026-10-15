"""Donation flow (3.3). Works for guests and logged-in donors.

    POST /donations                 -> pending donation + confirmation summary + access_token
    POST /donations/{id}/confirm    -> runs the simulated payment -> completed | failed
    POST /donations/{id}/retry      -> after a failure: new pending attempt
    POST /donations/{id}/cancel     -> abandon a pending donation
    GET  /donations/{id}/receipt[.pdf]
"""
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Header, Query, Response

from app.core.deps import DB, OptionalUser
from app.models import Donation, DonationStatus
from app.schemas.donations import (
    ConfirmDonationRequest,
    DonationConfirmationSummary,
    DonationCreate,
    DonationInitiated,
    DonationOut,
    ReceiptOut,
)
from app.services import donations as svc
from app.services.notifications import send_donation_receipt
from app.services.receipts import build_receipt, receipt_pdf

router = APIRouter(prefix="/donations", tags=["Donations"])

TokenHeader = Annotated[str | None, Header(alias="X-Donation-Token", description="Guest access token")]
TokenQuery = Annotated[str | None, Query(alias="token", description="Same as X-Donation-Token (for download links)")]


def _initiated(donation: Donation) -> DonationInitiated:
    return DonationInitiated(
        donation=DonationOut.model_validate(donation),
        confirmation=DonationConfirmationSummary(
            campaign_title=donation.campaign.title,
            amount=donation.amount,
            payment_method=donation.payment_method,
            donor_name=donation.donor.name,
        ),
        access_token=donation.access_token,
    )


@router.post(
    "",
    response_model=DonationInitiated,
    status_code=201,
    summary="Start a donation (status 'pending'); show the confirmation summary next",
)
def create_donation(payload: DonationCreate, db: DB, user: OptionalUser):
    return _initiated(svc.initiate_donation(db, payload, user))


@router.get("/{donation_id}", response_model=DonationOut, summary="Donation status (owner, token holder or admin)")
def get_donation(donation_id: int, db: DB, user: OptionalUser, h_token: TokenHeader = None, q_token: TokenQuery = None):
    return svc.get_donation_for_caller(db, donation_id, user, h_token or q_token, admin_ok=True)


@router.post(
    "/{donation_id}/confirm",
    response_model=DonationOut,
    summary="Confirm & process the (simulated) payment. Returns the donation with status completed/failed",
)
def confirm_donation(
    donation_id: int,
    db: DB,
    user: OptionalUser,
    background: BackgroundTasks,
    body: ConfirmDonationRequest | None = None,
    h_token: TokenHeader = None,
    q_token: TokenQuery = None,
):
    donation = svc.get_donation_for_caller(db, donation_id, user, h_token or q_token)
    donation = svc.confirm_donation(db, donation, body.simulate_outcome if body else None)
    if donation.status == DonationStatus.COMPLETED:
        background.add_task(send_donation_receipt, donation.donation_id)  # Donation.Receipt.Email
    return DonationOut.model_validate(donation)


@router.post("/{donation_id}/cancel", response_model=DonationOut, summary="Cancel a pending donation")
def cancel_donation(donation_id: int, db: DB, user: OptionalUser, h_token: TokenHeader = None, q_token: TokenQuery = None):
    donation = svc.get_donation_for_caller(db, donation_id, user, h_token or q_token)
    return DonationOut.model_validate(svc.cancel_donation(db, donation))


@router.post(
    "/{donation_id}/retry",
    response_model=DonationInitiated,
    status_code=201,
    summary="Retry a failed donation: creates a NEW pending donation (with its own access_token)",
)
def retry_donation(donation_id: int, db: DB, user: OptionalUser, h_token: TokenHeader = None, q_token: TokenQuery = None):
    failed = svc.get_donation_for_caller(db, donation_id, user, h_token or q_token)
    return _initiated(svc.retry_donation(db, failed))


@router.get("/{donation_id}/receipt", response_model=ReceiptOut, summary="Receipt data (completed donations only)")
def get_receipt(donation_id: int, db: DB, user: OptionalUser, h_token: TokenHeader = None, q_token: TokenQuery = None):
    donation = svc.get_donation_for_caller(db, donation_id, user, h_token or q_token, admin_ok=True)
    svc.require_completed(donation)
    return build_receipt(donation)


@router.get(
    "/{donation_id}/receipt.pdf",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    summary="Receipt as a PDF download",
)
def get_receipt_pdf(donation_id: int, db: DB, user: OptionalUser, h_token: TokenHeader = None, q_token: TokenQuery = None):
    donation = svc.get_donation_for_caller(db, donation_id, user, h_token or q_token, admin_ok=True)
    svc.require_completed(donation)
    return Response(
        content=receipt_pdf(donation),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{donation.receipt_number}.pdf"'},
    )

