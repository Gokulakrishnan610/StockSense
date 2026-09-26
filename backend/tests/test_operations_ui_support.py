"""API support for the operations UI and the Member 4 end-to-end inventory flow.

Covers operation line listing/removal, cancellation, ledger filters, and the
required demo scenario driven purely through HTTP, as the frontend drives it.
"""

from decimal import Decimal


def _ok(response, status=200):
    assert response.status_code == status, response.text
    return response.json() if response.content else None


def _post(client, path, data, headers, status=201):
    return _ok(client.post(path, json=data, headers=headers), status)


def _global_stock(client, headers, product_id):
    rows = _ok(client.get(f"/inventory/stock/{product_id}", headers=headers))
    return {row["location_id"]: Decimal(row["quantity"]) for row in rows}


class TestOperationLines:
    def test_receipt_items_list_and_remove(self, client, manager, catalog):
        receipt = _post(client, "/receipts", {"supplier": "Acme"}, manager)
        rid = receipt["id"]
        line = {
            "product_id": catalog["product"]["id"],
            "location_id": catalog["locations"][0]["id"],
            "quantity": "5",
        }
        first = _post(client, f"/receipts/{rid}/items", line, manager)
        _post(client, f"/receipts/{rid}/items", {**line, "quantity": "7"}, manager)

        items = _ok(client.get(f"/receipts/{rid}/items", headers=manager))
        assert [Decimal(i["quantity"]) for i in items] == [Decimal("5"), Decimal("7")]

        _ok(client.delete(f"/receipts/{rid}/items/{first['id']}", headers=manager), 204)
        items = _ok(client.get(f"/receipts/{rid}/items", headers=manager))
        assert len(items) == 1

    def test_cannot_remove_line_from_done_receipt(self, client, manager, catalog):
        rid = _post(client, "/receipts", {"supplier": "Acme"}, manager)["id"]
        line = _post(
            client,
            f"/receipts/{rid}/items",
            {
                "product_id": catalog["product"]["id"],
                "location_id": catalog["locations"][0]["id"],
                "quantity": "5",
            },
            manager,
        )
        for status in ("WAITING", "READY"):
            _ok(client.post(f"/receipts/{rid}/status", json={"status": status}, headers=manager))
        _ok(client.post(f"/receipts/{rid}/validate", headers=manager))
        r = client.delete(f"/receipts/{rid}/items/{line['id']}", headers=manager)
        assert r.status_code == 409
        assert r.json()["code"] == "ALREADY_TERMINAL"

    def test_line_must_belong_to_operation(self, client, manager, catalog):
        a = _post(client, "/transfers", {"notes": ""}, manager)["id"]
        b = _post(client, "/transfers", {"notes": ""}, manager)["id"]
        line = _post(
            client,
            f"/transfers/{a}/items",
            {
                "product_id": catalog["product"]["id"],
                "source_location_id": catalog["locations"][0]["id"],
                "destination_location_id": catalog["locations"][1]["id"],
                "quantity": "1",
            },
            manager,
        )
        r = client.delete(f"/transfers/{b}/items/{line['id']}", headers=manager)
        assert r.status_code == 404
        assert len(_ok(client.get(f"/transfers/{a}/items", headers=manager))) == 1

    def test_items_of_missing_operation_is_404(self, client, manager):
        missing = "00000000-0000-0000-0000-000000000000"
        assert client.get(f"/deliveries/{missing}/items", headers=manager).status_code == 404


