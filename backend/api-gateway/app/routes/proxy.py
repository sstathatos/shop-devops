import logging
import httpx
from fastapi import APIRouter, Request, Response, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends
from ..core.config import settings
from ..core.security import decode_token

logger = logging.getLogger("api-gateway")
router = APIRouter()
bearer_scheme = HTTPBearer(auto_error=False)

_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    return _client


async def startup() -> None:
    global _client
    _client = httpx.AsyncClient(timeout=30.0)


async def shutdown() -> None:
    if _client:
        await _client.aclose()


def _extract_user_id(credentials: HTTPAuthorizationCredentials | None) -> str | None:
    if credentials is None:
        return None
    return decode_token(credentials.credentials)


ROUTE_MAP = {
    "/api/users": settings.user_service_url,
    "/api/products": settings.product_service_url,
    "/api/orders": settings.order_service_url,
    "/api/notifications": settings.notification_service_url,
}

PROTECTED_PREFIXES = {"/api/users/me", "/api/notifications/events"}


async def _proxy(request: Request, target_url: str, user_id: str | None) -> Response:
    path = request.url.path
    query = request.url.query
    upstream = f"{target_url}{path[len('/api'):]}"
    if query:
        upstream = f"{upstream}?{query}"

    headers = dict(request.headers)
    headers.pop("host", None)
    if user_id:
        headers["X-User-Id"] = user_id

    body = await request.body()
    upstream_response = await _client.request(
        method=request.method,
        url=upstream,
        headers=headers,
        content=body,
    )
    return Response(
        content=upstream_response.content,
        status_code=upstream_response.status_code,
        headers=dict(upstream_response.headers),
    )


@router.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def gateway(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    path = request.url.path
    target_base = next((url for prefix, url in ROUTE_MAP.items() if path.startswith(prefix)), None)
    if target_base is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")

    requires_auth = any(path.startswith(p) for p in PROTECTED_PREFIXES)
    user_id: str | None = None

    if requires_auth:
        if credentials is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
        user_id = decode_token(credentials.credentials)
    elif credentials is not None:
        try:
            user_id = decode_token(credentials.credentials)
        except HTTPException:
            pass

    logger.info("Proxying request", extra={"method": request.method, "path": path, "user_id": user_id})
    return await _proxy(request, target_base, user_id)
