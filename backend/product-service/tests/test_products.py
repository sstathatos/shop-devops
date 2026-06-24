import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.main import app
from app.database import get_db, Base

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


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
async def test_create_and_list_products(client):
    payload = {"name": "Widget", "description": "A fine widget", "price": "9.99", "stock": 100}
    r = await client.post("/products", json=payload)
    assert r.status_code == 201
    product_id = r.json()["id"]

    r = await client.get("/products")
    assert r.status_code == 200
    assert any(p["id"] == product_id for p in r.json())


@pytest.mark.asyncio
async def test_get_stock(client):
    payload = {"name": "Gadget", "price": "19.99", "stock": 50}
    create_r = await client.post("/products", json=payload)
    product_id = create_r.json()["id"]

    r = await client.get(f"/products/{product_id}/stock")
    assert r.status_code == 200
    assert r.json()["stock"] == 50


@pytest.mark.asyncio
async def test_update_product(client):
    payload = {"name": "Doohickey", "price": "4.99", "stock": 10}
    create_r = await client.post("/products", json=payload)
    product_id = create_r.json()["id"]

    r = await client.patch(f"/products/{product_id}", json={"stock": 20})
    assert r.status_code == 200
    assert r.json()["stock"] == 20
