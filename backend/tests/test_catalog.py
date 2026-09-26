from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Product, StockBalance, StockLedger


def test_opening_stock_is_location_aware_and_logged(client, manager, catalog, engine):
    product = catalog["product"]
    assert product["sku"] == "STEEL-01"
    response = client.get(f"/products/{product['id']}/stock", headers=manager)
    assert response.status_code == 200
    assert len(response.json()) == 1
    stock = response.json()[0]
    assert Decimal(stock["quantity"]) == Decimal("100.25")
    assert stock["location_id"] == catalog["locations"][0]["id"]
    assert stock["warehouse_id"] == catalog["warehouses"][0]["id"]
    with Session(engine) as db:
        entry = db.scalar(select(StockLedger))
        assert entry.transaction_type == "INITIAL"
        assert entry.before_quantity == 0
        assert entry.after_quantity == entry.quantity == Decimal("100.25")


def test_duplicate_sku_rolls_back_stock(client, manager, catalog, engine):
    response = client.post(
        "/products", json={**catalog["product_input"], "sku": "STEEL-01"}, headers=manager
    )
    assert response.status_code == 409
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Product)) == 1
        assert db.scalar(select(func.count()).select_from(StockLedger)) == 1
        assert db.scalar(select(StockBalance.quantity)) == Decimal("100.25")


@pytest.mark.parametrize(
    "change",
    [
        {"initial_location_id": None},
        {"initial_stock": "-1"},
        {"initial_stock": "0.00001"},
        {"initial_stock": "NaN"},
        {"sku": "bad sku"},
        {"name": " "},
        {"initial_stock": "100000000000000"},
    ],
)
def test_product_validation(client, manager, catalog, change):
    response = client.post(
        "/products", json={**catalog["product_input"], "sku": "new", **change}, headers=manager
    )
    assert response.status_code == 422, response.text


def test_product_update_preserves_stock_and_units(client, manager, catalog):
    product = catalog["product"]
    payload = {k: product[k] for k in ["name", "sku", "category_id", "unit_of_measure"]}
    payload["name"] = "Steel Rods"
    assert (
        client.put(f"/products/{product['id']}", json=payload, headers=manager).status_code == 200
    )
    assert (
        client.put(
            f"/products/{product['id']}", json={**payload, "initial_stock": "10"}, headers=manager
        ).status_code
        == 422
    )
    assert (
        client.put(
            f"/products/{product['id']}",
            json={**payload, "unit_of_measure": "TON"},
            headers=manager,
        ).status_code
        == 409
    )
    stock = client.get(f"/products/{product['id']}/stock", headers=manager).json()
    assert Decimal(stock[0]["quantity"]) == Decimal("100.25")


def test_product_search_filters_and_missing_resource(client, manager, catalog):
    for params, count in [
        ({"search": "steel"}, 1),
        ({"search": "%"}, 0),
        ({"warehouse_id": catalog["warehouses"][0]["id"]}, 1),
        ({"warehouse_id": catalog["warehouses"][1]["id"]}, 0),
        ({"category_id": catalog["category"]["id"]}, 1),
        ({"location_id": catalog["locations"][1]["id"]}, 0),
    ]:
        response = client.get("/products", params=params, headers=manager)
        assert response.status_code == 200, response.text
        assert len(response.json()) == count
    assert client.get(f"/products/{uuid4()}", headers=manager).status_code == 404
    assert client.get("/products", params={"limit": 101}, headers=manager).status_code == 422


def test_categories_delete_referenced_and_unused(client, manager, catalog):
    category_id = catalog["category"]["id"]
    assert (
        client.put(
            f"/categories/{category_id}", json={"name": "Metals"}, headers=manager
        ).status_code
        == 200
    )
    assert client.delete(f"/categories/{category_id}", headers=manager).status_code == 409
    created = client.post("/categories", json={"name": "Unused"}, headers=manager).json()
    assert client.delete(f"/categories/{created['id']}", headers=manager).status_code == 204
    assert client.get(f"/categories/{created['id']}", headers=manager).status_code == 404


def test_warehouse_and_location_updates(client, manager, catalog):
    first, second = catalog["warehouses"]
    location = catalog["locations"][0]
    assert client.get("/warehouses", headers=manager).status_code == 200
    assert len(client.get("/warehouses", headers=manager).json()) == 2
    assert (
        len(client.get("/locations", params={"warehouse_id": first["id"]}, headers=manager).json())
        == 1
    )
    assert (
        client.put(
            f"/warehouses/{first['id']}",
            json={"name": "Main Warehouse", "short_code": "main", "address": "Chennai"},
            headers=manager,
        ).status_code
        == 200
    )
    payload = {"name": "Rack B", "short_code": "B", "warehouse_id": first["id"]}
    assert (
        client.put(f"/locations/{location['id']}", json=payload, headers=manager).status_code == 200
    )
    assert (
        client.put(
            f"/locations/{location['id']}",
            json={**payload, "warehouse_id": second["id"]},
            headers=manager,
        ).status_code
        == 409
    )
    assert (
        client.post(
            "/locations", json={**payload, "warehouse_id": str(uuid4())}, headers=manager
        ).status_code
        == 404
    )
    assert client.post("/locations", json=payload, headers=manager).status_code == 409


def test_reorder_rules(client, manager, catalog):
    payload = {
        "product_id": catalog["product"]["id"],
        "minimum_stock": "10.5",
        "reorder_quantity": "50",
    }
    response = client.post("/reorder-rules", json=payload, headers=manager)
    assert response.status_code == 201, response.text
    rule = response.json()
    assert client.post("/reorder-rules", json=payload, headers=manager).status_code == 409
    assert (
        client.put(
            f"/reorder-rules/{rule['id']}", json={**payload, "minimum_stock": "20"}, headers=manager
        ).status_code
        == 200
    )
    assert len(client.get("/reorder-rules", headers=manager).json()) == 1
    for invalid in [{"minimum_stock": "-1"}, {"reorder_quantity": "0"}]:
        assert (
            client.put(
                f"/reorder-rules/{rule['id']}", json={**payload, **invalid}, headers=manager
            ).status_code
            == 422
        )


def test_empty_location_cannot_switch_warehouse(client, manager, catalog):
    location = catalog["locations"][1]
    response = client.put(
        f"/locations/{location['id']}",
        json={
            "name": location["name"],
            "short_code": location["short_code"],
            "warehouse_id": catalog["warehouses"][0]["id"],
        },
        headers=manager,
    )
    assert response.status_code == 409
    assert response.json()["code"] == "LOCATION_WAREHOUSE_FIXED"


def test_zero_initial_stock_and_invalid_relation(client, manager, catalog, engine):
    payload = {**catalog["product_input"], "sku": "ZERO", "initial_stock": "0"}
    payload.pop("initial_location_id")
    created = client.post("/products", json=payload, headers=manager)
    assert created.status_code == 201
    with Session(engine) as db:
        assert (
            db.scalar(
                select(StockBalance).where(StockBalance.product_id == UUID(created.json()["id"]))
            )
            is None
        )
    assert (
        client.post(
            "/products",
            json={**payload, "sku": "BAD", "category_id": str(uuid4())},
            headers=manager,
        ).status_code
        == 404
    )
