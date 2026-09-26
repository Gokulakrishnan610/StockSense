"""
StockSense — Seed Script
========================
Scenario: "TechParts Pvt Ltd" — a B2B electronics & hardware distributor
running two warehouses (Chennai Main, Coimbatore Hub).

Run:
    cd backend
    .venv/bin/python seed.py

What it creates
---------------
Users
  • Gokul Krishnan  — INVENTORY_MANAGER  (gokul@techparts.in / Pass@1234)
  • Kirthika Devi   — WAREHOUSE_STAFF    (kirthika@techparts.in / Pass@1234)

Infrastructure
  • 2 Warehouses — Chennai Main (CHN), Coimbatore Hub (CBE)
  • 4 Locations each — Receiving Dock, Zone A (Bulk), Zone B (Pick Shelf), Dispatch Bay

Categories  (6 real B2B categories)
Products    (8 products with realistic SKUs, units, initial stock, reorder rules)

Operations (run through service layer — stock_balances & ledger stay consistent)
  1. REC-001 (notes tag)  — Vishay Electronics bulk stock-in      → DONE
  2. REC-002 (notes tag)  — Delta Electronics top-up              → DONE
  3. DEL-001 (notes tag)  — Infosys Pune B2B dispatch             → DONE
  4. TRF-001 (notes tag)  — CHN→CBE rebalance transfer            → DONE
  5. ADJ-001 (reason tag) — Bubble Wrap physical count adjustment  → DONE
  6. REC-003 (notes tag)  — Arrow Electronics (WAITING, pending)

Idempotent: the unique tag embedded in notes/reason is used for skip-checks.
"""

import sys
from decimal import Decimal

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.db import get_engine
from app.models import (
    Adjustment, Category, Delivery, Location, Product,
    Receipt, ReorderRule, Role, Transfer, User, Warehouse,
)
from app.security import password_hasher
from app.services import operations as ops


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def upsert_role(db, name):
    if not db.get(Role, name):
        db.add(Role(name=name))
        db.flush()


def find_user(db, login_id):
    return db.scalar(select(User).where(User.login_id == login_id))


def find_category(db, name):
    return db.scalar(select(Category).where(Category.name == name))


def find_warehouse(db, short_code):
    return db.scalar(select(Warehouse).where(Warehouse.short_code == short_code))


def find_location(db, warehouse_id, short_code):
    return db.scalar(
        select(Location).where(
            Location.warehouse_id == warehouse_id,
            Location.short_code == short_code,
        )
    )


def find_product(db, sku):
    return db.scalar(select(Product).where(Product.sku == sku))


# Skip-check helpers — search by unique seed tag embedded in the text field
def receipt_done(db, tag):
    """Return True if a DONE receipt carrying <tag> in its notes already exists."""
    return db.scalar(
        select(Receipt).where(Receipt.notes.contains(tag), Receipt.status == "DONE")
    ) is not None


def receipt_exists(db, tag):
    """Return True if any receipt carrying <tag> in its notes already exists."""
    return db.scalar(select(Receipt).where(Receipt.notes.contains(tag))) is not None


def delivery_done(db, tag):
    return db.scalar(
        select(Delivery).where(Delivery.notes.contains(tag), Delivery.status == "DONE")
    ) is not None


def transfer_done(db, tag):
    return db.scalar(
        select(Transfer).where(Transfer.notes.contains(tag), Transfer.status == "DONE")
    ) is not None


def adjustment_done(db, tag):
    return db.scalar(
        select(Adjustment).where(Adjustment.reason.contains(tag), Adjustment.status == "DONE")
    ) is not None


# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------

