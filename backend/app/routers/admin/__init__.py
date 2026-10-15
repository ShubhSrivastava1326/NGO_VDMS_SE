from fastapi import APIRouter, Depends

from app.core.deps import require_admin
from app.routers.admin import campaigns, events, people

# Every route under /admin requires the Admin role (SE-4, BR-5), enforced once here.
router = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)])
router.include_router(campaigns.router)
router.include_router(events.router)
router.include_router(people.router)
