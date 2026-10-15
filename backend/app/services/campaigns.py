from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.clock import local_today, utcnow
from app.core.errors import bad_request, conflict, not_found
from app.models import Campaign, CampaignCloseReason, CampaignStatus, User
from app.schemas.campaigns import CampaignCreate, CampaignUpdate
from app.services.audit import log_action


def get_campaign(db: Session, campaign_id: int, *, lock: bool = False) -> Campaign:
    stmt = select(Campaign).where(Campaign.campaign_id == campaign_id)
    if lock:  # row lock on PostgreSQL; no-op on SQLite
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    campaign = db.scalar(stmt)
    if campaign is None:
        raise not_found("Campaign")
    return campaign


def _close(campaign: Campaign, reason: CampaignCloseReason) -> None:
    campaign.status = CampaignStatus.CLOSED
    campaign.closed_reason = reason
    campaign.closed_at = utcnow()


def sync_campaign(campaign: Campaign) -> bool:
    """Campaign.Close.Auto: close an Active campaign whose goal is reached or end date has passed.
    Mutates the instance; the caller commits. Returns True if it changed."""
    if campaign.status != CampaignStatus.ACTIVE:
        return False
    if campaign.amount_raised >= campaign.goal_amount:
        _close(campaign, CampaignCloseReason.GOAL_REACHED)
        return True
    if local_today() > campaign.end_date:
        _close(campaign, CampaignCloseReason.END_DATE_PASSED)
        return True
    return False


def sync_all_campaigns(db: Session) -> int:
    """Bulk version, run before listings and by the background job."""
    due = db.scalars(
        select(Campaign).where(
            Campaign.status == CampaignStatus.ACTIVE,
            or_(Campaign.end_date < local_today(), Campaign.amount_raised >= Campaign.goal_amount),
        )
    ).all()
    changed = sum(1 for c in due if sync_campaign(c))
    if changed:
        db.commit()
    return changed


def create_campaign(db: Session, admin: User, data: CampaignCreate) -> Campaign:
    campaign = Campaign(
        title=data.title,
        description=data.description,
        category=data.category,
        goal_amount=data.goal_amount,
        start_date=data.start_date,
        end_date=data.end_date,
        status=CampaignStatus.DRAFT,
        created_by=admin.id,
    )
    db.add(campaign)
    db.flush()
    log_action(db, admin, "campaign.create", "campaign", campaign.campaign_id, {"title": campaign.title})
    db.commit()
    return campaign


def update_campaign(db: Session, admin: User, campaign_id: int, data: CampaignUpdate) -> Campaign:
    campaign = get_campaign(db, campaign_id)
    sync_campaign(campaign)
    if campaign.status == CampaignStatus.CLOSED:
        raise conflict("CAMPAIGN_CLOSED", "A closed campaign cannot be edited")

    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    if campaign.status == CampaignStatus.ACTIVE:
        locked = [
            name
            for name in ("title", "category", "goal_amount", "start_date")
            if name in changes and changes[name] != getattr(campaign, name)
        ]
        if locked:
            raise conflict(
                "CAMPAIGN_FIELD_LOCKED",
                f"Only the description and end date can be edited once a campaign is Active "
                f"(locked: {', '.join(locked)})",
            )

    new_start = changes.get("start_date", campaign.start_date)
    new_end = changes.get("end_date", campaign.end_date)
    if new_end <= new_start:
        raise bad_request("INVALID_DATES", "End date must be later than the start date", "end_date")
    if campaign.status == CampaignStatus.ACTIVE and new_end < local_today():
        raise bad_request(
            "INVALID_DATES", "End date cannot be in the past for an Active campaign (close it instead)", "end_date"
        )

    for name, value in changes.items():
        setattr(campaign, name, value)
    log_action(db, admin, "campaign.update", "campaign", campaign.campaign_id, {"fields": sorted(changes)})
    db.commit()
    return campaign


def publish_campaign(db: Session, admin: User, campaign_id: int) -> Campaign:
    campaign = get_campaign(db, campaign_id)
    if campaign.status != CampaignStatus.DRAFT:
        raise conflict("INVALID_STATE", f"Only a Draft campaign can be published (current: {campaign.status.value})")
    if campaign.end_date < local_today():
        raise bad_request(
            "INVALID_DATES", "The end date has already passed; edit the campaign before publishing", "end_date"
        )
    campaign.status = CampaignStatus.ACTIVE
    campaign.published_at = utcnow()
    log_action(db, admin, "campaign.publish", "campaign", campaign.campaign_id)
    db.commit()
    return campaign


def close_campaign_manually(db: Session, admin: User, campaign_id: int) -> Campaign:
    campaign = get_campaign(db, campaign_id)
    if campaign.status != CampaignStatus.ACTIVE:
        raise conflict("INVALID_STATE", f"Only an Active campaign can be closed (current: {campaign.status.value})")
    _close(campaign, CampaignCloseReason.MANUAL)
    log_action(db, admin, "campaign.close", "campaign", campaign.campaign_id, {"reason": "manual"})
    db.commit()
    return campaign