def seed():
    engine = get_engine()

    # ======================================================================= #
    # PASS 1 — static master data                                              #
    # ======================================================================= #
    with Session(engine) as db, db.begin():

        print("▶ Roles")
        upsert_role(db, "INVENTORY_MANAGER")
        upsert_role(db, "WAREHOUSE_STAFF")

        # ---- Users --------------------------------------------------------
        print("▶ Users")

        manager = find_user(db, "gokul@techparts.in")
        if not manager:
            manager = User(
                login_id="gokul@techparts.in",
                email="gokul@techparts.in",
                name="Gokul Krishnan",
                password_hash=password_hasher.hash("Pass@1234"),
                role="INVENTORY_MANAGER",
            )
            db.add(manager)
            db.flush()
            print("  + INVENTORY_MANAGER: gokul@techparts.in  /  Pass@1234")
        else:
            print("  ~ Manager already exists, skipped")

        staff = find_user(db, "kirthika@techparts.in")
        if not staff:
            staff = User(
                login_id="kirthika@techparts.in",
                email="kirthika@techparts.in",
                name="Kirthika Devi",
                password_hash=password_hasher.hash("Pass@1234"),
                role="WAREHOUSE_STAFF",
            )
            db.add(staff)
            db.flush()
            print("  + WAREHOUSE_STAFF:   kirthika@techparts.in  /  Pass@1234")
        else:
            print("  ~ Staff already exists, skipped")

        # ---- Warehouses ---------------------------------------------------
        print("▶ Warehouses")

        chn_wh = find_warehouse(db, "CHN")
        if not chn_wh:
            chn_wh = Warehouse(
                name="Chennai Main Warehouse",
                short_code="CHN",
                address=(
                    "Plot 14, Ambattur Industrial Estate, "
                    "Chennai – 600 058, Tamil Nadu, India"
                ),
            )
            db.add(chn_wh)
            db.flush()
            print("  + CHN — Chennai Main Warehouse")
        else:
            print("  ~ CHN already exists, skipped")

        cbe_wh = find_warehouse(db, "CBE")
        if not cbe_wh:
            cbe_wh = Warehouse(
                name="Coimbatore Hub",
                short_code="CBE",
                address=(
                    "SF No. 203, SIPCOT Industrial Park, Perundurai Road, "
                    "Coimbatore – 641 021, Tamil Nadu, India"
                ),
            )
            db.add(cbe_wh)
            db.flush()
            print("  + CBE — Coimbatore Hub")
        else:
            print("  ~ CBE already exists, skipped")

        # ---- Locations (4 per warehouse) ----------------------------------
        print("▶ Locations")

        def ensure_loc(wh, name, code):
            loc = find_location(db, wh.id, code)
            if not loc:
                loc = Location(name=name, short_code=code, warehouse_id=wh.id)
                db.add(loc)
                db.flush()
                print(f"  + [{wh.short_code}] {code} — {name}")
            else:
                print(f"  ~ [{wh.short_code}] {code} already exists")
            return loc

        ensure_loc(chn_wh, "Receiving Dock",        "RECV")
        ensure_loc(chn_wh, "Zone A – Bulk Storage", "ZONE-A")
        ensure_loc(chn_wh, "Zone B – Pick Shelf",   "ZONE-B")
        ensure_loc(chn_wh, "Dispatch Bay",           "DISP")

        ensure_loc(cbe_wh, "Receiving Dock",        "RECV")
        ensure_loc(cbe_wh, "Zone A – Bulk Storage", "ZONE-A")
        ensure_loc(cbe_wh, "Zone B – Pick Shelf",   "ZONE-B")
        ensure_loc(cbe_wh, "Dispatch Bay",           "DISP")

        # ---- Categories ---------------------------------------------------
        print("▶ Categories")
        cat_names = [
            "Electronic Components",
            "Cables & Connectors",
            "Power Supplies",
            "Networking Equipment",
            "Industrial Sensors",
            "Packaging Materials",
        ]
        cats = {}
        for cn in cat_names:
            c = find_category(db, cn)
            if not c:
                c = Category(name=cn)
                db.add(c)
                db.flush()
                print(f"  + {cn}")
            else:
                print(f"  ~ {cn} already exists")
            cats[cn] = c

        # ---- Products + Reorder Rules -------------------------------------
        print("▶ Products & Reorder Rules")

        # (sku, display_name, category, uom, initial_stock, min_stock, reorder_qty)
        specs = [
            (
                "EC-RES-470K-0402",
                "Resistor 470kΩ 1% 0402 SMD (Tape & Reel × 10 000)",
                "Electronic Components", "Reel",
                Decimal("120"), Decimal("20"), Decimal("50"),
            ),
            (
                "EC-CAP-100UF-25V-E",
                "Electrolytic Capacitor 100µF 25V Ø8×12mm",
                "Electronic Components", "Piece",
                Decimal("8500"), Decimal("1000"), Decimal("5000"),
            ),
            (
                "CC-CAT6-PATCH-3M-BLU",
                "Cat 6 Patch Cable 3 m Blue LSZH",
                "Cables & Connectors", "Piece",
                Decimal("340"), Decimal("50"), Decimal("100"),
            ),
            (
                "CC-USB-C-PD-1M-BLK",
                "USB-C PD 100 W Cable 1 m Black Braided",
                "Cables & Connectors", "Piece",
                Decimal("620"), Decimal("100"), Decimal("200"),
            ),
            (
                "PS-SMPS-24V-10A-DIN",
                "DIN Rail SMPS 24 VDC 10 A 240 W",
                "Power Supplies", "Unit",
                Decimal("75"), Decimal("10"), Decimal("20"),
            ),
            (
                "NE-SW-8P-MGMT-GIGABIT",
                "8-Port Managed Gigabit PoE+ Switch",
                "Networking Equipment", "Unit",
                Decimal("38"), Decimal("5"), Decimal("10"),
            ),
            (
                "IS-TEMP-PT100-3W-SS",
                "PT100 RTD Temperature Sensor 3-Wire Stainless Steel Probe 100 mm",
                "Industrial Sensors", "Piece",
                Decimal("92"), Decimal("15"), Decimal("30"),
            ),
            (
                "PM-BUBBLE-WRAP-50M",
                "Bubble Wrap Roll 50 m × 500 mm Anti-Static",
                "Packaging Materials", "Roll",
                Decimal("45"), Decimal("10"), Decimal("20"),
            ),
        ]

        for sku, name, cat_key, uom, init_stock, min_stock, reorder_qty in specs:
            p = find_product(db, sku)
            if not p:
                p = Product(
                    name=name,
                    sku=sku,
                    category_id=cats[cat_key].id,
                    unit_of_measure=uom,
                    initial_stock=init_stock,
                )
                db.add(p)
                db.flush()
                db.add(ReorderRule(
                    product_id=p.id,
                    minimum_stock=min_stock,
                    reorder_quantity=reorder_qty,
                ))
                db.flush()
                print(f"  + {sku}  ({uom})")
            else:
                print(f"  ~ {sku} already exists")

    # ======================================================================= #
    # Helper lambdas — each fetches a fresh id from its own mini-session       #
    # ======================================================================= #

    def get_manager_id():
        with Session(engine) as db:
            return find_user(db, "gokul@techparts.in").id

    def get_product_id(sku):
        with Session(engine) as db:
            return find_product(db, sku).id

    def get_location_id(wh_code, loc_code):
        with Session(engine) as db:
            wh = find_warehouse(db, wh_code)
            return find_location(db, wh.id, loc_code).id

    MID        = get_manager_id()
    CHN_ZONE_A = get_location_id("CHN", "ZONE-A")
    CHN_ZONE_B = get_location_id("CHN", "ZONE-B")
    CHN_RECV   = get_location_id("CHN", "RECV")
    CBE_ZONE_A = get_location_id("CBE", "ZONE-A")
    CBE_ZONE_B = get_location_id("CBE", "ZONE-B")

    # ======================================================================= #
    # PASS 2 — Operations                                                       #
    # ======================================================================= #

    # ---- REC-001 ----------------------------------------------------------
    # Tag embedded in notes for idempotency check
    REC001_TAG = "[SEED:REC-001]"
    print(f"\n▶ Receipt REC-001 (Vishay Electronics → CHN ZONE-A & RECV) → DONE")
    with Session(engine) as db, db.begin():
        if receipt_done(db, REC001_TAG):
            print("  ~ already done, skipped")
        else:
            r = ops.create_receipt(
                db,
                supplier="Vishay Electronics India Pvt Ltd",
                notes=(
                    f"{REC001_TAG} PO-2024-VE-001 | First bulk intake — resistors and capacitors. "
                    "Inspected by Gokul Krishnan on arrival. Pallet count: 6. "
                    "Delivery vehicle: TN 01 AZ 4521. All items sealed and in good condition."
                ),
                user_id=MID,
            )
            ops.add_receipt_item(db, r.id, product_id=get_product_id("EC-RES-470K-0402"),   location_id=CHN_ZONE_A, quantity=Decimal("5000"))
            ops.add_receipt_item(db, r.id, product_id=get_product_id("EC-CAP-100UF-25V-E"), location_id=CHN_RECV,   quantity=Decimal("3000"))
            ops.set_receipt_status(db, r.id, "WAITING")
            ops.set_receipt_status(db, r.id, "READY")
            v = ops.validate_receipt(db, r.id, user_id=MID)
            print(f"  + Validated → {v.id}")

    # ---- REC-002 ----------------------------------------------------------
    REC002_TAG = "[SEED:REC-002]"
    print(f"▶ Receipt REC-002 (Delta Electronics → CHN ZONE-A + CBE ZONE-A) → DONE")
    with Session(engine) as db, db.begin():
        if receipt_done(db, REC002_TAG):
            print("  ~ already done, skipped")
        else:
            r = ops.create_receipt(
                db,
                supplier="Delta Electronics India Pvt Ltd",
                notes=(
                    f"{REC002_TAG} PO-2024-DE-002 | Power supplies, switches, sensors, packaging. "
                    "Split delivery — partial consignment to CBE Hub. Invoice No. DE/2024/INV-7831. "
                    "ETA achieved on schedule; no damage reported."
                ),
                user_id=MID,
            )
            ops.add_receipt_item(db, r.id, product_id=get_product_id("PS-SMPS-24V-10A-DIN"),   location_id=CHN_ZONE_A, quantity=Decimal("30"))
            ops.add_receipt_item(db, r.id, product_id=get_product_id("NE-SW-8P-MGMT-GIGABIT"), location_id=CHN_ZONE_A, quantity=Decimal("15"))
            ops.add_receipt_item(db, r.id, product_id=get_product_id("IS-TEMP-PT100-3W-SS"),   location_id=CHN_ZONE_A, quantity=Decimal("40"))
            ops.add_receipt_item(db, r.id, product_id=get_product_id("PM-BUBBLE-WRAP-50M"),    location_id=CHN_ZONE_A, quantity=Decimal("20"))
            ops.add_receipt_item(db, r.id, product_id=get_product_id("CC-CAT6-PATCH-3M-BLU"),  location_id=CBE_ZONE_A, quantity=Decimal("150"))
            ops.add_receipt_item(db, r.id, product_id=get_product_id("CC-USB-C-PD-1M-BLK"),   location_id=CBE_ZONE_A, quantity=Decimal("200"))
            ops.set_receipt_status(db, r.id, "WAITING")
            ops.set_receipt_status(db, r.id, "READY")
            v = ops.validate_receipt(db, r.id, user_id=MID)
            print(f"  + Validated → {v.id}")

    # ---- DEL-001 ----------------------------------------------------------
    DEL001_TAG = "[SEED:DEL-001]"
    print(f"▶ Delivery DEL-001 (CHN ZONE-A → Infosys Pune) → DONE")
    with Session(engine) as db, db.begin():
        if delivery_done(db, DEL001_TAG):
            print("  ~ already done, skipped")
        else:
            d = ops.create_delivery(
                db,
                notes=(
                    f"{DEL001_TAG} SO-2024-INFY-0082 | Customer: Infosys Technopark, Pune. "
                    "Courier: Blue Dart Express — AWB 39201840012. "
                    "Packed by Kirthika Devi. Expected delivery: 3 working days. "
                    "Contact: procurement@infosys.com."
                ),
                user_id=MID,
            )
            ops.add_delivery_item(db, d.id, product_id=get_product_id("PS-SMPS-24V-10A-DIN"),   location_id=CHN_ZONE_A, quantity=Decimal("5"))
            ops.add_delivery_item(db, d.id, product_id=get_product_id("NE-SW-8P-MGMT-GIGABIT"), location_id=CHN_ZONE_A, quantity=Decimal("4"))
            ops.add_delivery_item(db, d.id, product_id=get_product_id("IS-TEMP-PT100-3W-SS"),   location_id=CHN_ZONE_A, quantity=Decimal("12"))
            ops.pick_delivery(db, d.id)
            ops.pack_delivery(db, d.id)
            v = ops.validate_delivery(db, d.id, user_id=MID)
            print(f"  + Validated → {v.id}")

    # ---- TRF-001 ----------------------------------------------------------
    TRF001_TAG = "[SEED:TRF-001]"
    print(f"▶ Transfer TRF-001 (CHN ZONE-A → CBE ZONE-B — rebalance) → DONE")
    with Session(engine) as db, db.begin():
        if transfer_done(db, TRF001_TAG):
            print("  ~ already done, skipped")
        else:
            t = ops.create_transfer(
                db,
                notes=(
                    f"{TRF001_TAG} Stock rebalance to CBE Hub ahead of Q3 customer deliveries. "
                    "Approved by Gokul Krishnan. Truck: TN 74 BG 2209. "
                    "Transit time approx. 6 hours. Load sealed with tamper-evident tape."
                ),
                user_id=MID,
            )
            ops.add_transfer_item(
                db, t.id,
                product_id=get_product_id("EC-RES-470K-0402"),
                source_location_id=CHN_ZONE_A,
                destination_location_id=CBE_ZONE_B,
                quantity=Decimal("20"),
            )
            ops.add_transfer_item(
                db, t.id,
                product_id=get_product_id("EC-CAP-100UF-25V-E"),
                source_location_id=CHN_RECV,
                destination_location_id=CBE_ZONE_B,
                quantity=Decimal("500"),
            )
            ops.set_transfer_status(db, t.id, "WAITING")
            ops.set_transfer_status(db, t.id, "READY")
            v = ops.validate_transfer(db, t.id, user_id=MID)
            print(f"  + Validated → {v.id}")

    # ---- ADJ-001 ----------------------------------------------------------
    ADJ001_TAG = "[SEED:ADJ-001]"
    print(f"▶ Adjustment ADJ-001 (CHN ZONE-A — Bubble Wrap physical count) → DONE")
    with Session(engine) as db, db.begin():
        if adjustment_done(db, ADJ001_TAG):
            print("  ~ already done, skipped")
        else:
            a = ops.create_adjustment(
                db,
                product_id=get_product_id("PM-BUBBLE-WRAP-50M"),
                location_id=CHN_ZONE_A,
                counted_quantity=Decimal("17"),   # system expected 20, counted 17
                reason=(
                    f"{ADJ001_TAG} Physical stock count on 2024-09-22 by Kirthika Devi. "
                    "3 rolls missing — likely damaged during REC-002 unloading "
                    "(shrink wrap torn, product rendered unusable). "
                    "Reported to Delta Electronics India for credit note. Ref: COUNT-2024-CHN-012."
                ),
                user_id=MID,
            )
            v = ops.validate_adjustment(db, a.id, user_id=MID)
            print(f"  + Validated (delta={v.delta}) → {v.id}")

    # ---- REC-003 (pending) ------------------------------------------------
    REC003_TAG = "[SEED:REC-003]"
    print(f"▶ Receipt REC-003 (Arrow Electronics → CHN ZONE-B) — WAITING (pending QC)")
    with Session(engine) as db, db.begin():
        if receipt_exists(db, REC003_TAG):
            print("  ~ already present, skipped")
        else:
            r = ops.create_receipt(
                db,
                supplier="Arrow Electronics India Pvt Ltd",
                notes=(
                    f"{REC003_TAG} PO-2024-AE-003 | USB-C cables & Cat6 patch leads top-up. "
                    "Expected arrival: 2024-09-28. GRN pending. "
                    "QC inspection by Kirthika Devi required before validation."
                ),
                user_id=MID,
            )
            ops.add_receipt_item(db, r.id, product_id=get_product_id("CC-USB-C-PD-1M-BLK"),   location_id=CHN_ZONE_B, quantity=Decimal("300"))
            ops.add_receipt_item(db, r.id, product_id=get_product_id("CC-CAT6-PATCH-3M-BLU"),  location_id=CHN_ZONE_B, quantity=Decimal("100"))
            ops.set_receipt_status(db, r.id, "WAITING")
            print(f"  + Created (WAITING) → {r.id}")

    print("\n✅  Seed complete!")
    print()
    print("  Login credentials")
    print("  ─────────────────────────────────────────────────────────────────")
    print("  Role: INVENTORY_MANAGER │ gokul@techparts.in     │ Pass@1234")
    print("  Role: WAREHOUSE_STAFF   │ kirthika@techparts.in  │ Pass@1234")
    print()


if __name__ == "__main__":
    try:
        seed()
    except Exception as exc:
        print(f"\n❌  Seed failed: {exc}", file=sys.stderr)
        raise
