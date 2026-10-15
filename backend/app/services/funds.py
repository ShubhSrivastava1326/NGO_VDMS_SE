import csv
from collections import OrderedDict
from decimal import Decimal
from io import BytesIO, StringIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.clock import local_today, utcnow
from app.core.config import settings
from app.core.errors import AppError, conflict
from app.models import (
    Campaign,
    CampaignStatus,
    Donation,
    DonationStatus,
    Donor,
    Event,
    EventStatus,
    FundUtilization,
    User,
    Volunteer,
    VolunteerStatus,
)
from app.schemas.funds import (
    AdminDashboard,
    CampaignCounts,
    CategoryBreakdown,
    FundReport,
    UtilizationCreate,
    UtilizationOut,
)
from app.schemas.donations import DonationOut
from app.services.audit import log_action
from app.services.campaigns import get_campaign, sync_all_campaigns
from app.services.locks import critical_section

ZERO = Decimal("0.00")


def total_utilized(db: Session, campaign_id: int) -> Decimal:
    value = db.scalar(select(func.sum(FundUtilization.amount)).where(FundUtilization.campaign_id == campaign_id))
    return value or ZERO


def record_utilization(db: Session, admin: User, campaign_id: int, data: UtilizationCreate) -> FundUtilization:
    with critical_section:
        campaign = get_campaign(db, campaign_id, lock=True)
        if campaign.status == CampaignStatus.DRAFT:
            raise conflict("CAMPAIGN_NOT_STARTED", "Funds can only be recorded against an Active or Closed campaign")

        used = total_utilized(db, campaign_id)
        remaining = campaign.amount_raised - used
        if data.amount > remaining:  # Fund.Utilization.Validate / BR-4
            raise AppError(
                400,
                "UTILIZATION_EXCEEDS_RAISED",
                f"Amount exceeds the remaining balance of {remaining:.2f} {settings.currency} "
                f"(raised {campaign.amount_raised:.2f}, already utilized {used:.2f})",
                errors=[{"field": "amount", "message": f"Maximum allowed is {remaining:.2f}"}],
            )

        entry = FundUtilization(
            campaign_id=campaign_id,
            category=data.category,
            amount=data.amount,
            description=data.description,
            reference_number=data.reference_number,
            utilization_date=data.utilization_date or local_today(),
            recorded_by=admin.id,
        )
        db.add(entry)
        db.flush()
        log_action(  # SE-6: audit trail with admin id + timestamp
            db, admin, "fund.utilization", "fund_utilization", entry.utilization_id,
            {
                "campaign_id": campaign_id,
                "amount": f"{data.amount:.2f}",
                "category": data.category,
                "reference_number": data.reference_number,
            },
        )
        db.commit()
    return entry


def list_utilizations(db: Session, campaign_id: int) -> list[FundUtilization]:
    get_campaign(db, campaign_id)
    return list(
        db.scalars(
            select(FundUtilization)
            .where(FundUtilization.campaign_id == campaign_id)
            .order_by(FundUtilization.utilization_date.desc(), FundUtilization.utilization_id.desc())
        ).all()
    )


def build_report(db: Session, campaign_id: int) -> FundReport:  # Fund.Report.Campaign
    campaign = get_campaign(db, campaign_id)
    entries = list_utilizations(db, campaign_id)
    used = sum((e.amount for e in entries), ZERO)

    groups: OrderedDict[str, list[FundUtilization]] = OrderedDict()
    for e in entries:
        groups.setdefault(e.category, []).append(e)
    breakdown = [
        CategoryBreakdown(
            category=cat,
            amount=sum((e.amount for e in items), ZERO),
            entries=len(items),
            percent_of_utilized=round(float(sum((e.amount for e in items), ZERO) / used * 100), 1) if used else 0.0,
        )
        for cat, items in groups.items()
    ]
    breakdown.sort(key=lambda b: b.amount, reverse=True)

    return FundReport(
        campaign_id=campaign.campaign_id,
        campaign_title=campaign.title,
        campaign_status=campaign.status,
        total_raised=campaign.amount_raised,
        total_utilized=used,
        remaining_balance=campaign.amount_raised - used,
        breakdown=breakdown,
        entries=[UtilizationOut.model_validate(e) for e in entries],
        generated_at=utcnow(),
    )


