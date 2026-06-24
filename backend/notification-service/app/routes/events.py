from fastapi import APIRouter
from ..store import event_log

router = APIRouter(prefix="/notifications")


@router.get("/events")
async def get_events():
    return list(event_log)
