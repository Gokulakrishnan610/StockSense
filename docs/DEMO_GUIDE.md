# StockSense Demo Guide

This guide explains how to load the sample company in [`backend/seed.py`](../backend/seed.py), which accounts to sign in with, and a short script that shows every requirement from the problem statement.

> Use the seed script only on a disposable demo database. It creates accounts with a shared, published password.

## Load the demo data

```bash
cd backend
alembic upgrade head
python seed.py            # Windows: set PYTHONIOENCODING=utf-8 first
```

The script is idempotent. Records that already exist are skipped, so you can run it again safely. To start over, drop and recreate the database, then run `alembic upgrade head` and `python seed.py` again.

## Demo accounts

| Role | Login (email or login ID) | Password | Can do |
| --- | --- | --- | --- |
| Inventory Manager | `gokul@techparts.in` | `Pass@1234` | Everything, including products, categories, warehouses, locations and reorder rules |
| Warehouse Staff | `kirthika@techparts.in` | `Pass@1234` | View everything; run receipts, deliveries, transfers and adjustments |

These accounts are created directly by the seed. Accounts created through public signup need a password of at least 10 characters.

## What the seed creates

**Company:** TechParts Pvt Ltd, an electronics and industrial parts distributor.

| Warehouse | Code | Locations |
| --- | --- | --- |
| Chennai Main Warehouse | `CHN` | `RECV` Receiving Dock, `ZONE-A` Bulk Storage, `ZONE-B` Pick Shelf, `DISP` Dispatch Bay |
| Coimbatore Hub | `CBE` | `RECV`, `ZONE-A`, `ZONE-B`, `DISP` |

**Categories:** Electronic Components, Cables & Connectors, Power Supplies, Networking Equipment, Industrial Sensors, Packaging Materials.

**Products (8, each with a reorder rule):**

| SKU | Min stock | Reorder qty |
| --- | --- | --- |
| `EC-RES-470K-0402` | 20 | 50 |
| `EC-CAP-100UF-25V-E` | 1000 | 5000 |
| `CC-CAT6-PATCH-3M-BLU` | 50 | 100 |
| `CC-USB-C-PD-1M-BLK` | 100 | 200 |
| `PS-SMPS-24V-10A-DIN` | 10 | 20 |
| `NE-SW-8P-MGMT-GIGABIT` | 5 | 10 |
| `IS-TEMP-PT100-3W-SS` | 15 | 30 |
| `PM-BUBBLE-WRAP-50M` | 10 | 20 |

**Operations:**

| Document | Status | What it does |
| --- | --- | --- |
| REC-001 (Vishay Electronics) | DONE | Receives resistors into CHN ZONE-A and capacitors into CHN RECV |
| REC-002 (Delta Electronics) | DONE | Receives six products into CHN ZONE-A and CBE ZONE-A |
| DEL-001 | DONE | Ships power supplies, switches and sensors from CHN ZONE-A |
| TRF-001 | DONE | Moves resistors and capacitors from Chennai to CBE ZONE-B |
| ADJ-001 | DONE | Bubble wrap count at CHN ZONE-A: system showed 20, counted 17, so the delta is −3 (damaged in unloading) |
| REC-003 (Arrow Electronics) | **WAITING** | 300 USB-C cables and 100 Cat6 cables into CHN ZONE-B. Left open for you to finish live. |

The UI shows references as `REC-`, `DEL-`, `TRF-`, `ADJ-` plus the first 8 characters of the document UUID. The seed labels above are tags in the notes.

## Demo script (about 4 minutes)

| Time | Screen | Show |
| --- | --- | --- |
| 0:00 | Login | Sign in as `gokul@techparts.in`. Mention OTP reset on the Forgot password link. |
| 0:20 | Dashboard | KPI strip, pending queue (REC-003 is waiting), low-stock panel, and the warehouse and category filters |
| 0:50 | Products | Search by SKU, open a product, and show stock per location and its reorder rule |
| 1:20 | Settings | Warehouses → Chennai detail with its 4 locations; Categories |
| 1:40 | Receipts | Open the waiting Arrow receipt → Mark Ready → **Validate**. A toast appears and USB-C stock goes up at CHN ZONE-B. |
| 2:10 | Deliveries | New delivery from CHN ZONE-B for 50 USB-C → Pick → Pack → Validate. Show the print slip. |
| 2:40 | Transfers | New transfer, CHN ZONE-B → CBE ZONE-A → Validate. The total is unchanged, and the location has changed. |
| 3:05 | Adjustments | Count a product lower than the system shows, add a reason, and validate. Show recorded quantity, counted quantity and the delta. |
| 3:25 | Move History | Filter by product: RECEIPT, DELIVERY, TRANSFER (−/+) and ADJUSTMENT rows with before/after and user |
| 3:45 | Role check | Sign in as `kirthika@techparts.in`: operations work, and catalog editing is blocked |

## Reset between recordings

```bash
# Replace the connection details with your own
psql -U stocksense -d postgres -c "DROP DATABASE stocksense_demo WITH (FORCE)"
psql -U stocksense -d postgres -c "CREATE DATABASE stocksense_demo"
cd backend && alembic upgrade head && python seed.py
```

Restart the backend after the reset so it does not hold connections to the old database.