def report_csv(report: FundReport) -> bytes:  # Fund.Report.Export (CSV)
    out = StringIO()
    w = csv.writer(out)
    w.writerow(["Fund utilization report"])
    w.writerow(["Campaign", report.campaign_title])
    w.writerow(["Status", report.campaign_status.value])
    w.writerow(["Total raised", f"{report.total_raised:.2f}"])
    w.writerow(["Total utilized", f"{report.total_utilized:.2f}"])
    w.writerow(["Remaining balance", f"{report.remaining_balance:.2f}"])
    w.writerow([])
    w.writerow(["Category", "Amount", "Entries", "% of utilized"])
    for b in report.breakdown:
        w.writerow([b.category, f"{b.amount:.2f}", b.entries, b.percent_of_utilized])
    w.writerow([])
    w.writerow(["Date", "Category", "Amount", "Reference", "Description", "Recorded by"])
    for e in report.entries:
        w.writerow(
            [e.utilization_date.isoformat(), e.category, f"{e.amount:.2f}", e.reference_number, e.description, e.recorded_by_name]
        )
    return ("﻿" + out.getvalue()).encode("utf-8")  # BOM so Excel reads UTF-8 correctly


def report_pdf(report: FundReport) -> bytes:  # Fund.Report.Export (PDF)
    styles = getSampleStyleSheet()
    story = [
        Paragraph(settings.ngo_name, styles["Title"]),
        Paragraph(f"Fund Utilization Report - {report.campaign_title}", styles["Heading2"]),
        Spacer(1, 4 * mm),
    ]
    summary = Table(
        [
            ["Total raised", f"Rs. {report.total_raised:.2f}"],
            ["Total utilized", f"Rs. {report.total_utilized:.2f}"],
            ["Remaining balance", f"Rs. {report.remaining_balance:.2f}"],
        ],
        colWidths=[55 * mm, 60 * mm],
    )
    summary.setStyle(TableStyle([("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"), ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.lightgrey)]))
    story += [summary, Spacer(1, 6 * mm), Paragraph("Category-wise breakdown", styles["Heading3"])]

    def _grid(rows, widths):
        t = Table(rows, colWidths=widths, repeatRows=1)
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EEF4")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
                ]
            )
        )
        return t

    if not report.entries:
        story.append(Paragraph("No fund utilization has been recorded for this campaign yet.", styles["Italic"]))
    else:
        story.append(
            _grid(
                [["Category", "Amount (Rs.)", "Entries", "% of utilized"]]
                + [[b.category, f"{b.amount:.2f}", b.entries, f"{b.percent_of_utilized}%"] for b in report.breakdown],
                [60 * mm, 40 * mm, 25 * mm, 35 * mm],
            )
        )
        story += [Spacer(1, 6 * mm), Paragraph("Entries", styles["Heading3"])]
        story.append(
            _grid(
                [["Date", "Category", "Amount (Rs.)", "Reference", "Recorded by"]]
                + [
                    [e.utilization_date.strftime("%d/%m/%Y"), e.category, f"{e.amount:.2f}", e.reference_number, e.recorded_by_name]
                    for e in report.entries
                ],
                [24 * mm, 36 * mm, 32 * mm, 38 * mm, 34 * mm],
            )
        )
    buf = BytesIO()
    SimpleDocTemplate(buf, pagesize=A4, title=f"Fund report - {report.campaign_title}").build(story)
    return buf.getvalue()


def admin_dashboard(db: Session) -> AdminDashboard:  # Fund.Report.Dashboard
    sync_all_campaigns(db)
    raised = db.scalar(select(func.sum(Campaign.amount_raised))) or ZERO
    utilized = db.scalar(select(func.sum(FundUtilization.amount))) or ZERO
    counts = dict(db.execute(select(Campaign.status, func.count()).group_by(Campaign.status)).all())

    def vol_count(status: VolunteerStatus) -> int:
        return db.scalar(select(func.count()).select_from(Volunteer).where(Volunteer.status == status)) or 0

    recent = db.scalars(
        select(Donation)
        .where(Donation.status == DonationStatus.COMPLETED)
        .order_by(Donation.completed_at.desc())
        .limit(5)
    ).all()
    return AdminDashboard(
        total_raised=raised,
        total_utilized=utilized,
        total_remaining=raised - utilized,
        campaigns=CampaignCounts(
            draft=counts.get(CampaignStatus.DRAFT, 0),
            active=counts.get(CampaignStatus.ACTIVE, 0),
            closed=counts.get(CampaignStatus.CLOSED, 0),
        ),
        total_donors=db.scalar(select(func.count()).select_from(Donor)) or 0,
        pending_volunteers=vol_count(VolunteerStatus.PENDING),
        approved_volunteers=vol_count(VolunteerStatus.APPROVED),
        upcoming_events=db.scalar(
            select(func.count()).select_from(Event).where(Event.status == EventStatus.PUBLISHED, Event.event_date > utcnow())
        )
        or 0,
        recent_donations=[DonationOut.model_validate(d) for d in recent],
    )
