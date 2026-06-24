from fastapi import APIRouter

router = APIRouter(prefix="/notifications")


@router.get("/health")
async def health():
    return {"status": "ok", "service": "notification-service"}
