"""E-mail sending (SI-1, DE-1).

If SMTP_HOST is not configured the message is *not* sent; it is logged and recorded in the
email_logs table with status "skipped", so the app works in the lab with no mail server
("where an e-mail service is configured", Donation.Receipt.Email).
"""
import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import EmailLog

log = logging.getLogger("vdms.email")


def send_email(
    to_email: str,
    subject: str,
    body: str,
    kind: str,
    attachment: tuple[str, bytes, str] | None = None,
) -> str:
    """attachment = (filename, content, mime 'type/subtype'). Returns sent | skipped | failed."""
    status, error = "skipped", None

    if settings.smtp_host:
        msg = EmailMessage()
        msg["From"] = settings.email_from
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.set_content(body)
        if attachment:
            filename, content, mime = attachment
            maintype, _, subtype = mime.partition("/")
            msg.add_attachment(content, maintype=maintype, subtype=subtype, filename=filename)
        try:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
                if settings.smtp_use_tls:
                    smtp.starttls()
                if settings.smtp_username:
                    smtp.login(settings.smtp_username, settings.smtp_password)
                smtp.send_message(msg)
            status = "sent"
        except Exception as exc:  # never let mail problems break a request
            status, error = "failed", str(exc)[:500]
            log.warning("E-mail to %s failed: %s", to_email, exc)
    else:
        log.info("[email skipped - SMTP not configured] to=%s subject=%s", to_email, subject)

    with SessionLocal() as db:
        db.add(EmailLog(to_email=to_email, subject=subject[:200], kind=kind, status=status, error=error))
        db.commit()
    return status
