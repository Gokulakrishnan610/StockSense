# StockSense Requirements and Traceability

This page restates the Odoo × GCET hackathon problem statement ([StockSense.pdf](StockSense.pdf)) and the Odoo-provided Excalidraw design ([board](https://app.excalidraw.com/l/65VNwvy7c4X/3ENvQFu9o8R), [local export](StockSense%20-%208%20hours.png)). Each requirement is mapped to the code that implements it.

**Status legend:** ✅ implemented · 🟡 partial or different from the design · ⛔ not implemented

## Contents

- [Problem statement summary](#problem-statement-summary)
- [Target users](#target-users)
- [Functional requirements](#functional-requirements)
- [Non-functional requirements](#non-functional-requirements)
- [Worked example from the problem statement](#worked-example-from-the-problem-statement)
- [Design differences](#design-differences)

## Problem statement summary

> Build a modular Inventory Management System that digitizes and streamlines all stock-related operations within a business.

The system replaces manual registers, spreadsheets and scattered tracking with a single real-time app. It covers products, warehouses and locations, and every stock movement: incoming receipts, outgoing deliveries, internal transfers and physical-count adjustments. Every movement is recorded in a stock ledger.

## Target users

| User | Needs | StockSense role |
| --- | --- | --- |
| Inventory Manager | Manage incoming and outgoing stock, maintain products and warehouse settings, monitor KPIs | `INVENTORY_MANAGER` |
| Warehouse Staff | Perform transfers, picking, shelving and counting | `WAREHOUSE_STAFF` |

Permissions are enforced by the `manager` dependency in [`backend/app/dependencies.py`](../backend/app/dependencies.py). Catalog and settings writes need a manager. Both roles can run stock operations.

## Functional requirements

### FR-1 Authentication

| ID | Requirement | Status | Implementation |
| --- | --- | --- | --- |
| FR-1.1 | User can sign up | ✅ | `POST /auth/signup` → [Signup.tsx](../frontend/src/pages/auth/Signup.tsx) |
| FR-1.2 | User can log in | ✅ | `POST /auth/login` accepts a login ID or an email → [Login.tsx](../frontend/src/pages/auth/Login.tsx) |
| FR-1.3 | OTP-based password reset | ✅ | `forgot-password` → `verify-otp` → `reset-password`; 6-digit code emailed through Celery; 10-minute expiry; 5 attempts |
| FR-1.4 | Redirect to the inventory dashboard after login | ✅ | Login response includes `redirect_to`; the SPA routes to `/dashboard` |
| FR-1.5 | Profile menu with My Profile and Logout | ✅ | `GET /auth/me`, `POST /auth/logout` (revokes all tokens) → [Profile.tsx](../frontend/src/pages/Profile.tsx) |

### FR-2 Dashboard

| ID | Requirement | Status | Implementation |
| --- | --- | --- | --- |
| FR-2.1 | KPI: Total products in stock | ✅ | Dashboard KPI strip from `GET /inventory/stock` |
| FR-2.2 | KPI: Low stock / out of stock items | ✅ | `GET /inventory/alerts/low-stock` plus products with zero balance |
| FR-2.3 | KPI: Pending receipts | ✅ | Open receipts (DRAFT, WAITING, READY) |
| FR-2.4 | KPI: Pending deliveries | ✅ | Open deliveries |
| FR-2.5 | KPI: Internal transfers scheduled | ✅ | Open transfers |
| FR-2.6 | Filter by document type (Receipts, Delivery, Internal, Adjustments) | ✅ | Pending-queue document filter |
| FR-2.7 | Filter by status (Draft, Waiting, Ready, Done, Canceled) | ✅ | Status filter; backend `?status=` on every list |
| FR-2.8 | Filter by warehouse or location | ✅ | Dashboard warehouse filter; ledger `warehouse_id` and `location_id` filters |
| FR-2.9 | Filter by product category | ✅ | Dashboard category filter; ledger `category_id` filter |

Code: [Dashboard.tsx](../frontend/src/pages/Dashboard.tsx), [useDashboardData.ts](../frontend/src/pages/dashboard/useDashboardData.ts), `GET /operations/summary`.

### FR-3 Product management

| ID | Requirement | Status | Implementation |
| --- | --- | --- | --- |
| FR-3.1 | Create and update products with name, SKU/code, category, unit of measure | ✅ | `POST/PUT /products`; SKU is unique |
| FR-3.2 | Initial stock (optional) | ✅ | `initial_stock` + `initial_location_id` posts an `INITIAL` ledger entry |
| FR-3.3 | Stock availability per location | ✅ | `GET /products/{id}/stock`, product detail page |
| FR-3.4 | Product categories | ✅ | `/categories` CRUD (delete only when unused) |
| FR-3.5 | Reordering rules | ✅ | `/reorder-rules` with `minimum_stock` and `reorder_quantity` |
| FR-3.6 | SKU search and smart filters | ✅ | `GET /products?search=&category_id=&warehouse_id=&location_id=` |

### FR-4 Receipts (incoming stock)

| ID | Requirement | Status | Implementation |
| --- | --- | --- | --- |
| FR-4.1 | Create a new receipt | ✅ | `POST /receipts` (DRAFT) |
| FR-4.2 | Add supplier and products | ✅ | `supplier` field; `POST /receipts/{id}/items` with product, location and quantity |
| FR-4.3 | Input quantities received | ✅ | Line `quantity > 0`, up to 4 decimals |
| FR-4.4 | Validate → stock increases automatically | ✅ | `POST /receipts/{id}/validate` → `RECEIPT` ledger rows, `+q` per line |

### FR-5 Delivery orders (outgoing stock)

| ID | Requirement | Status | Implementation |
| --- | --- | --- | --- |
| FR-5.1 | Pick items | ✅ | `POST /deliveries/{id}/pick` (DRAFT → WAITING) |
| FR-5.2 | Pack items | ✅ | `POST /deliveries/{id}/pack` (WAITING → READY) |
| FR-5.3 | Validate → stock decreases automatically | ✅ | `POST /deliveries/{id}/validate`; `409 INSUFFICIENT_STOCK` if any line is short, with nothing posted |
| FR-5.4 | Cancel | ✅ | `POST /deliveries/{id}/cancel` |

### FR-6 Internal transfers

| ID | Requirement | Status | Implementation |
| --- | --- | --- | --- |
| FR-6.1 | Move stock between warehouses and locations (Main Warehouse → Production Floor, Rack A → Rack B, Warehouse 1 → Warehouse 2) | ✅ | Transfer lines with `source_location_id` and `destination_location_id`; any location in any warehouse |
| FR-6.2 | Every movement is logged | ✅ | Two `TRANSFER` ledger rows per line (`:src`, `:dst`) |
| FR-6.3 | Total stock unchanged, location updated | ✅ | `−q` and `+q` in the same transaction |
| FR-6.4 | Reject a transfer to the same location | ✅ | `422 SAME_LOCATION` |

### FR-7 Stock adjustments

| ID | Requirement | Status | Implementation |
| --- | --- | --- | --- |
| FR-7.1 | Select product and location | ✅ | `POST /adjustments` |
| FR-7.2 | Enter counted quantity | ✅ | `counted_quantity >= 0`, reason required |
| FR-7.3 | System auto-updates and logs the adjustment | ✅ | Validate computes `delta = counted − recorded` and posts an `ADJUSTMENT` ledger row only when `delta ≠ 0` |

### FR-8 Move history (stock ledger)

| ID | Requirement | Status | Implementation |
| --- | --- | --- | --- |
| FR-8.1 | Log every stock movement | ✅ | Append-only `stock_ledger`, protected by triggers |
| FR-8.2 | Filter the history | ✅ | `GET /inventory/ledger?product_id&location_id&warehouse_id&category_id&transaction_type&reference_id&date_from&date_to` |
| FR-8.3 | Show before/after quantities and who did it | ✅ | `before_quantity`, `after_quantity`, `user_name` → [MoveHistory.tsx](../frontend/src/pages/operations/MoveHistory.tsx) |

### FR-9 Settings

| ID | Requirement | Status | Implementation |
| --- | --- | --- | --- |
| FR-9.1 | Warehouse settings | ✅ | `/warehouses` CRUD (no delete), warehouse detail page with its locations and stock |
| FR-9.2 | Multi-warehouse support | ✅ | Locations belong to a warehouse; balances are per location |
| FR-9.3 | Locations | ✅ | `/locations`; short code unique within its warehouse |

### FR-10 Additional features

| ID | Requirement | Status | Implementation |
| --- | --- | --- | --- |
| FR-10.1 | Low-stock alerts | ✅ | `GET /inventory/alerts/low-stock`, dashboard panel, SSE toast `LOW_STOCK_ALERT`, email to managers via Celery |
| FR-10.2 | Real-time updates | 🟡 | SSE toasts on every validation; pages refresh on navigation or reload, not automatically |
| FR-10.3 | Printable documents | 🟡 | Browser print slip on operation detail pages; no server-side PDF |

## Non-functional requirements

| ID | Requirement | Status | How |
| --- | --- | --- | --- |
| NFR-1 | Data integrity: no negative stock | ✅ | `CHECK quantity >= 0` + service check |
| NFR-2 | Audit trail cannot be changed | ✅ | Ledger triggers block `UPDATE`, `DELETE`, `TRUNCATE` |
| NFR-3 | Atomic multi-line operations | ✅ | One transaction per request; rollback on any failed line |
| NFR-4 | Safe under concurrency | ✅ | `FOR UPDATE` locks in UUID order; concurrency tests on PostgreSQL |
| NFR-5 | Idempotent postings | ✅ | Unique `entry_key` per movement |
| NFR-6 | Secure authentication | ✅ | Argon2, JWT with issuer and audience, token versioning, lockout, HMAC-stored OTP, `no-store` on auth responses |
| NFR-7 | Role-based access | ✅ | `manager` dependency on catalog writes |
| NFR-8 | Decimal precision | ✅ | `NUMERIC(18,4)`; quantities sent as strings |
| NFR-9 | Consistent error format | ✅ | `{code, message, errors?}` for every error |
| NFR-10 | Automated checks | 🟡 | 89 backend test cases and CI (ruff + pytest). See [TESTING.md](TESTING.md) for current results. |
| NFR-11 | Responsive UI | ✅ | Collapsible sidebar and responsive grids |

## Worked example from the problem statement

The problem statement walks one product through its full life. The same flow works in StockSense, and each step appears in Move History:

| Step | Problem statement | StockSense action | Ledger row |
| --- | --- | --- | --- |
| 1 | Receive goods from vendor: +100 kg steel | Receipt with one line (Steel, 100 kg, Main Store) → Waiting → Ready → Validate | `RECEIPT +100`, 0 → 100 |
| 2 | Move to production rack | Transfer Main Store → Production Rack, 100 kg → Validate | `TRANSFER −100` at Main Store, `TRANSFER +100` at Production Rack |
| 3 | Deliver finished goods: −20 | Delivery from Production Rack, 20 kg → Pick → Pack → Validate | `DELIVERY −20`, 100 → 80 |
| 4 | Adjust damaged items: −3 | Adjustment at Production Rack, counted 77, reason "Damaged" → Validate | `ADJUSTMENT −3`, 80 → 77 |

The automated test `test_member4_demo_flow_through_api` runs a flow like this end to end through the HTTP API.

## Design differences

The Excalidraw design is a reference, and a few details differ in the implementation. The main README lists them all under **Implementation notes and next steps**. In summary:

- Document references are shown as `REC-`, `DEL-`, `TRF-`, `ADJ-` plus the first 8 characters of the UUID, not as `WH/IN/0001`.
- There are no scheduled dates, so there are no "late" counts.
- Operation lists are tables. The Kanban view is not built.
- There are no stock reservations and no unit cost. Balances are on-hand quantities.