class TestCancellation:
    def test_canceled_delivery_cannot_be_validated(self, client, manager, catalog):
        did = _post(client, "/deliveries", {"notes": ""}, manager)["id"]
        _post(
            client,
            f"/deliveries/{did}/items",
            {
                "product_id": catalog["product"]["id"],
                "location_id": catalog["locations"][0]["id"],
                "quantity": "10",
            },
            manager,
        )
        before = _global_stock(client, manager, catalog["product"]["id"])
        assert _ok(client.post(f"/deliveries/{did}/cancel", headers=manager))["status"] == (
            "CANCELED"
        )
        assert client.post(f"/deliveries/{did}/pick", headers=manager).status_code == 409
        assert client.post(f"/deliveries/{did}/validate", headers=manager).status_code == 409
        assert client.post(f"/deliveries/{did}/cancel", headers=manager).status_code == 409
        assert _global_stock(client, manager, catalog["product"]["id"]) == before

    def test_adjustment_cancel_only_from_draft(self, client, manager, catalog):
        body = {
            "product_id": catalog["product"]["id"],
            "location_id": catalog["locations"][0]["id"],
            "counted_quantity": "1",
            "reason": "Cycle count",
        }
        aid = _post(client, "/adjustments", body, manager)["id"]
        assert _ok(client.post(f"/adjustments/{aid}/cancel", headers=manager))["status"] == (
            "CANCELED"
        )
        assert client.post(f"/adjustments/{aid}/validate", headers=manager).status_code == 409

        done = _post(client, "/adjustments", body, manager)["id"]
        _ok(client.post(f"/adjustments/{done}/validate", headers=manager))
        assert client.post(f"/adjustments/{done}/cancel", headers=manager).status_code == 409


class TestLedgerFilters:
    def test_filters_and_user_name(self, client, manager, catalog):
        product = catalog["product"]["id"]
        rid = _post(client, "/receipts", {"supplier": "Acme"}, manager)["id"]
        _post(
            client,
            f"/receipts/{rid}/items",
            {"product_id": product, "location_id": catalog["locations"][1]["id"], "quantity": "3"},
            manager,
        )
        for status in ("WAITING", "READY"):
            client.post(f"/receipts/{rid}/status", json={"status": status}, headers=manager)
        _ok(client.post(f"/receipts/{rid}/validate", headers=manager))

        rows = _ok(client.get("/inventory/ledger", headers=manager))
        assert {r["transaction_type"] for r in rows} == {"INITIAL", "RECEIPT"}
        assert all(r["user_name"] for r in rows)
        assert "entry_key" not in rows[0]

        by_ref = _ok(client.get(f"/inventory/ledger?reference_id={rid}", headers=manager))
        assert len(by_ref) == 1 and by_ref[0]["transaction_type"] == "RECEIPT"

        wh1 = catalog["warehouses"][1]["id"]
        by_wh = _ok(client.get(f"/inventory/ledger?warehouse_id={wh1}", headers=manager))
        assert [r["reference_id"] for r in by_wh] == [rid]

        cat = catalog["category"]["id"]
        assert len(_ok(client.get(f"/inventory/ledger?category_id={cat}", headers=manager))) == 2
        other = _post(client, "/categories", {"name": "Empty"}, manager)["id"]
        assert _ok(client.get(f"/inventory/ledger?category_id={other}", headers=manager)) == []

        future = _ok(
            client.get("/inventory/ledger?date_from=2999-01-01T00:00:00Z", headers=manager)
        )
        assert future == []
        past = _ok(client.get("/inventory/ledger?date_to=2000-01-01T00:00:00Z", headers=manager))
        assert past == []


