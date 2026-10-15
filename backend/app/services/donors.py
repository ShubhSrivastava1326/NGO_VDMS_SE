from decimal import Decimal

from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from app.core.errors import bad_request, conflict, not_found
from app.models import Donation, DonationStatus, Donor, User
from app.schemas.donations import DonationOut
from app.schemas.donors import (
    CampaignContribution,
    DonorDetail,
    DonorOut,
    DonorSummary,
    DonorUpdate,
    DuplicateGroup,
    MergeDonorsRequest,
)
from app.services.audit import log_action

ZERO = Decimal("0.00")


def _totals_subquery():
    return (
        select(
            Donation.donor_id.label("donor_id"),
            func.sum(Donation.amount).label("total"),
            func.count().label("cnt"),
        )
        .where(Donation.status == DonationStatus.COMPLETED)
        .group_by(Donation.donor_id)
        .subquery()
    )


def _summary(donor: Donor, total, cnt) -> DonorSummary:
    return DonorSummary(
        **DonorOut.model_validate(donor).model_dump(),
        total_donated=total or ZERO,
        donation_count=cnt or 0,
    )


def get_donor(db: Session, donor_id: int) -> Donor:
    donor = db.get(Donor, donor_id)
    if donor is None:
        raise not_found("Donor")
    return donor


def update_profile(db: Session, donor: Donor, data: DonorUpdate) -> Donor:  # Donor.Profile.Edit
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    for name, value in changes.items():
        setattr(donor, name, value)
    if "name" in changes and donor.user_id:
        user = db.get(User, donor.user_id)
        if user:
            user.full_name = changes["name"]
    db.commit()
    return donor


def search_donors(db: Session, q: str | None, offset: int, limit: int) -> tuple[list[DonorSummary], int]:
    """Donor.Record.Search: by name, e-mail or phone number."""
    totals = _totals_subquery()
    base = select(Donor, totals.c.total, totals.c.cnt).outerjoin(totals, totals.c.donor_id == Donor.donor_id)
    if q:
        like = f"%{q.lower()}%"
        base = base.where(
            or_(func.lower(Donor.name).like(like), func.lower(Donor.email).like(like), Donor.phone_number.like(like))
        )
    total = db.scalar(select(func.count()).select_from(base.with_only_columns(Donor.donor_id).subquery())) or 0
    rows = db.execute(base.order_by(Donor.created_at.desc(), Donor.donor_id.desc()).offset(offset).limit(limit)).all()
    return [_summary(d, t, c) for d, t, c in rows], total


def donor_summary(db: Session, donor: Donor) -> DonorSummary:
    totals = _totals_subquery()
    row = db.execute(
        select(totals.c.total, totals.c.cnt).where(totals.c.donor_id == donor.donor_id)
    ).first()
    return _summary(donor, *(row or (None, None)))


def donor_detail(db: Session, donor: Donor) -> DonorDetail:
    """Donor.Record.View: all campaigns contributed to, amounts and dates."""
    summary = donor_summary(db, donor)
    donations = list(
        db.scalars(
            select(Donation).where(Donation.donor_id == donor.donor_id).order_by(Donation.donation_date.desc())
        ).all()
    )
    per_campaign: dict[int, CampaignContribution] = {}
    for d in donations:
        if d.status != DonationStatus.COMPLETED:
            continue
        when = d.completed_at or d.donation_date
        entry = per_campaign.get(d.campaign_id)
        if entry is None:
            per_campaign[d.campaign_id] = CampaignContribution(
                campaign_id=d.campaign_id,
                campaign_title=d.campaign.title,
                total_amount=d.amount,
                donation_count=1,
                last_donation_date=when,
            )
        else:
            entry.total_amount += d.amount
            entry.donation_count += 1
            entry.last_donation_date = max(entry.last_donation_date, when)
    return DonorDetail(
        **summary.model_dump(),
        by_campaign=sorted(per_campaign.values(), key=lambda c: c.last_donation_date, reverse=True),
        donations=[DonationOut.model_validate(d) for d in donations],
    )


def find_duplicates(db: Session) -> list[DuplicateGroup]:
    """Donor.Merge.Flag: records that share an e-mail address (case-insensitive)."""
    dup_emails = db.scalars(
        select(func.lower(Donor.email)).group_by(func.lower(Donor.email)).having(func.count() > 1)
    ).all()
    groups = []
    totals = _totals_subquery()
    for email in sorted(dup_emails):
        rows = db.execute(
            select(Donor, totals.c.total, totals.c.cnt)
            .outerjoin(totals, totals.c.donor_id == Donor.donor_id)
            .where(func.lower(Donor.email) == email)
            .order_by(Donor.donor_id)
        ).all()
        groups.append(DuplicateGroup(email=email, donors=[_summary(d, t, c) for d, t, c in rows]))
    return groups


def merge_donors(db: Session, admin: User, data: MergeDonorsRequest) -> Donor:
    """Admin resolves a duplicate flag: move the duplicates' donations to the primary record."""
    if data.primary_donor_id in data.duplicate_donor_ids:
        raise bad_request("INVALID_MERGE", "The primary donor cannot also be listed as a duplicate")
    primary = get_donor(db, data.primary_donor_id)
    duplicates = [get_donor(db, i) for i in dict.fromkeys(data.duplicate_donor_ids)]
    for dup in duplicates:
        if dup.is_registered:
            raise conflict(
                "CANNOT_MERGE_REGISTERED",
                f"Donor #{dup.donor_id} has a login account and cannot be merged away; choose it as the primary instead",
            )
    for dup in duplicates:
        db.execute(update(Donation).where(Donation.donor_id == dup.donor_id).values(donor_id=primary.donor_id))
        if dup.phone_number and not primary.phone_number:
            primary.phone_number = dup.phone_number
        db.delete(dup)
    log_action(
        db, admin, "donor.merge", "donor", primary.donor_id,
        {"merged_ids": [d.donor_id for d in duplicates]},
    )
    db.commit()
    return primary
