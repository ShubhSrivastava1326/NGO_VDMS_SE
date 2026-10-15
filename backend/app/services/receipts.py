"""Donation.Receipt.Generate: on-screen (JSON) and PDF receipts."""
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.config import settings
from app.models import Donation
from app.schemas.donations import ReceiptOut


def build_receipt(donation: Donation) -> ReceiptOut:
    return ReceiptOut(
        receipt_number=donation.receipt_number or "",
        ngo_name=settings.ngo_name,
        donor_name=donation.donor.name,
        donor_email=donation.donor.email,
        pan_tax_id=donation.pan_tax_id,
        amount=donation.amount,
        currency=settings.currency,
        campaign_title=donation.campaign.title,
        payment_method=donation.payment_method,
        payment_reference=donation.payment_reference,
        donation_date=donation.completed_at or donation.donation_date,
    )


def receipt_pdf(donation: Donation) -> bytes:
    r = build_receipt(donation)
    styles = getSampleStyleSheet()
    title = ParagraphStyle("t", parent=styles["Title"], fontSize=20, spaceAfter=4)
    sub = ParagraphStyle("s", parent=styles["Normal"], textColor=colors.grey, alignment=1, spaceAfter=14)

    rows = [
        ["Receipt No.", r.receipt_number],
        ["Date", r.donation_date.strftime("%d/%m/%Y %H:%M UTC")],
        ["Donor", r.donor_name],
        ["E-mail", r.donor_email],
        ["PAN / Tax ID", r.pan_tax_id or "-"],
        ["Campaign", r.campaign_title],
        ["Payment method", r.payment_method.value.replace("_", " ").title()],
        ["Payment reference", r.payment_reference or "-"],
        ["Amount", f"Rs. {r.amount:.2f} ({r.currency})"],
    ]
    table = Table(rows, colWidths=[45 * mm, 115 * mm])
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (1, -1), (1, -1), "Helvetica-Bold"),
                ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.lightgrey),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title=f"Receipt {r.receipt_number}", author=r.ngo_name)
    doc.build(
        [
            Paragraph(r.ngo_name, title),
            Paragraph("Donation Receipt", sub),
            table,
            Spacer(1, 12 * mm),
            Paragraph(
                "Thank you for your generous contribution. This is a system-generated receipt "
                "(simulated payment - no real transaction took place in this release).",
                styles["Italic"],
            ),
        ]
    )
    return buf.getvalue()
