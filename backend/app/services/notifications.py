"""E-mail notifications. These run as FastAPI background tasks (after the response is sent),
so each opens its own DB session and never raises into the request."""
import logging

from sqlalchemy import select

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import Donation, DonationStatus, Event, EventRegistration
from app.services.emailer import send_email
from app.services.receipts import receipt_pdf

log = logging.getLogger("vdms.notifications")


def send_donation_receipt(donation_id: int) -> None:  # CI-1, Donation.Receipt.Email
    try:
        with SessionLocal() as db:
            d = db.get(Donation, donation_id)
            if d is None or d.status != DonationStatus.COMPLETED:
                return
            body = (
                f"Dear {d.donor.name},\n\n"
                f"Thank you for donating Rs. {d.amount:.2f} to \"{d.campaign.title}\".\n"
                f"Your receipt number is {d.receipt_number}. The receipt is attached.\n\n"
                f"With gratitude,\n{settings.ngo_name}"
            )
            send_email(
                d.donor.email,
                f"Donation receipt {d.receipt_number}",
                body,
                kind="donation_receipt",
                attachment=(f"{d.receipt_number}.pdf", receipt_pdf(d), "application/pdf"),
            )
    except Exception:
        log.exception("Failed to send receipt e-mail for donation %s", donation_id)


def send_event_signup_confirmation(registration_id: int) -> None:  # CI-2
    try:
        with SessionLocal() as db:
            reg = db.get(EventRegistration, registration_id)
            if reg is None:
                return
            ev = reg.event
            body = (
                f"Hi {reg.volunteer.name},\n\n"
                f"You are signed up for \"{ev.title}\" on {ev.event_date:%d/%m/%Y %H:%M} UTC at {ev.location}.\n\n"
                f"Thank you for volunteering!\n{settings.ngo_name}"
            )
            send_email(reg.volunteer.email, f"Sign-up confirmed: {ev.title}", body, kind="event_signup")
    except Exception:
        log.exception("Failed to send sign-up e-mail for registration %s", registration_id)


def send_event_cancellation(event_id: int) -> None:  # Event.Cancel, CI-2
    try:
        with SessionLocal() as db:
            ev = db.get(Event, event_id)
            if ev is None:
                return
            regs = db.scalars(select(EventRegistration).where(EventRegistration.event_id == event_id)).all()
            for reg in regs:
                body = (
                    f"Hi {reg.volunteer.name},\n\n"
                    f"Unfortunately the event \"{ev.title}\" scheduled for {ev.event_date:%d/%m/%Y %H:%M} UTC "
                    f"has been cancelled. We apologise for the inconvenience.\n\n{settings.ngo_name}"
                )
                send_email(reg.volunteer.email, f"Event cancelled: {ev.title}", body, kind="event_cancelled")
    except Exception:
        log.exception("Failed to send cancellation e-mails for event %s", event_id)