def test_member4_demo_flow_through_api(client, manager):
    """Steel Rod: +100 receipt, 40 transfer, 20 delivery and -3 adjustment at Production."""
    h = manager
    category = _post(client, "/categories", {"name": "Raw Material"}, h)
    warehouse = _post(client, "/warehouses", {"name": "Main Warehouse", "short_code": "WH"}, h)
    stock_loc = _post(
        client,
        "/locations",
        {"name": "Rack A", "short_code": "RACK-A", "warehouse_id": warehouse["id"]},
        h,
    )["id"]
    prod_loc = _post(
        client,
        "/locations",
        {"name": "Production Floor", "short_code": "PROD", "warehouse_id": warehouse["id"]},
        h,
    )["id"]
    steel = _post(
        client,
        "/products",
        {
            "name": "Steel Rod",
            "sku": "STEEL-ROD",
            "category_id": category["id"],
            "unit_of_measure": "KG",
        },
        h,
    )["id"]
    assert _global_stock(client, h, steel) == {}

    rid = _post(client, "/receipts", {"supplier": "ABC Traders"}, h)["id"]
    _post(
        client,
        f"/receipts/{rid}/items",
        {"product_id": steel, "location_id": stock_loc, "quantity": "100"},
        h,
    )
    for status in ("WAITING", "READY"):
        _ok(client.post(f"/receipts/{rid}/status", json={"status": status}, headers=h))
    _ok(client.post(f"/receipts/{rid}/validate", headers=h))
    assert _global_stock(client, h, steel) == {stock_loc: Decimal("100")}

    tid = _post(client, "/transfers", {"notes": ""}, h)["id"]
    _post(
        client,
        f"/transfers/{tid}/items",
        {
            "product_id": steel,
            "source_location_id": stock_loc,
            "destination_location_id": prod_loc,
            "quantity": "40",
        },
        h,
    )
    for status in ("WAITING", "READY"):
        _ok(client.post(f"/transfers/{tid}/status", json={"status": status}, headers=h))
    _ok(client.post(f"/transfers/{tid}/validate", headers=h))
    stock = _global_stock(client, h, steel)
    assert stock == {stock_loc: Decimal("60"), prod_loc: Decimal("40")}
    assert sum(stock.values()) == Decimal("100")

    # Delivering more than Production holds is rejected and changes nothing.
    too_big = _post(client, "/deliveries", {"notes": ""}, h)["id"]
    _post(
        client,
        f"/deliveries/{too_big}/items",
        {"product_id": steel, "location_id": prod_loc, "quantity": "41"},
        h,
    )
    _ok(client.post(f"/deliveries/{too_big}/pick", headers=h))
    _ok(client.post(f"/deliveries/{too_big}/pack", headers=h))
    r = client.post(f"/deliveries/{too_big}/validate", headers=h)
    assert r.status_code == 409 and r.json()["code"] == "INSUFFICIENT_STOCK"
    assert _ok(client.get(f"/deliveries/{too_big}", headers=h))["status"] == "READY"

    did = _post(client, "/deliveries", {"notes": ""}, h)["id"]
    _post(
        client,
        f"/deliveries/{did}/items",
        {"product_id": steel, "location_id": prod_loc, "quantity": "20"},
        h,
    )
    assert client.post(f"/deliveries/{did}/pack", headers=h).status_code == 409
    _ok(client.post(f"/deliveries/{did}/pick", headers=h))
    _ok(client.post(f"/deliveries/{did}/pack", headers=h))
    _ok(client.post(f"/deliveries/{did}/validate", headers=h))
    assert client.post(f"/deliveries/{did}/validate", headers=h).status_code == 409

    aid = _post(
        client,
        "/adjustments",
        {
            "product_id": steel,
            "location_id": prod_loc,
            "counted_quantity": "17",
            "reason": "Damaged",
        },
        h,
    )["id"]
    adjustment = _ok(client.post(f"/adjustments/{aid}/validate", headers=h))
    assert Decimal(adjustment["recorded_quantity"]) == Decimal("20")
    assert Decimal(adjustment["delta"]) == Decimal("-3")

    stock = _global_stock(client, h, steel)
    assert stock == {stock_loc: Decimal("60"), prod_loc: Decimal("17")}
    assert sum(stock.values()) == Decimal("77")

    ledger = _ok(client.get(f"/inventory/ledger?product_id={steel}", headers=h))
    movements = sorted((r["transaction_type"], Decimal(r["quantity"])) for r in ledger)
    assert movements == sorted(
        [
            ("RECEIPT", Decimal("100")),
            ("TRANSFER", Decimal("-40")),
            ("TRANSFER", Decimal("40")),
            ("DELIVERY", Decimal("-20")),
            ("ADJUSTMENT", Decimal("-3")),
        ]
    )
