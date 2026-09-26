"""End-to-end tests for Member 2 inventory operations.

Tests exercise the complete lifecycle for receipts, deliveries, transfers,
and adjustments.  The critical demo scenario from the problem statement is
reproduced in ``test_critical_demo_scenario``.

All tests share the standard ``client`` and ``catalog`` fixtures from conftest.py;
no external services or mocks are needed beyond what the conftest sets up.
"""

from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Adjustment,
    Delivery,
    DeliveryItem,
    Receipt,
    ReceiptItem,
    StockBalance,
    StockLedger,
    Transfer,
    TransferItem,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _post(client, path, data, headers):
    r = client.post(path, json=data, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _ready_receipt(client, manager, catalog, qty="50.0000"):
    """Create + advance a receipt to READY status with one item."""
    receipt = _post(client, "/receipts", {"supplier": "Acme Corp"}, manager)
    rid = receipt["id"]
    _post(
        client,
        f"/receipts/{rid}/items",
        {
            "product_id": catalog["product"]["id"],
            "location_id": catalog["locations"][0]["id"],
            "quantity": qty,
        },
        manager,
    )
    client.post(f"/receipts/{rid}/status", json={"status": "WAITING"}, headers=manager)
    client.post(f"/receipts/{rid}/status", json={"status": "READY"}, headers=manager)
    return rid


def _ready_delivery(client, manager, catalog, qty="20.0000", location_idx=0):
    """Create + advance a delivery to READY status with one item."""
    delivery = _post(client, "/deliveries", {"notes": ""}, manager)
    did = delivery["id"]
    _post(
        client,
        f"/deliveries/{did}/items",
        {
            "product_id": catalog["product"]["id"],
            "location_id": catalog["locations"][location_idx]["id"],
            "quantity": qty,
        },
        manager,
    )
    client.post(f"/deliveries/{did}/pick", headers=manager)
    client.post(f"/deliveries/{did}/pack", headers=manager)
    return did


def _ready_transfer(client, manager, catalog, qty="40.0000"):
    """Create + advance a transfer to READY status with one item."""
    transfer = _post(client, "/transfers", {"notes": ""}, manager)
    tid = transfer["id"]
    _post(
        client,
        f"/transfers/{tid}/items",
        {
            "product_id": catalog["product"]["id"],
            "source_location_id": catalog["locations"][0]["id"],
            "destination_location_id": catalog["locations"][1]["id"],
            "quantity": qty,
        },
        manager,
    )
    client.post(
        f"/transfers/{tid}/status", json={"status": "WAITING"}, headers=manager
    )
    client.post(
        f"/transfers/{tid}/status", json={"status": "READY"}, headers=manager
    )
    return tid


# ---------------------------------------------------------------------------
# Receipt tests
# ---------------------------------------------------------------------------


class TestReceipts:
    def test_create_and_list(self, client, manager):
        _post(client, "/receipts", {"supplier": "Vendor A"}, manager)
        r = client.get("/receipts", headers=manager)
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_draft_does_not_change_stock(self, client, manager, catalog, engine):
        rid = _ready_receipt(client, manager, catalog)
        # Create a *fresh* receipt (DRAFT, never validated)
        draft = _post(client, "/receipts", {"supplier": "Draft Only"}, manager)
        _post(
            client,
            f"/receipts/{draft['id']}/items",
            {
                "product_id": catalog["product"]["id"],
                "location_id": catalog["locations"][0]["id"],
                "quantity": "999.0000",
            },
            manager,
        )
        # DRAFT receipt must not change stock; only the previously validated one matters
        with Session(engine) as db:
            count = db.scalar(select(func.count()).select_from(StockLedger))
        # Only the initial stock entry from the catalog fixture exists (no extra from draft)
        assert count == 1  # catalog fixture creates 1 INITIAL entry

    def test_validate_receipt_increases_stock(self, client, manager, catalog, engine):
        rid = _ready_receipt(client, manager, catalog, qty="50.0000")
        r = client.post(f"/receipts/{rid}/validate", headers=manager)
        assert r.status_code == 200
        assert r.json()["status"] == "DONE"
        with Session(engine) as db:
            bal = db.get(
                StockBalance,
                (catalog["product"]["id"], catalog["locations"][0]["id"]),
            )
            # 100.25 initial + 50 = 150.25
            assert bal.quantity == Decimal("150.2500")

    def test_cannot_validate_twice(self, client, manager, catalog):
        rid = _ready_receipt(client, manager, catalog)
        client.post(f"/receipts/{rid}/validate", headers=manager)
        r = client.post(f"/receipts/{rid}/validate", headers=manager)
        assert r.status_code == 409

    def test_cannot_validate_non_ready(self, client, manager, catalog):
        receipt = _post(client, "/receipts", {"supplier": "X"}, manager)
        rid = receipt["id"]
        _post(
            client,
            f"/receipts/{rid}/items",
            {
                "product_id": catalog["product"]["id"],
                "location_id": catalog["locations"][0]["id"],
                "quantity": "10.0000",
            },
            manager,
        )
        # Still DRAFT, not READY
        r = client.post(f"/receipts/{rid}/validate", headers=manager)
        assert r.status_code == 409

    def test_validate_creates_ledger_entry(self, client, manager, catalog, engine):
        rid = _ready_receipt(client, manager, catalog, qty="25.0000")
        client.post(f"/receipts/{rid}/validate", headers=manager)
        with Session(engine) as db:
            entries = db.scalars(
                select(StockLedger).where(StockLedger.transaction_type == "RECEIPT")
            ).all()
            assert len(entries) == 1
            assert entries[0].quantity == Decimal("25.0000")
            assert entries[0].reference_id == rid


# ---------------------------------------------------------------------------
# Delivery tests
# ---------------------------------------------------------------------------


class TestDeliveries:
    def test_create_and_list(self, client, manager):
        _post(client, "/deliveries", {"notes": ""}, manager)
        r = client.get("/deliveries", headers=manager)
        assert r.status_code == 200

    def test_pick_pack_validate_decreases_stock(self, client, manager, catalog, engine):
        # First receive stock
        rid = _ready_receipt(client, manager, catalog, qty="50.0000")
        client.post(f"/receipts/{rid}/validate", headers=manager)

        did = _ready_delivery(client, manager, catalog, qty="20.0000")
        r = client.post(f"/deliveries/{did}/validate", headers=manager)
        assert r.status_code == 200
        assert r.json()["status"] == "DONE"
        with Session(engine) as db:
            bal = db.get(
                StockBalance,
                (catalog["product"]["id"], catalog["locations"][0]["id"]),
            )
            # 100.25 initial + 50 receipt − 20 delivery = 130.25
            assert bal.quantity == Decimal("130.2500")

    def test_delivery_rejected_on_insufficient_stock(self, client, manager, catalog):
        # Only 100.25 in stock; try to deliver 200
        did = _ready_delivery(client, manager, catalog, qty="200.0000")
        r = client.post(f"/deliveries/{did}/validate", headers=manager)
        assert r.status_code == 409
        assert r.json()["code"] == "INSUFFICIENT_STOCK"

    def test_cannot_validate_delivery_twice(self, client, manager, catalog, engine):
        # Add enough stock
        rid = _ready_receipt(client, manager, catalog, qty="50.0000")
        client.post(f"/receipts/{rid}/validate", headers=manager)

        did = _ready_delivery(client, manager, catalog, qty="10.0000")
        client.post(f"/deliveries/{did}/validate", headers=manager)
        r = client.post(f"/deliveries/{did}/validate", headers=manager)
        assert r.status_code == 409

    def test_delivery_creates_ledger_entry(self, client, manager, catalog, engine):
        rid = _ready_receipt(client, manager, catalog, qty="30.0000")
        client.post(f"/receipts/{rid}/validate", headers=manager)

        did = _ready_delivery(client, manager, catalog, qty="15.0000")
        client.post(f"/deliveries/{did}/validate", headers=manager)
        with Session(engine) as db:
            entries = db.scalars(
                select(StockLedger).where(StockLedger.transaction_type == "DELIVERY")
            ).all()
            assert len(entries) == 1
            assert entries[0].quantity == Decimal("-15.0000")


# ---------------------------------------------------------------------------
# Transfer tests
# ---------------------------------------------------------------------------


class TestTransfers:
    def test_create_and_list(self, client, manager):
        _post(client, "/transfers", {"notes": ""}, manager)
        r = client.get("/transfers", headers=manager)
        assert r.status_code == 200

    def test_transfer_moves_stock_between_locations(self, client, manager, catalog, engine):
        tid = _ready_transfer(client, manager, catalog, qty="40.0000")
        r = client.post(f"/transfers/{tid}/validate", headers=manager)
        assert r.status_code == 200
        assert r.json()["status"] == "DONE"
        with Session(engine) as db:
            src = db.get(
                StockBalance,
                (catalog["product"]["id"], catalog["locations"][0]["id"]),
            )
            dst = db.get(
                StockBalance,
                (catalog["product"]["id"], catalog["locations"][1]["id"]),
            )
            assert src.quantity == Decimal("60.2500")  # 100.25 − 40
            assert dst.quantity == Decimal("40.0000")
            assert src.quantity + dst.quantity == Decimal("100.2500")  # global unchanged

    def test_transfer_cannot_exceed_source_stock(self, client, manager, catalog):
        # Only 100.25 available; try to transfer 200
        transfer = _post(client, "/transfers", {"notes": ""}, manager)
        tid = transfer["id"]
        _post(
            client,
            f"/transfers/{tid}/items",
            {
                "product_id": catalog["product"]["id"],
                "source_location_id": catalog["locations"][0]["id"],
                "destination_location_id": catalog["locations"][1]["id"],
                "quantity": "200.0000",
            },
            manager,
        )
        client.post(f"/transfers/{tid}/status", json={"status": "WAITING"}, headers=manager)
        client.post(f"/transfers/{tid}/status", json={"status": "READY"}, headers=manager)
        r = client.post(f"/transfers/{tid}/validate", headers=manager)
        assert r.status_code == 409
        assert r.json()["code"] == "INSUFFICIENT_STOCK"

    def test_transfer_creates_two_ledger_entries(self, client, manager, catalog, engine):
        tid = _ready_transfer(client, manager, catalog, qty="10.0000")
        client.post(f"/transfers/{tid}/validate", headers=manager)
        with Session(engine) as db:
            entries = db.scalars(
                select(StockLedger).where(StockLedger.transaction_type == "TRANSFER")
            ).all()
            assert len(entries) == 2
            quantities = sorted(e.quantity for e in entries)
            assert quantities == [Decimal("-10.0000"), Decimal("10.0000")]

    def test_same_location_transfer_rejected(self, client, manager, catalog):
        transfer = _post(client, "/transfers", {"notes": ""}, manager)
        tid = transfer["id"]
        r = client.post(
            f"/transfers/{tid}/items",
            json={
                "product_id": catalog["product"]["id"],
                "source_location_id": catalog["locations"][0]["id"],
                "destination_location_id": catalog["locations"][0]["id"],
                "quantity": "5.0000",
            },
            headers=manager,
        )
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# Adjustment tests
# ---------------------------------------------------------------------------


class TestAdjustments:
    def test_create_and_list(self, client, manager, catalog):
        _post(
            client,
            "/adjustments",
            {
                "product_id": catalog["product"]["id"],
                "location_id": catalog["locations"][0]["id"],
                "counted_quantity": "97.0000",
                "reason": "Physical count discrepancy",
            },
            manager,
        )
        r = client.get("/adjustments", headers=manager)
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_adjustment_updates_stock(self, client, manager, catalog, engine):
        r = client.post(
            "/adjustments",
            json={
                "product_id": catalog["product"]["id"],
                "location_id": catalog["locations"][0]["id"],
                "counted_quantity": "97.0000",
                "reason": "Damaged items",
            },
            headers=manager,
        )
        aid = r.json()["id"]
        assert r.status_code == 201
        r = client.post(f"/adjustments/{aid}/validate", headers=manager)
        assert r.status_code == 200
        assert r.json()["status"] == "DONE"
        with Session(engine) as db:
            bal = db.get(
                StockBalance,
                (catalog["product"]["id"], catalog["locations"][0]["id"]),
            )
            assert bal.quantity == Decimal("97.0000")

    def test_adjustment_creates_ledger_entry(self, client, manager, catalog, engine):
        r = client.post(
            "/adjustments",
            json={
                "product_id": catalog["product"]["id"],
                "location_id": catalog["locations"][0]["id"],
                "counted_quantity": "90.0000",
                "reason": "Recount",
            },
            headers=manager,
        )
        aid = r.json()["id"]
        client.post(f"/adjustments/{aid}/validate", headers=manager)
        with Session(engine) as db:
            entries = db.scalars(
                select(StockLedger).where(StockLedger.transaction_type == "ADJUSTMENT")
            ).all()
            assert len(entries) == 1
            assert entries[0].quantity == Decimal("-10.2500")  # 90 − 100.25

    def test_adjustment_requires_reason(self, client, manager, catalog):
        r = client.post(
            "/adjustments",
            json={
                "product_id": catalog["product"]["id"],
                "location_id": catalog["locations"][0]["id"],
                "counted_quantity": "90.0000",
                "reason": "",
            },
            headers=manager,
        )
        assert r.status_code == 422

    def test_cannot_validate_adjustment_twice(self, client, manager, catalog):
        r = client.post(
            "/adjustments",
            json={
                "product_id": catalog["product"]["id"],
                "location_id": catalog["locations"][0]["id"],
                "counted_quantity": "95.0000",
                "reason": "Test",
            },
            headers=manager,
        )
        aid = r.json()["id"]
        client.post(f"/adjustments/{aid}/validate", headers=manager)
        r = client.post(f"/adjustments/{aid}/validate", headers=manager)
        assert r.status_code == 409


# ---------------------------------------------------------------------------
# Inventory API
# ---------------------------------------------------------------------------


class TestInventoryAPI:
    def test_ledger_list(self, client, manager):
        r = client.get("/inventory/ledger", headers=manager)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_stock_list(self, client, manager):
        r = client.get("/inventory/stock", headers=manager)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_product_stock_detail(self, client, manager, catalog):
        pid = catalog["product"]["id"]
        r = client.get(f"/inventory/stock/{pid}", headers=manager)
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) >= 1
        assert all(row["product_id"] == pid for row in rows)

    def test_low_stock_alert(self, client, manager, catalog):
        # Set a reorder rule above current stock to trigger an alert.
        r = client.post(
            "/reorder-rules",
            json={
                "product_id": catalog["product"]["id"],
                "minimum_stock": "200.0000",
                "reorder_quantity": "100.0000",
            },
            headers=manager,
        )
        assert r.status_code == 201
        r = client.get("/inventory/alerts/low-stock", headers=manager)
        assert r.status_code == 200
        alerts = r.json()
        product_ids = [a["product_id"] for a in alerts]
        assert catalog["product"]["id"] in product_ids


