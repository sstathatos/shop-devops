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
    assert r.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_register_and_login(client):
    payload = {"email": "alice@example.com", "password": "secret123", "full_name": "Alice"}
    r = await client.post("/users/register", json=payload)
    assert r.status_code == 201
    assert r.json()["email"] == "alice@example.com"

    r = await client.post("/users/login", json={"email": "alice@example.com", "password": "secret123"})
    assert r.status_code == 200
    assert "access_token" in r.json()


@pytest.mark.asyncio
async def test_duplicate_register(client):
    payload = {"email": "alice@example.com", "password": "secret123", "full_name": "Alice"}
    r = await client.post("/users/register", json=payload)
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_get_me(client):
    login = await client.post(
        "/users/login", json={"email": "alice@example.com", "password": "secret123"}
    )
    token = login.json()["access_token"]
    r = await client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "alice@example.com"
