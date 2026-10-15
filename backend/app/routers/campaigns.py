"""Public campaign browsing (UI-1: no login required)."""
from typing import Annotated, Literal

from fastapi import APIRouter, Query
from sqlalchemy import func, or_, select

from app.core.deps import DB, OptionalUser, Page, Pagination, make_page
from app.core.errors import not_found
from app.models import Campaign, CampaignStatus, Role
from app.schemas.campaigns import CampaignOut
from app.services.campaigns import get_campaign, sync_all_campaigns, sync_campaign

router = APIRouter(prefix="/campaigns", tags=["Campaigns (public)"])


@router.get("", response_model=Page[CampaignOut], summary="List ACTIVE campaigns (public)")
def list_active_campaigns(
    db: DB,
    params: Pagination,
    category: Annotated[str | None, Query(description="Exact category, e.g. 'education'")] = None,
    q: Annotated[str | None, Query(description="Search in title/description")] = None,
    sort: Literal["newest", "ending_soon", "most_funded"] = "newest",
):
    sync_all_campaigns(db)  # Campaign.Close.Auto: never show a campaign that should already be closed
    stmt = select(Campaign).where(Campaign.status == CampaignStatus.ACTIVE)
    if category:
        stmt = stmt.where(func.lower(Campaign.category) == category.lower())
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(Campaign.title).like(like), func.lower(Campaign.description).like(like)))
    order = {
        "newest": Campaign.published_at.desc(),
        "ending_soon": Campaign.end_date.asc(),
        "most_funded": Campaign.amount_raised.desc(),
    }[sort]
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(order, Campaign.campaign_id.desc()).offset(params.offset).limit(params.page_size)).all()
    return make_page([CampaignOut.model_validate(c) for c in rows], total, params)


@router.get("/categories", response_model=list[str], summary="Distinct categories of active campaigns (for filters)")
def active_categories(db: DB):
    sync_all_campaigns(db)
    rows = db.scalars(
        select(Campaign.category).where(Campaign.status == CampaignStatus.ACTIVE).distinct().order_by(Campaign.category)
    ).all()
    return list(rows)


@router.get("/{campaign_id}", response_model=CampaignOut, summary="Campaign detail (drafts are admin-only)")
def get_campaign_detail(campaign_id: int, db: DB, user: OptionalUser):
    campaign = get_campaign(db, campaign_id)
    if sync_campaign(campaign):
        db.commit()
    if campaign.status == CampaignStatus.DRAFT and not (user and user.role == Role.ADMIN):
        raise not_found("Campaign")
    return CampaignOut.model_validate(campaign)
