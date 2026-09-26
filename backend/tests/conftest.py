import os
import secrets
import uuid

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session

# Tests use a fresh PostgreSQL schema, never production tables.
os.environ.setdefault("JWT_SECRET", secrets.token_hex(32))
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://localhost/stocksense_test")

from app.config import get_settings  # noqa: E402
from app.db import get_db  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models import User  # noqa: E402


@pytest.fixture
def engine():
    url = os.environ.get("TEST_DATABASE_URL", os.environ["DATABASE_URL"])
    if not url.startswith("postgresql"):
        pytest.fail("Tests require PostgreSQL for row locking and ledger trigger verification")
    admin = create_engine(url)
    schema = "test_" + uuid.uuid4().hex
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_engine(url, connect_args={"options": f"-csearch_path={schema}"})
    try:
        with engine.begin() as connection:
            config = Config("alembic.ini")
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
        yield engine
    finally:
        engine.dispose()
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()


@pytest.fixture
def client(engine):
    app = create_app()

    def test_db():
        with Session(engine, expire_on_commit=False) as db:
            try:
                yield db
                db.commit()
            except Exception:
                db.rollback()
                raise

    app.dependency_overrides[get_db] = test_db
    with TestClient(app) as client:
        yield client


@pytest.fixture
def account(client):
    data = {
        "login_id": "stockstaff",
        "email": "staff@example.com",
        "name": "Warehouse Staff",
        "password": "Safe password 1!",
    }
    response = client.post("/auth/signup", json=data)
    assert response.status_code == 201, response.text
    return data


@pytest.fixture
def staff(client, account):
    response = client.post(
        "/auth/login", json={"login_id": account["login_id"], "password": account["password"]}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": "Bearer " + response.json()["access_token"]}


@pytest.fixture
def manager(client, engine, account):
    with Session(engine) as db, db.begin():
        user = db.scalar(select(User).where(User.email == account["email"]))
        user.role = "INVENTORY_MANAGER"
    response = client.post(
        "/auth/login", json={"login_id": account["login_id"], "password": account["password"]}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": "Bearer " + response.json()["access_token"]}


@pytest.fixture
def catalog(client, manager):
    def post(path, data):
        response = client.post(path, json=data, headers=manager)
        assert response.status_code == 201, response.text
        return response.json()

    category = post("/categories", {"name": "Raw Materials"})
    warehouses = [
        post("/warehouses", {"name": f"Warehouse {i}", "short_code": f"WH{i}"}) for i in range(2)
    ]
    locations = [
        post("/locations", {"name": "Rack A", "short_code": "A", "warehouse_id": w["id"]})
        for w in warehouses
    ]
    product_input = {
        "name": "Steel",
        "sku": "steel-01",
        "category_id": category["id"],
        "unit_of_measure": "KG",
        "initial_stock": "100.25",
        "initial_location_id": locations[0]["id"],
    }
    product = post("/products", product_input)
    return {
        "category": category,
        "warehouses": warehouses,
        "locations": locations,
        "product": product,
        "product_input": product_input,
    }


@pytest.fixture
def mailbox(monkeypatch):
    from app.services import mailer

    messages = []
    monkeypatch.setattr(get_settings(), "smtp_host", "smtp.test")
    monkeypatch.setattr(mailer, "send_reset_code", lambda email, otp: messages.append((email, otp)))
    return messages