# ---------------------------------------------------------------------------
# CRITICAL DEMO SCENARIO
# Problem statement §9 / §28: Steel = 0, +100, transfer 40, deliver 20, adjust -3
# Expected: Global = 77, Warehouse = 37, Production = 40
# ---------------------------------------------------------------------------


class TestCriticalDemoScenario:
    """Reproduce the authoritative end-to-end test from the problem statement.

    This test is intentionally self-contained; it creates its own product
    starting at zero stock so it is independent of the catalog fixture's
    pre-seeded 100.25 KG.
    """

    def test_full_lifecycle(self, client, manager, catalog, engine):
        # Grab location references (Warehouse = locations[0], Production = locations[1])
        warehouse_loc = catalog["locations"][0]["id"]
        production_loc = catalog["locations"][1]["id"]

        # ── Step 0: Create a fresh product with zero initial stock ──────────
        r = client.post(
            "/products",
            json={
                "name": "Steel",
                "sku": "STEEL-DEMO-01",
                "category_id": catalog["category"]["id"],
                "unit_of_measure": "KG",
                "initial_stock": "0",
            },
            headers=manager,
        )
        assert r.status_code == 201
        steel_id = r.json()["id"]

        # ── Step 1: Receipt +100 KG into Warehouse ──────────────────────────
        receipt = _post(client, "/receipts", {"supplier": "Steel Works Ltd"}, manager)
        rid = receipt["id"]
        _post(
            client,
            f"/receipts/{rid}/items",
            {
                "product_id": steel_id,
                "location_id": warehouse_loc,
                "quantity": "100.0000",
            },
            manager,
        )
        client.post(f"/receipts/{rid}/status", json={"status": "WAITING"}, headers=manager)
        client.post(f"/receipts/{rid}/status", json={"status": "READY"}, headers=manager)
        r = client.post(f"/receipts/{rid}/validate", headers=manager)
        assert r.status_code == 200

        # Verify: Global = 100
        r = client.get(f"/inventory/stock/{steel_id}", headers=manager)
        total = sum(Decimal(row["quantity"]) for row in r.json())
        assert total == Decimal("100.0000")

        # ── Step 2: Transfer 40 KG Warehouse → Production ──────────────────
        transfer = _post(client, "/transfers", {"notes": "Production run"}, manager)
        tid = transfer["id"]
        _post(
            client,
            f"/transfers/{tid}/items",
            {
                "product_id": steel_id,
                "source_location_id": warehouse_loc,
                "destination_location_id": production_loc,
                "quantity": "40.0000",
            },
            manager,
        )
        client.post(
            f"/transfers/{tid}/status", json={"status": "WAITING"}, headers=manager
        )
        client.post(
            f"/transfers/{tid}/status", json={"status": "READY"}, headers=manager
        )
        r = client.post(f"/transfers/{tid}/validate", headers=manager)
        assert r.status_code == 200

        with Session(engine) as db:
            wh = db.scalar(
                select(StockBalance.quantity).where(
                    StockBalance.product_id == steel_id,
                    StockBalance.location_id == warehouse_loc,
                )
            )
            prod = db.scalar(
                select(StockBalance.quantity).where(
                    StockBalance.product_id == steel_id,
                    StockBalance.location_id == production_loc,
                )
            )
            assert wh == Decimal("60.0000")
            assert prod == Decimal("40.0000")
            assert wh + prod == Decimal("100.0000")  # global unchanged

        # ── Step 3: Deliver 20 KG from Warehouse ───────────────────────────
        delivery = _post(client, "/deliveries", {"notes": "Customer order"}, manager)
        did = delivery["id"]
        _post(
            client,
            f"/deliveries/{did}/items",
            {
                "product_id": steel_id,
                "location_id": warehouse_loc,
                "quantity": "20.0000",
            },
            manager,
        )
        client.post(f"/deliveries/{did}/pick", headers=manager)
        client.post(f"/deliveries/{did}/pack", headers=manager)
        r = client.post(f"/deliveries/{did}/validate", headers=manager)
        assert r.status_code == 200

        with Session(engine) as db:
            wh = db.scalar(
                select(StockBalance.quantity).where(
                    StockBalance.product_id == steel_id,
                    StockBalance.location_id == warehouse_loc,
                )
            )
            assert wh == Decimal("40.0000")

        # ── Step 4: Adjustment −3 KG on Warehouse (damaged stock) ──────────
        r = client.post(
            "/adjustments",
            json={
                "product_id": steel_id,
                "location_id": warehouse_loc,
                "counted_quantity": "37.0000",
                "reason": "Damaged during shipping inspection",
            },
            headers=manager,
        )
        assert r.status_code == 201
        aid = r.json()["id"]
        r = client.post(f"/adjustments/{aid}/validate", headers=manager)
        assert r.status_code == 200

        # ── Final verification ──────────────────────────────────────────────
        with Session(engine) as db:
            wh = db.scalar(
                select(StockBalance.quantity).where(
                    StockBalance.product_id == steel_id,
                    StockBalance.location_id == warehouse_loc,
                )
            )
            prod = db.scalar(
                select(StockBalance.quantity).where(
                    StockBalance.product_id == steel_id,
                    StockBalance.location_id == production_loc,
                )
            )
            assert wh == Decimal("37.0000"), f"Expected Warehouse=37, got {wh}"
            assert prod == Decimal("40.0000"), f"Expected Production=40, got {prod}"
            assert wh + prod == Decimal("77.0000"), "Expected Global=77"

            # Verify ledger completeness: must have all four movement types
            types = set(
                db.scalars(
                    select(StockLedger.transaction_type).where(
                        StockLedger.product_id == steel_id
                    )
                ).all()
            )
            assert "RECEIPT" in types
            assert "TRANSFER" in types
            assert "DELIVERY" in types
            assert "ADJUSTMENT" in types
