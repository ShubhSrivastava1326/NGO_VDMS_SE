"""Admin: campaign management (3.2) and fund utilization (3.6)."""
from typing import Annotated, Literal

from fastapi import APIRouter, Query, Response
from sqlalchemy import func, or_, select

from app.core.deps import DB, AdminUser, Page, Pagination, make_page
from app.models import Campaign, CampaignStatus
from app.schemas.campaigns import CampaignCreate, CampaignOut, CampaignUpdate
from app.schemas.funds import AdminDashboard, FundReport, UtilizationCreate, UtilizationOut
from app.services import campaigns as svc
from app.services import funds as fund_svc

router = APIRouter(tags=["Admin: campaigns & funds"])


@router.get("/campaigns", response_model=Page[CampaignOut], summary="All campaigns, any status")
def list_campaigns(
    db: DB,
    params: Pagination,
    status: Annotated[CampaignStatus | None, Query()] = None,
    q: Annotated[str | None, Query(description="Search in title/category")] = None,
):
    svc.sync_all_campaigns(db)
    stmt = select(Campaign)
    if status:
        stmt = stmt.where(Campaign.status == status)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(Campaign.title).like(like), func.lower(Campaign.category).like(like)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(Campaign.created_at.desc(), Campaign.campaign_id.desc()).offset(params.offset).limit(params.page_size)).all()
    return make_page([CampaignOut.model_validate(c) for c in rows], total, params)


@router.post("/campaigns", response_model=CampaignOut, status_code=201, summary="Create a campaign (status 'draft')")
def create_campaign(data: CampaignCreate, admin: AdminUser, db: DB):
    return svc.create_campaign(db, admin, data)


@router.get("/campaigns/{campaign_id}", response_model=CampaignOut)
def get_campaign(campaign_id: int, db: DB):
    campaign = svc.get_campaign(db, campaign_id)
    if svc.sync_campaign(campaign):
        db.commit()
    return campaign


@router.patch(
    "/campaigns/{campaign_id}",
    response_model=CampaignOut,
    summary="Edit a campaign. Draft: any field. Active: only description & end_date",
)
def update_campaign(campaign_id: int, data: CampaignUpdate, admin: AdminUser, db: DB):
    return svc.update_campaign(db, admin, campaign_id, data)


@router.post("/campaigns/{campaign_id}/publish", response_model=CampaignOut, summary="Draft -> Active")
def publish_campaign(campaign_id: int, admin: AdminUser, db: DB):
    return svc.publish_campaign(db, admin, campaign_id)


@router.post("/campaigns/{campaign_id}/close", response_model=CampaignOut, summary="Close an Active campaign early")
def close_campaign(campaign_id: int, admin: AdminUser, db: DB):
    return svc.close_campaign_manually(db, admin, campaign_id)


# --- Fund utilization -----------------------------------------------------------------------------
@router.post(
    "/campaigns/{campaign_id}/utilizations",
    response_model=UtilizationOut,
    status_code=201,
    summary="Record how funds were spent (rejected if total utilized would exceed total raised)",
)
def record_utilization(campaign_id: int, data: UtilizationCreate, admin: AdminUser, db: DB):
    return fund_svc.record_utilization(db, admin, campaign_id, data)


@router.get("/campaigns/{campaign_id}/utilizations", response_model=list[UtilizationOut])
def list_utilizations(campaign_id: int, db: DB):
    return fund_svc.list_utilizations(db, campaign_id)


@router.get(
    "/campaigns/{campaign_id}/fund-report",
    response_model=FundReport,
    summary="Raised / utilized / remaining + category breakdown",
)
def fund_report(campaign_id: int, db: DB):
    return fund_svc.build_report(db, campaign_id)


@router.get(
    "/campaigns/{campaign_id}/fund-report/export",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}, "text/csv": {}}}},
    summary="Download the fund report as PDF or CSV (fetch with the Authorization header, then save the blob)",
)
def export_fund_report(campaign_id: int, db: DB, format: Annotated[Literal["pdf", "csv"], Query()] = "pdf"):
    report = fund_svc.build_report(db, campaign_id)
    if format == "csv":
        content, media = fund_svc.report_csv(report), "text/csv; charset=utf-8"
    else:
        content, media = fund_svc.report_pdf(report), "application/pdf"
    filename = f"fund-report-campaign-{campaign_id}.{format}"
    return Response(content=content, media_type=media, headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/dashboard", response_model=AdminDashboard, summary="Admin landing page numbers (Fund.Report.Dashboard)")
def dashboard(db: DB):
    return fund_svc.admin_dashboard(db)
