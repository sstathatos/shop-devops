from unittest.mock import AsyncMock, patch
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.main import app
from app.database import get_db, Base

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
TEST_USER_ID = "user-123"


@pytest.fixture(scope="module")
async def db_session():
    engine = create_async_engine(TEST_DB_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest.fixture(scope="module")
async def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_create_order(client):
    with patch("app.core.messaging.publish", new_callable=AsyncMock) as mock_pub:
        payload = {
            "items": [
                {"product_id": "prod-1", "name": "Widget", "quantity": 2, "unit_price": "9.99"}
            ]
        }
        r = await client.post("/orders", json=payload, headers={"X-User-Id": TEST_USER_ID})
        assert r.status_code == 201
        data = r.json()
        assert data["user_id"] == TEST_USER_ID
        assert data["status"] == "pending"
        mock_pub.assert_called_once()
        assert mock_pub.call_args.kwargs["routing_key"] == "order.created"


@pytest.mark.asyncio
async def test_list_orders(client):
    r = await client.get("/orders", headers={"X-User-Id": TEST_USER_ID})
    assert r.status_code == 200
    assert isinstance(r.json(), list)
