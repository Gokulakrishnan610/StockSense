<div align="center">
  <img src="logo.png" alt="StockSense logo" width="220" />
  <h1>StockSense</h1>
  <p>Inventory and warehouse management, from incoming goods to an auditable stock ledger.</p>
</div>

<div align="center">

[GitHub repository](https://github.com/Gokulakrishnan610/StockSense/) · [Problem statement](docs/StockSense.pdf) · [Excalidraw board](https://app.excalidraw.com/l/65VNwvy7c4X/3ENvQFu9o8R) · [API reference](docs/API.md)

</div>

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
| --- | --- | --- |
| **Backend Runtime** | Python 3.12 + Uvicorn | Mature `asyncio`, exact `Decimal` arithmetic, 30+ yr ecosystem |
| **Backend Framework** | FastAPI + Pydantic V2 | Runtime schema validation, auto OpenAPI `/docs`, structured 422 errors |
| **ORM & Migrations** | SQLAlchemy + Alembic | Full ORM power, DDL trigger migrations, row-level locking |
| **Database** | PostgreSQL 15 | ACID transactions, `NUMERIC(18,4)`, immutable ledger triggers |
| **Real-Time Events** | SSE (`text/event-stream`) | HTTP-native, zero client library, load-balancer transparent |
| **Background Tasks** | Celery + Redis | Durable task queue, process isolation, retry semantics |
| **Frontend** | React 18 + TypeScript + Vite | SPA with typed API client and custom CSS design system |
| **Email** | Nodemailer-compatible SMTP | HTML OTP emails via Celery worker |
| **Auth** | Argon2 + HS256 JWT | Secure password hashing, token-version invalidation |

---

## Contents

- [Tech Stack](#️-tech-stack)
- [Architectural Rationale & Technical Justifications](#-architectural-rationale--technical-justifications)
- [Documentation](#documentation)
- [Overview](#overview)
- [Features and permissions](#features-and-permissions)
- [Application flow](#application-flow)
- [Inventory workflows](#inventory-workflows)
- [Architecture and data flow](#architecture-and-data-flow)
- [Data model](#data-model)
- [API endpoints](#api-endpoints)
- [Local setup](#local-setup)
- [Checks and testing](#checks-and-testing)
- [Odoo-provided Excalidraw design](#odoo-provided-excalidraw-design)
- [Implementation notes and next steps](#implementation-notes-and-next-steps)
- [Repository structure](#repository-structure)

---

## 💡 Architectural Rationale & Technical Justifications

Every technology in StockSense was chosen deliberately — optimizing for **production correctness**, **operational safety**, and **long-term maintainability** over raw micro-benchmark numbers or novelty.

---

### 1. Why Python + FastAPI instead of JavaScript runtimes (Bun/Hono)?

**Mature Async I/O with Battle-Tested Tooling:**
FastAPI is built on Starlette and Uvicorn, which use Python's native `asyncio` event loop — the same foundation trusted by Discord, NASA, and thousands of production SaaS systems globally. Throughput claims about newer JavaScript runtimes often reflect synthetic HTTP-ping benchmarks, not the mixed I/O, ORM, and database-bound workloads that dominate inventory management systems.

**Python's Numeric Precision is Non-Negotiable for Inventory:**
StockSense uses Python's native `Decimal` type end-to-end (database `NUMERIC(18,4)` ↔ Pydantic `Decimal` ↔ JSON strings), guaranteeing exact arithmetic for stock balances, ledger deltas, and adjustments. JavaScript/TypeScript uses IEEE 754 floating-point by default; without careful per-field handling, float arithmetic silently corrupts quantities at scale.

**Pydantic V2 > Runtime Type Checking in JS Runtimes:**
FastAPI's Pydantic V2 models (compiled via Rust) provide schema validation, serialization, OpenAPI generation, and self-documenting Swagger UI (`/docs`, `/redoc`) from a single source of truth. TypeScript's compile-time types vanish at runtime — any runtime schema mismatch produces silent `undefined` bugs rather than a validated 422 error with a structured payload.

**Ecosystem Depth:**
Python's ecosystem for data science, reporting, ML integration, and async task processing (Celery, SQLAlchemy, Alembic) has 30+ years of production hardening. Bun and Hono are < 3 years old; running them in production for financial inventory mutations introduces unnecessary early-adopter risk.

---

### 2. Why SQLAlchemy + Alembic instead of newer ORMs (Drizzle)?

**Schema Migrations are a First-Class Concern:**
Alembic provides version-controlled, reviewable, and reversible migration scripts. StockSense's Alembic migrations include PostgreSQL-level DDL triggers that immutably protect the audit ledger — something a lightweight ORM cannot easily express. Schema evolution in production inventory systems is not optional; it must be traceable and rollback-safe.

**Declarative Models + Full ORM Power:**
SQLAlchemy's declarative models give full Python-side control: `relationship()` loading strategies, event hooks (`@event.listens_for`), column-level encryption, and custom types. For a domain as relationship-heavy as inventory (products ↔ locations ↔ balances ↔ ledger ↔ operations ↔ items), the expressive power of a full ORM eliminates entire categories of join-assembly bugs.

**Row-Level Locking with Explicit Session Semantics:**
StockSense explicitly uses `SELECT ... FOR UPDATE` via SQLAlchemy `with_for_update()` on product rows, sorted by UUID to prevent deadlocks across concurrent validations. The transaction boundary is the FastAPI dependency-injected `Session`, which commits on response success and rolls back on any exception — a deterministic, auditable guarantee.

**Reliability Over Query-Builder Minimalism:**
Lightweight query-builder ORMs optimize for "clean SQL output" as a selling point. But correctness, not aesthetics, is the priority when a ledger entry represents a physical goods movement. SQLAlchemy's session-level identity map, flush semantics, and lazy/eager load controls prevent subtle phantom-read issues that a thin query builder leaves entirely to the developer.

---

### 3. Why Server-Sent Events (SSE) instead of WebSockets?

**Right Tool for a Unidirectional Data Stream:**
StockSense notifications are inherently **server-to-client**: stock update alerts, low-stock warnings, and operation confirmations flow from the backend to browsers. SSE (`text/event-stream`) is the HTTP-native, RFC-standardized protocol for exactly this use case — with automatic browser reconnection, standard HTTP/2 multiplexing, and zero handshake overhead.

**No Protocol Upgrade Complexity:**
WebSockets require an HTTP→WS protocol upgrade (`Upgrade: websocket`), a separate connection lifecycle, custom heartbeat/ping-pong management, and bespoke auth handshake logic — all of which must be built and maintained from scratch. SSE rides on standard HTTP with `Authorization` headers, CDN caching, and reverse-proxy support out of the box.

**Lightweight and Load-Balancer Friendly:**
SSE connections are plain long-lived HTTP responses. They pass transparently through every HTTP/1.1 and HTTP/2 proxy, load balancer, and CDN without special configuration. WebSocket connections require sticky sessions or a shared pub/sub broker (Redis, etc.) to function correctly behind a load balancer — adding infrastructure complexity that a 8-hour hackathon system cannot reliably validate.

**Bi-Directional Communication is Overkill for Inventory Notifications:**
Inventory dashboards are read-heavy. Mutations happen via standard REST `POST`/`PATCH` endpoints — which already use HTTP with full request validation, error codes, and OpenAPI documentation. Forcing those mutations through a WebSocket message bus adds a second, parallel, schema-less communication channel that duplicates the REST layer without adding value.

**Browser Native, Zero Client Library Required:**
The `EventSource` API is built into every modern browser. No client-side WebSocket library, connection management wrapper, or reconnect logic needs to be bundled — reducing frontend bundle size and eliminating a class of client-side bugs.

---

### 4. Why Celery + Redis for Background Tasks instead of in-process async workers?

**Process Isolation for Email Delivery:**
SMTP operations are slow, failure-prone (network timeouts, relay rejections), and should never block an HTTP request-response cycle. StockSense offloads all email tasks — OTP delivery, password reset notifications — to a Celery worker process, ensuring that an SMTP outage never delays a stock validation response.

**Durable Task Queue with Retry Semantics:**
Redis-backed Celery tasks survive API server restarts. If the worker is temporarily unavailable, tasks queue in Redis and are processed when the worker recovers. An in-process `asyncio.create_task()` approach loses all queued work on server crash — unacceptable for transactional email in a production inventory system.

**Operational Observability:**
Celery provides first-class task state tracking (`PENDING`, `STARTED`, `SUCCESS`, `FAILURE`), retry policies, dead-letter queuing, and integrates with monitoring tools (Flower, Prometheus exporters). This is production-grade background job infrastructure, not a prototype.

---

### 5. Why PostgreSQL Triggers for Ledger Immutability?

**Database-Level Enforcement, Not Application-Level Hope:**
StockSense's Alembic migrations install PostgreSQL DDL triggers (`BEFORE UPDATE`, `BEFORE DELETE`, `BEFORE TRUNCATE`) directly on `stock_ledger`. No application code, ORM quirk, or future developer can accidentally mutate or delete an audit entry — the database physically rejects it. Application-layer immutability checks are bypassable by raw SQL clients, migration scripts, or bugs; database triggers are not.

---

> **Design Philosophy:** StockSense chooses proven, composable primitives — Python, FastAPI, SQLAlchemy, SSE, Celery — that have individually earned trust in large-scale production systems. Combining niche or newly-emerged runtimes with query builders and WebSocket pub/sub buses may produce impressive benchmark numbers; it does not produce auditable, maintainable inventory infrastructure.

---

## Documentation

| Document | What it covers |
| --- | --- |
| [Requirements](docs/REQUIREMENTS.md) | Problem statement, target users, and a requirement-to-code traceability matrix |
| [System design](docs/SYSTEM_DESIGN.md) | Architecture, auth, operation state machine, stock flows, locking, events and configuration |
| [Database and ER diagram](docs/DATABASE.md) | Full ER diagram, every table and constraint, integrity guarantees and migrations |
| [API reference](docs/API.md) | Every endpoint with access rules, request bodies, filters and errors |
| [Technical decisions](docs/TECHNICAL_DECISIONS.md) | Architecture decision records and their trade-offs |
| [Testing](docs/TESTING.md) | Test strategy, suite inventory, current results, CI and a manual checklist |
| [Demo guide](docs/DEMO_GUIDE.md) | Seed data, demo accounts and a timed demo script |
| [Docs index](docs/README.md) | All documents with a suggested reading order |

---

## ✅ Problem Statement Compliance

> *"Build a modular Inventory Management System that digitizes and streamlines all stock-related operations within a business — replacing manual registers, Excel sheets, and scattered tracking with a centralized, real-time, easy-to-use app."*
> — Odoo × GCET Hackathon Problem Statement

Every requirement from the Odoo problem statement is addressed. Below is a full traceability map with implementation details and bonus features delivered beyond the spec.

### 🔐 Authentication

| What Odoo Asked | What We Built | ⭐ Bonus |
| --- | --- | --- |
| User signup & login | `POST /auth/signup`, `POST /auth/login` — accepts login ID **or** email | Login ID validation (6–64 chars, alphanumeric), duplicate-email guard |
| OTP-based password reset | 3-step flow: `forgot-password → verify-otp → reset-password`; 6-digit code, 10-min expiry, 5 max attempts | HMAC-stored OTP (not plaintext), 60-sec resend cooldown, single-use reset token |
| Redirect to dashboard after login | `redirect_to` in login response; SPA routes to `/dashboard` automatically | Token-version invalidation — logout kills **all** sessions, not just current |
| Profile menu with My Profile & Logout | `GET /auth/me`, `POST /auth/logout` | Argon2 password hashing + HS256 JWT with issuer/audience/expiry checks |

### 📊 Dashboard

| What Odoo Asked | What We Built | ⭐ Bonus |
| --- | --- | --- |
| KPI: Total Products in Stock | Live count from `GET /inventory/stock` | Per-warehouse and per-location breakdown |
| KPI: Low Stock / Out of Stock Items | `GET /inventory/alerts/low-stock` + zero-balance products | SSE real-time toast + Celery email to managers on breach |
| KPI: Pending Receipts | Open receipts (DRAFT, WAITING, READY) via `GET /operations/summary` | Pending count badge on sidebar nav items |
| KPI: Pending Deliveries | Open deliveries (same API) | — |
| KPI: Internal Transfers Scheduled | Open transfers (same API) | — |
| Filter by document type | Receipt / Delivery / Internal / Adjustment tab filter | Combined filter with status simultaneously |
| Filter by status | DRAFT, WAITING, READY, DONE, CANCELED | `?status=` query param on every list endpoint |
| Filter by warehouse or location | Warehouse + location dropdowns on dashboard and ledger | Cascading: selecting warehouse auto-narrows location list |
| Filter by product category | Category filter on dashboard and move history | Category CRUD with delete-guard (cannot delete if products reference it) |

### 📦 Product Management

| What Odoo Asked | What We Built | ⭐ Bonus |
| --- | --- | --- |
| Create products: Name, SKU, Category, UOM | `POST /products` with all fields; SKU globally unique | `PUT /products/{id}` full update; SKU immutability enforced |
| Initial stock (optional) | `initial_stock` + `initial_location_id` → posts `INITIAL` ledger entry | Opening stock visible in Move History from day one |
| Stock availability per location | `GET /products/{id}/stock` — per-location balance breakdown | Zero-balance locations shown; product detail page aggregates totals |
| Product categories | `/categories` CRUD | Delete blocked if any product references the category |
| Reorder rules | `/reorder-rules` with `minimum_stock` + `reorder_quantity` | Auto low-stock alert triggers when balance falls below rule threshold |
| SKU search & smart filters | `GET /products?search=&category_id=&warehouse_id=&location_id=` | Real-time frontend search debounce; multi-filter combination |

### 📥 Receipts (Incoming Stock)

| What Odoo Asked | What We Built | ⭐ Bonus |
| --- | --- | --- |
| Create a new receipt | `POST /receipts` → DRAFT status | Supplier field + reference auto-generated as `REC-{uuid8}` |
| Add supplier & products | `supplier` header + `POST /receipts/{id}/items` per line | Multi-line receipt with per-line destination location |
| Input quantities received | `quantity > 0`, up to 4 decimal places | Quantity stored as `NUMERIC(18,4)` — no float drift |
| Validate → stock increases | `POST /receipts/{id}/validate` → `RECEIPT` ledger rows, `+q` per line | **Atomic**: all lines succeed or all roll back. SSE toast fires immediately. |
| DRAFT → WAITING → READY → DONE flow | Full 4-stage workflow with `mark-waiting`, `mark-ready`, `validate` | `DONE` and `CANCELED` documents immutable — no re-edit or re-validate |

### 📤 Delivery Orders (Outgoing Stock)

| What Odoo Asked | What We Built | ⭐ Bonus |
| --- | --- | --- |
| Pick items | `POST /deliveries/{id}/pick` (DRAFT → WAITING) | Pick action logs actor (`created_by`) |
| Pack items | `POST /deliveries/{id}/pack` (WAITING → READY) | — |
| Validate → stock decreases | `POST /deliveries/{id}/validate` deducts per line | `409 INSUFFICIENT_STOCK` returned atomically — nothing posted on failure |
| Cancel | `POST /deliveries/{id}/cancel` | Cancel blocked on DONE documents |

### 🔁 Internal Transfers

| What Odoo Asked | What We Built | ⭐ Bonus |
| --- | --- | --- |
| Move stock: Main Warehouse → Production Floor, Rack A → Rack B, Warehouse 1 → Warehouse 2 | Transfer lines with `source_location_id` + `destination_location_id`; any location pair across any warehouse | — |
| Every movement logged in ledger | Two `TRANSFER` ledger rows per line (`:src` and `:dst`) | `entry_key` uniqueness prevents duplicate postings |
| Total stock unchanged, location updated | `−q` and `+q` in the **same DB transaction** | Global balance invariant enforced at service layer |
| Reject same-location transfer | `422 SAME_LOCATION` error | Validated at both API schema layer (Pydantic) and service layer |

### 🔧 Stock Adjustments

| What Odoo Asked | What We Built | ⭐ Bonus |
| --- | --- | --- |
| Select product & location | `POST /adjustments` with `product_id`, `location_id` | — |
| Enter counted quantity | `counted_quantity >= 0`, reason required | Reason is mandatory — no silent quantity changes |
| System auto-updates & logs | `delta = counted − recorded`; posts `ADJUSTMENT` ledger row only if delta ≠ 0 | Zero-delta adjustments skip the ledger cleanly (no noise in history) |

### 📜 Move History (Stock Ledger)

| What Odoo Asked | What We Built | ⭐ Bonus |
| --- | --- | --- |
| Log every stock movement | Append-only `stock_ledger` table | PostgreSQL `BEFORE UPDATE / DELETE / TRUNCATE` triggers make it **physically immutable** |
| Filter the history | `GET /inventory/ledger?product_id&location_id&warehouse_id&category_id&transaction_type&reference_id&date_from&date_to` | 8-dimension filter combination in one query |
| Show before/after quantities & who did it | `before_quantity`, `after_quantity`, `user_name` displayed in table | Reference links back to originating operation document |

### ⚙️ Settings

| What Odoo Asked | What We Built | ⭐ Bonus |
| --- | --- | --- |
| Warehouse settings | `/warehouses` full CRUD (no delete to preserve ledger integrity) | Warehouse detail page shows all locations + live stock totals |
| Multi-warehouse support | Locations belong to a warehouse; balances are per product × location | Transfer across warehouses natively supported |
| Locations | `/locations` with short code unique within its warehouse | Location codes prevent naming collisions across warehouses |

### ⭐ Beyond the Spec — Bonus Features

| Feature | Description |
| --- | --- |
| **Real-Time SSE Notifications** | `GET /stream` broadcasts `STOCK_UPDATE` and `LOW_STOCK_ALERT` events; browser renders toast without polling |
| **Celery Email Worker** | OTP emails, low-stock manager alerts via background Celery task with Redis broker — SMTP outage never blocks HTTP responses |
| **Immutable Audit Triggers** | PostgreSQL DDL triggers on `stock_ledger` physically block any mutation — not just application-level guards |
| **Concurrent Validation Safety** | `SELECT ... FOR UPDATE` on product rows in sorted UUID order prevents deadlocks under parallel validation |
| **Idempotent Ledger Entries** | `entry_key` unique constraint makes ledger posting safe to retry without double-counting |
| **OTP Security Hardening** | HMAC-stored OTP (not plaintext), 60-sec resend cooldown, 5-attempt lockout, single-use reset token |
| **Role-Based Access Control** | `INVENTORY_MANAGER` vs `WAREHOUSE_STAFF`; manager dependency guards all catalog write endpoints |
| **Seed Dataset** | `seed.py` populates 50+ products, categories, warehouses, locations, and demo accounts for instant demo |
| **Swagger / ReDoc Auto-docs** | FastAPI + Pydantic V2 auto-generates OpenAPI 3.1 schema at `/docs` and `/redoc` — zero extra effort |
| **Printable Operation Slips** | Browser print-optimized CSS on every operation detail page |
| **89 Backend Test Cases** | pytest suite covering auth, catalog, stock math, operation workflows, concurrency, and ledger integrity |

---

## Overview

StockSense centralizes products, warehouse locations, incoming receipts, outgoing deliveries, internal transfers, and physical stock counts. Inventory managers maintain the catalog; warehouse staff execute stock operations. Validated movements update location balances and record signed changes in the stock ledger.

The [StockSense problem statement](docs/StockSense.pdf) and Excalidraw designs describe the intended product. This README describes the current local implementation; differences from those designs are listed below. The linked GitHub repository is the configured `origin` remote. Design annotations are reference material, not proof that a feature is implemented.

## Features and permissions

| Area | Current functionality |
| --- | --- |
| Authentication | Signup, login with login ID or email, profile, logout, OTP password reset |
| Dashboard | Stock overview, low/out-of-stock indicators, pending operation queues, document/status/warehouse/location/category filters |
| Products | SKU/name search, categories, units of measure, opening stock, per-location balances, reorder rules |
| Receipts | Supplier, product lines, receiving locations, workflow actions, validation |
| Deliveries | Product lines, source locations, pick, pack, stock validation, cancellation |
| Internal transfers | Source and destination locations, workflow actions, paired stock movements |
| Adjustments | Physical count, required reason, recorded/count difference, validation |
| Move history | Movement type, product, location, warehouse, category, reference, date range, acting user |
| Warehouse settings | Multiple warehouses and locations within each warehouse |
| Notifications | SSE toast notifications and Celery email tasks; see current limitations below |
| Printing | Browser print slips for operation documents; no server PDF endpoint |

| Action | Inventory manager | Warehouse staff |
| --- | --- | --- |
| Read catalog, stock, dashboard, and ledger | Yes | Yes |
| Create/update products, categories, warehouses, locations, reorder rules | Yes | No |
| Delete an unreferenced category | Yes | No |
| Create and process receipts, deliveries, transfers, adjustments | Yes | Yes |
| View own profile and log out | Yes | Yes |

Public signup always creates `WAREHOUSE_STAFF`. A local administrator promotes a user with `python -m app.admin promote EMAIL`. There is no public role-assignment API, and operation routes currently do not impose manager-only or creator-only restrictions.

## Application flow

```mermaid
flowchart TD
    Start[Open StockSense] --> Session{Valid session?}
    Session -->|No| Login[Login]
    Login --> Signup[Create account]
    Signup --> Login
    Login --> Reset[Forgot password: email, OTP, new password]
    Reset --> Login
    Login -->|Authenticated| Dashboard[Inventory dashboard]
    Session -->|Yes| Dashboard
    Dashboard --> Products[Products, categories and reorder rules]
    Dashboard --> Operations[Operations]
    Dashboard --> History[Move history]
    Dashboard --> Settings[Warehouses and locations]
    Dashboard --> Profile[My profile]
    Operations --> Receipts[Receipts]
    Operations --> Deliveries[Deliveries]
    Operations --> Transfers[Internal transfers]
    Operations --> Adjustments[Inventory adjustments]
    Profile --> Logout[Logout and revoke sessions]
    Logout --> Login
```

Authentication uses Argon2 password hashing and HS256 JWTs with issuer, audience, expiry, and token-version checks. Logout and password reset invalidate the user's existing sessions. Login IDs accept 6–64 letters, numbers, underscores, dots, or hyphens; passwords accept 10–128 characters. These are the implemented rules, which differ from the early wireframe notes.

Password recovery follows `forgot-password → verify-otp → reset-password`. Codes expire after 10 minutes, allow five attempts, and have a 60-second resend cooldown. Verification returns a single-use reset token. SMTP and a running Celery worker are needed for email delivery.

### First-use walkthrough

1. Start the services using [Local setup](#local-setup), sign up, and promote the catalog administrator.
2. Create a warehouse, its locations, and a product category.
3. Create a product with SKU, unit, and optional opening stock/location. Add a reorder rule if needed.
4. Receive goods, deliver goods, or transfer them between locations through Operations.
5. Use an adjustment to reconcile a physical count; inspect Move History to see each stock change.

## Inventory workflows

Saving a draft or advancing a workflow does not itself receive, ship, or move goods. Use the operation's **Validate** action to post stock changes. `DONE` and `CANCELED` documents cannot be edited through the normal service methods. See the status-endpoint caveat in [Implementation notes](#implementation-notes-and-next-steps).

### Receipts and internal transfers

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Create document and add lines
    DRAFT --> WAITING: Mark as Waiting
    WAITING --> READY: Mark as Ready
    READY --> DONE: Validate and post stock
    DRAFT --> CANCELED: Cancel
    WAITING --> CANCELED: Cancel
    READY --> CANCELED: Cancel
    DONE --> [*]
    CANCELED --> [*]
```

For receipts, enter the supplier and a product, destination location, and positive quantity for each line. Validation adds stock at those locations. For transfers, each line contains a product, two distinct locations, and a positive quantity. Validation subtracts from the source and adds the same amount to the destination within one database transaction.

### Deliveries

```mermaid
flowchart LR
    Draft[DRAFT: create and add lines] -->|Pick| Waiting[WAITING: picked]
    Waiting -->|Pack| Ready[READY: packed]
    Ready --> Check{Enough source stock?}
    Check -->|Validate succeeds| Done[DONE: deduct stock and log movement]
    Check -->|Validation fails| Retry[409 conflict: replenish or revise]
    Retry --> Ready
    Draft -->|Cancel| Canceled[CANCELED]
    Waiting -->|Cancel| Canceled
    Ready -->|Cancel| Canceled
```

The current delivery `WAITING` status means Pick has completed. It does not automatically track replenishment or reserve stock. Stock availability is enforced when validating; competing deliveries may therefore fail validation after earlier checks appeared sufficient.

### Adjustments

```mermaid
flowchart LR
    Count[Choose product and location, enter physical count and reason] --> Draft[DRAFT]
    Draft -->|Validate| Difference[Delta = counted minus current recorded quantity]
    Difference --> Changed{Delta is nonzero?}
    Changed -->|Yes| Ledger[Update balance and append ledger entry]
    Changed -->|No| NoChange[No stock or ledger change]
    Ledger --> Done[DONE]
    NoChange --> Done
    Draft -->|Cancel| Canceled[CANCELED]
```

The recorded quantity is read at validation time. Adjustments go directly from `DRAFT` to `DONE`; they do not use pick, pack, Waiting, or Ready. A zero-difference adjustment currently also skips the validation counter and stock notification.

### Worked stock example

Starting with zero stock, using the same product in KG throughout:

| Step | Action | Main Store | Production Rack | Total |
| --- | --- | ---: | ---: | ---: |
| 1 | Receive 100 KG into Main Store | 100 | 0 | 100 |
| 2 | Transfer all 100 KG to Production Rack | 0 | 100 | 100 |
| 3 | Deliver 20 KG from Production Rack | 0 | 80 | 80 |
| 4 | Count 77 KG after 3 KG is damaged; validate adjustment | 0 | 77 | 77 |

The transfer writes two ledger entries (`-100`, `+100`); the other stock changes each write a signed delta. This example does not imply a manufacturing or raw-material conversion feature.

## Architecture and data flow

```mermaid
flowchart LR
    UI[React and TypeScript UI] -->|REST via /api proxy| API[FastAPI routes and auth dependencies]
    API --> Services[Catalog, auth and operation services]
    Services -->|SQLAlchemy transactions| DB[(PostgreSQL)]
    Services -->|Validation metrics| Redis[(Redis)]
    Services -->|Queue email tasks| Redis
    Redis --> Worker[Celery worker]
    Worker --> SMTP[SMTP server]
    Services --> Events[In-process SSE broadcaster]
    Events -->|/stream| Toast[Browser toast notifications]
```

The frontend uses React Router, custom CSS, and Lucide icons. The backend uses FastAPI, Pydantic, SQLAlchemy, Alembic, and PostgreSQL. Redis supplies the Celery broker/result backend and supplemental validation counters. PostgreSQL remains the source of truth for operation status and stock balances.

### Validation data flow

```mermaid
sequenceDiagram
    actor User
    participant UI as React UI
    participant API as FastAPI
    participant Service as Operation service
    participant DB as PostgreSQL
    participant Side as Redis / Celery / SSE
    User->>UI: Validate operation
    UI->>API: POST /receipts/{id}/validate (example)
    API->>API: Check JWT and input
    API->>Service: Validate document
    Service->>DB: Lock document, verify state and lines
    Service->>DB: Lock products in ascending UUID order
    Service->>DB: Apply deltas and insert ledger rows
    Service->>DB: Set DONE and flush
    Service->>Side: Counter, stock event and applicable low-stock alerts
    Note over Service,Side: Current side effects run before DB commit
    Service-->>API: Operation result
    API->>DB: Session dependency commits, rolls back on error
    API-->>UI: Operation response
    UI->>API: Reload document and stock details
```

`apply_delta` locks product rows, changes the product/location balance, and appends a ledger entry within the caller's transaction. Multi-product validation locks products in sorted UUID order. Ledger entry keys identify individual operation lines/transfer legs; an exact service-level replay reuses the existing entry. Repeating a completed operation's HTTP validation is rejected by its status check, rather than returning a second successful validation.

SSE currently displays `STOCK_UPDATE` and `LOW_STOCK_ALERT` toasts. It does not automatically refresh every dashboard query. Notifications and Redis counters are not transactionally coupled to PostgreSQL; they should not be used as authoritative audit records.

## Data model

```mermaid
erDiagram
    ROLES ||--o{ USERS : grants
    USERS ||--o| PASSWORD_RESETS : has
    CATEGORIES ||--o{ PRODUCTS : classifies
    WAREHOUSES ||--o{ LOCATIONS : contains
    PRODUCTS ||--o| REORDER_RULES : has
    PRODUCTS ||--o{ STOCK_BALANCES : tracks
    LOCATIONS ||--o{ STOCK_BALANCES : stores
    PRODUCTS ||--o{ STOCK_LEDGER : records
    LOCATIONS ||--o{ STOCK_LEDGER : records
    USERS ||--o{ STOCK_LEDGER : performs
    RECEIPTS ||--o{ RECEIPT_ITEMS : contains
    DELIVERIES ||--o{ DELIVERY_ITEMS : contains
    TRANSFERS ||--o{ TRANSFER_ITEMS : contains
    PRODUCTS ||--o{ RECEIPT_ITEMS : received
    PRODUCTS ||--o{ DELIVERY_ITEMS : shipped
    PRODUCTS ||--o{ TRANSFER_ITEMS : moved
    PRODUCTS ||--o{ ADJUSTMENTS : counted
    LOCATIONS ||--o{ ADJUSTMENTS : counted_at
```

This diagram shows the main relationships. See [docs/DATABASE.md](docs/DATABASE.md) for the full ER diagram with columns, constraints and integrity rules; [models.py](backend/app/models.py) is the source of truth.

| Table group | Purpose |
| --- | --- |
| `roles`, `users`, `password_resets` | Access roles, profiles, credential/session state, recovery challenges |
| `categories`, `products`, `reorder_rules` | Product identity, unit, opening-stock metadata, product-wide thresholds |
| `warehouses`, `locations` | Warehouse configuration and physical storage locations |
| `receipts`, `receipt_items` | Incoming documents and product/location lines |
| `deliveries`, `delivery_items` | Outgoing documents and product/location lines |
| `transfers`, `transfer_items` | Transfer documents and source/destination lines |
| `adjustments` | Counted quantity, recorded quantity, computed delta, reason |
| `stock_balances` | Current nonnegative quantity, keyed by product and location |
| `stock_ledger` | Signed delta, before/after quantities, reference, locations, actor, timestamp |

Quantities use PostgreSQL `NUMERIC(18,4)` and Python `Decimal`; send them as JSON strings to preserve precision. `after_quantity = before_quantity + quantity`. Transfers preserve the global total, and negative balances are rejected. PostgreSQL triggers reject ledger updates, deletes, and truncation. `products.initial_stock` is historical opening metadata, not the live balance.

## API endpoints

**Direct backend base:** `http://localhost:8000`. Backend paths have no `/api` prefix. The Vite development proxy maps browser `/api/...` requests to the backend with `/api` removed. For example, the browser calls `/api/receipts`, while a direct API client calls `/receipts`.

Use `Authorization: Bearer <access_token>` on protected requests and `Content-Type: application/json` for JSON bodies. Swagger UI is at [localhost:8000/docs](http://localhost:8000/docs), ReDoc at [localhost:8000/redoc](http://localhost:8000/redoc), and the machine-readable schema at [localhost:8000/openapi.json](http://localhost:8000/openapi.json).

| Area | Main endpoints |
| --- | --- |
| Authentication | `POST /auth/signup`, `/auth/login`, `/auth/forgot-password`, `/auth/verify-otp`, `/auth/reset-password`, `/auth/logout`; `GET /auth/me` |
| Products | `GET/POST /products`; `GET/PUT /products/{id}`; `GET /products/{id}/stock` |
| Catalog/settings | Categories, warehouses, locations, reorder rules; see full method list below |
| Receipts | `GET/POST /receipts`; detail/update, items, status, validate |
| Deliveries | `GET/POST /deliveries`; detail/update, items, pick, pack, cancel, validate |
| Transfers | `GET/POST /transfers`; detail/update, items, status, validate |
| Adjustments | `GET/POST /adjustments`; detail, cancel, validate |
| Inventory | `GET /inventory/stock`, `/inventory/stock/{product_id}`, `/inventory/ledger`, `/inventory/alerts/low-stock` |
| Dashboard counts | `GET /operations/summary` |
| Service/event stream | `GET /health`, `GET /stream` |

See the [complete API reference](docs/API.md) for every method/path pair, access rules, request bodies, filters, error responses, and a receipt walkthrough. There is no `/api/operations/receipts` backend route and no `/inventory/low-stock-alerts` route.

## Local setup

### Prerequisites

- Python 3.12 or newer.
- Node.js compatible with Vite 8 (Node 22.12+ is a suitable choice), and npm.
- PostgreSQL (CI uses version 15), Redis, and an SMTP server for mail features.
- Docker is optional for the local infrastructure commands below. No Compose file is included.

### 1. Start local infrastructure

For a fresh local environment, these development-only containers match the connection details below. Reuse existing services if the ports are already occupied.

```bash
docker run -d --name stocksense-postgres \
  -e POSTGRES_USER=stocksense \
  -e POSTGRES_PASSWORD=local-dev-password \
  -e POSTGRES_DB=stocksense \
  -p 127.0.0.1:5432:5432 \
  -v stocksense-pgdata:/var/lib/postgresql/data postgres:15

docker run -d --name stocksense-redis \
  -p 127.0.0.1:6379:6379 redis:7

docker run -d --name stocksense-mailpit \
  -p 127.0.0.1:1025:1025 -p 127.0.0.1:8025:8025 axllent/mailpit
```

Wait for PostgreSQL to accept connections (`docker exec stocksense-postgres pg_isready -U stocksense`). Mailpit captures local email at [localhost:8025](http://localhost:8025).

### 2. Configure and run the backend

From the repository root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[test]'
cp .env.example .env
python -c 'import secrets; print(secrets.token_hex(32))'
```

Copy the generated secret into `.env`. Use the following settings with the containers above:

```dotenv
DATABASE_URL=postgresql+psycopg://stocksense:local-dev-password@localhost:5432/stocksense
JWT_SECRET=<paste-the-generated-secret-here>
CORS_ORIGINS=["http://localhost:3000"]
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_STARTTLS=false
SMTP_FROM=stocksense@example.com
```

The placeholder secret will fail startup validation. Keep `.env` private. The supplied `.env.example` uses port 5173 for CORS; this project's Vite server is configured for **3000**.

```bash
export REDIS_URL=redis://localhost:6379/0
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Use the editable install above: the current `requirements.lock` does not yet include Celery/Redis, although both are required by `pyproject.toml`. `REDIS_URL` is read from the process environment directly, so export it rather than only adding it to `.env`.

### 3. Start the email worker

In another terminal, from the repository root:

```bash
cd backend
source .venv/bin/activate
export REDIS_URL=redis://localhost:6379/0
celery -A app.celery_app:celery_app worker --loglevel=info
```

Run the worker from `backend` so its SMTP settings load from the same `.env`. Without SMTP configuration, forgot-password returns `503 MAIL_UNAVAILABLE`; without a worker, queued email will not be delivered.

### 4. Start the frontend

In another terminal, from the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The default API base is `/api`; Vite forwards it to port 8000. `VITE_API_URL` can override REST requests, but the SSE URL is currently fixed at `/api/stream`. A deployed frontend needs a corresponding reverse proxy, including SSE streaming, and SPA route fallback. `vite preview` is not a production API proxy.

### 5. Create the catalog administrator

Sign up in the application first. Then, from `backend` with the virtual environment active:

```bash
python -m app.admin promote your-email@example.com
```

Sign in again and create warehouse/location/category data before entering products or operations. The optional `backend/seed.py` script loads a demo company and predefined accounts; use it only on a disposable demo database after reviewing its contents.

## Checks and testing

Backend tests require a reachable PostgreSQL database with permission to create and drop temporary schemas. Use a dedicated test database; fixtures create a random schema, run migrations, and remove the schema after each test.

```bash
# From backend, with the virtual environment active:
export TEST_DATABASE_URL='postgresql+psycopg://stocksense:local-dev-password@localhost:5432/stocksense_test'
pytest -q
ruff check app tests migrations
ruff format --check app tests migrations
```

Create `stocksense_test` before running tests. Start/configure Redis when exercising task-dispatch paths; SMTP inbox mocks in tests do not establish real worker delivery. The repository contains tests for authentication, catalog rules, inventory deltas, operation workflows, and UI-support endpoints. These commands describe how to run checks, not a claim that the current checkout passes every check.

```bash
# From frontend:
npm run lint
npm run build
```

A manual smoke test should cover signup/login, manager catalog setup, a receipt, delivery, transfer, adjustment, and corresponding Move History entries. Verify that insufficient stock is rejected and that a completed document cannot be edited. Test OTP email with the worker and local SMTP inbox running.

## Odoo-provided Excalidraw design

The **StockSense - 8 hours** Excalidraw design was provided by **Odoo** as the reference design for this project.

- [Odoo-provided Excalidraw board](https://app.excalidraw.com/l/65VNwvy7c4X/3ENvQFu9o8R)
- [Editable local Excalidraw file](docs/StockSense%20-%208%20hours.excalidraw) — import it into Excalidraw if the shared board is unavailable.
- [Full-resolution exported diagram](docs/StockSense%20-%208%20hours.png)
- [Original problem statement PDF](docs/StockSense.pdf)

[![Odoo-provided StockSense - 8 hours Excalidraw design](docs/StockSense%20-%208%20hours.png)](docs/StockSense%20-%208%20hours.png)

## Implementation notes and next steps

| Design or earlier documentation claim | Current implementation / remaining work |
| --- | --- |
| Receipt goes directly Draft → Ready | UI uses Draft → Waiting → Ready → Validate |
| Delivery Waiting automatically means awaiting replenishment | Waiting follows Pick; there is no automatic stock-reservation/replenishment workflow |
| Sequential references such as `WH/IN/0001` | UI derives `REC-`, `DEL-`, `TRF-`, `ADJ-` references from the first eight UUID characters; APIs use full UUIDs |
| Schedule dates and late-operation counts | Operation schemas do not have scheduled-date fields; no schedule-based lateness calculation |
| Contact/address and responsible-person selection | Receipts store supplier text; delivery/transfer headers store notes. `created_by` records the logged-in user; there is no assignee or contact/address API |
| Unit cost and free-to-use stock | Product cost and stock reservations are not modeled; current balances represent on-hand stock |
| Kanban toggle in operation mockups | Current operation pages use table lists; Kanban remains a design item |
| Editing stock directly from a stock table | Use opening stock during product creation or validate an operation/adjustment to record subsequent changes |
| Every route requires authentication | `/stream`, health, docs, and public auth endpoints are currently unauthenticated; add stream access control before broader deployment |
| SSE synchronizes every screen across all workers | Broadcaster is process-local and drives toasts; shared pub/sub and query invalidation remain follow-up work |
| Notifications occur only after a successful commit | Redis counters, email dispatch, and SSE emission currently run before DB commit; use an after-commit/outbox design for reliable coordination |
| `DONE` always proves stock was posted | Receipt/transfer `/status` currently accepts `READY → DONE` without posting stock. Clients must use `/validate`; restrict this transition in a follow-up fix |
| Fully reproducible backend dependency lock | Refresh `requirements.lock` with Celery/Redis and align CI installation with `pyproject.toml` |

No measured performance or concurrency benchmark report is included. Row locks and ledger constraints are implementation mechanisms, not evidence of unlimited scale or immunity to every race condition. Reorder rules identify low stock and trigger applicable alerts; they do not automatically place purchase orders.

## Repository structure

```text
StockSense/
├── README.md
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app, middleware, health, SSE
│   │   ├── routes.py               # Authentication and catalog routes
│   │   ├── op_routes.py            # Operations and inventory routes
│   │   ├── models.py               # SQLAlchemy data model
│   │   ├── schemas.py              # Auth/catalog request and response models
│   │   ├── op_schemas.py           # Operation request and response models
│   │   ├── services/               # Auth, catalog, stock, operations, mail, SSE
│   │   ├── celery_app.py           # Worker configuration
│   │   └── tasks.py                # Email tasks
│   ├── migrations/                # Alembic schema and ledger protections
│   ├── tests/                     # PostgreSQL-backed backend tests
│   ├── CONTRACT.md                # Earlier integration contract; some stage notes are historical
│   └── seed.py                    # Optional demo data
├── frontend/
│   ├── src/pages/                 # Auth, dashboard, catalog and operations UI
│   ├── src/services/api.ts        # Typed API client
│   └── vite.config.ts             # Port 3000 and /api development proxy
└── docs/                          # Requirements, system design, database, API, ADRs, testing, demo guide, Excalidraw
```

For implementation details, consult [backend routes](backend/app/routes.py), [operation routes](backend/app/op_routes.py), [operation services](backend/app/services/operations.py), and the [frontend API client](frontend/src/services/api.ts). The current code takes precedence over historical integration notes.
