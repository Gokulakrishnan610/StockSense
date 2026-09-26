# Member 1 integration contract

## Conventions

- FastAPI + SQLAlchemy 2 + Alembic; PostgreSQL is required.
- UUID identifiers; UTC-aware timestamps; quantities use `NUMERIC(18,4)` and Python
  `Decimal`. JSON responses serialize quantities as decimal strings. Send strings
  to preserve precision. Negative opening stock and excess precision are rejected.
- All routes except signup/login/password reset and health/docs require
  `Authorization: Bearer <access_token>`.
- Lists are arrays, ordered deterministically, with `offset=0` and `limit=100`
  defaults; `limit` must be between 1 and 100.
- PUT replaces the editable fields; it is not a partial PATCH.
- Errors use `{ "code": "...", "message": "..." }`. Validation errors add an
  `errors` array of field paths/messages without echoing credentials.
- `201` created, `204` completed with no body, `400` invalid reset challenge,
  `401` unauthenticated, `403` forbidden, `404` missing resource, `409` data conflict,
  `422` invalid input, `429` login throttled, `503` mail unavailable.

## Authentication

| Method | Endpoint | Request / result |
| --- | --- | --- |
| POST | `/auth/signup` | `login_id`, `email`, `name`, `password`; returns public profile |
| POST | `/auth/login` | `login_id` (login ID or email), `password`; returns access token |
| GET | `/auth/me` | Public profile including role |
| POST | `/auth/forgot-password` | `email`; generic acknowledgement, SMTP delivery |
| POST | `/auth/verify-otp` | `email`, six-digit `otp`; returns `reset_token`, `expires_in` |
| POST | `/auth/reset-password` | `reset_token`, `new_password`; consumes challenge |
| POST | `/auth/logout` | Revokes all of the current user's access tokens |

Passwords use Argon2. Passwords are 10–128 characters; whitespace is preserved.
Login IDs are 6–64 characters using letters, numbers, `_`, `.`, or `-`. Email/login
IDs are normalized to lowercase and unique. Visual mockup notes are not treated
as additional business requirements such as globally unique passwords.

Public signup always assigns `WAREHOUSE_STAFF`; role injection is rejected.
`python -m app.admin promote EMAIL` provisions an `INVENTORY_MANAGER` locally.
Both roles read catalog data; only managers create/update/delete catalog data.
This permission split is the conservative initial policy for the two required roles.

JWTs use HS256 with issuer/audience checks and a 30-minute default expiry. Tokens
carry the user's token version, checked against the database on every request.
Logout and password reset increment this version to invalidate all sessions.
The frontend must navigate to the returned `/dashboard` route; no frontend exists here.
All `/auth/` responses, including errors, send `Cache-Control: no-store` and
`Pragma: no-cache` so tokens and profile responses are not retained by HTTP caches.

Reset codes expire after 10 minutes, permit five attempts, and have a 60-second
resend cooldown. A successful verification consumes the code and creates an opaque,
single-use reset token with a 10-minute expiry. The database stores keyed hashes,
not raw codes or reset tokens. A resend invalidates an earlier challenge. User row
locks serialize reset/verify calls. Five failed logins lock an account for 15 minutes.
Deploy behind HTTPS and apply perimeter request limits to public authentication
endpoints; per-account controls do not limit traffic to nonexistent accounts.

## Catalog APIs

| Resource | Methods and paths | Editable fields / notes |
| --- | --- | --- |
| Products | GET/POST `/products`; GET/PUT `/products/{id}` | `name`, `sku`, `category_id`, `unit_of_measure` |
| Product stock | GET `/products/{id}/stock` | Per-location `quantity`, `location_id`, `warehouse_id` |
| Categories | GET/POST `/categories`; GET/PUT/DELETE `/categories/{id}` | `name`; referenced categories cannot be deleted |
| Warehouses | GET/POST `/warehouses`; GET/PUT `/warehouses/{id}` | `name`, `short_code`, optional `address` |
| Locations | GET/POST `/locations`; GET/PUT `/locations/{id}` | `name`, `short_code`, `warehouse_id` |
| Reorder rules | GET/POST `/reorder-rules`; PUT `/reorder-rules/{id}` | `product_id`, `minimum_stock`, `reorder_quantity` |

Product creation additionally accepts `initial_stock` (default zero) and
`initial_location_id` (required for positive opening stock). Product creation,
opening balance, and opening ledger entry commit atomically. Opening stock is
historical metadata, not a current quantity; it cannot be changed through PUT.
Unit-of-measure changes are blocked after any stock movement to preserve history.

Example product creation:

```json
{
  "name": "Steel Rods",
  "sku": "STEEL-001",
  "category_id": "<category UUID>",
  "unit_of_measure": "KG",
  "initial_stock": "100.0000",
  "initial_location_id": "<location UUID>"
}
```

SKUs and short codes normalize to uppercase. SKU and warehouse code are globally
unique; location code is unique within its warehouse. Category names are trimmed
and unique with PostgreSQL's case-sensitive comparison. A location's warehouse
association is immutable, including empty locations, so a concurrent receipt cannot
race a warehouse reassignment. Update its name/code or create a new location.

Products support `search` (literal substring of SKU/name), `category_id`,
`warehouse_id`, and `location_id` filters. Warehouse/location product filters select
products with a balance row there, including zero balances. Product stock supports
`warehouse_id` and `location_id`. An absent balance row means zero; the endpoint
returns existing rows rather than a Cartesian product of all products/locations.
Locations support `warehouse_id`; reorder rules support `product_id`.

Each product has at most one reorder rule. `minimum_stock >= 0` and
`reorder_quantity > 0`. Rules are product-wide, to be compared against summed
location balances by Member 2's alert implementation. No automatic ordering or
notification delivery is implemented here.

## Database schema

Revision `0001` creates these tables and seeds both roles. Coordinate future
changes with Member 2 using new migrations; do not edit an applied migration.

| Table | Key / constraints | Purpose |
| --- | --- | --- |
| `roles` | `name` PK, two allowed values | Inventory manager / warehouse staff |
| `users` | UUID PK, unique login/email, role FK | Argon2 hash, token version, login lockout |
| `password_resets` | user FK/PK, unique token hash | Current expiring reset challenge |
| `categories` | UUID PK, unique name | Product classification |
| `products` | UUID PK, unique SKU, category FK | Metadata and historical initial stock |
| `warehouses` | UUID PK, unique short code | Warehouse name/code/address |
| `locations` | UUID PK, warehouse FK, unique warehouse/code | Physical storage locations |
| `reorder_rules` | UUID PK, unique product FK | Minimum and reorder quantities |
| `stock_balances` | composite product/location PK | Nonnegative current quantity |
| `stock_ledger` | UUID PK, unique `entry_key` | Append-only location-level movement history |

Business tables have created/updated timestamps. The ledger has created time only.
Ledger foreign keys and catalog references use restrictive deletion. PostgreSQL
triggers reject ledger UPDATE, DELETE, and TRUNCATE. Only schema migrations should
be run with database-owner privileges in production.

Ledger fields: `id`, `product_id`, `location_id`, `transaction_type`, `reference_id`,
`entry_key`, `from_location_id`, `to_location_id`, `quantity`, `before_quantity`,
`after_quantity`, `user_id`, `created_at`.

`quantity` is a **signed delta for one location**. `after_quantity = before_quantity
+ quantity`; both balances must be nonnegative. Movement types are `INITIAL`,
`RECEIPT`, `DELIVERY`, `TRANSFER`, and `ADJUSTMENT`. `reference_id` is a string to
accommodate Member 2's future operation IDs; it is not yet a foreign key.

## Shared inventory service for Member 2

Use `app.services.inventory.apply_delta` inside the **same database transaction**
as the operation status change. It validates decimal precision, locks the product
row, updates or creates the location balance, and appends a ledger record. It
flushes but **never commits**. Exceptions must propagate so the caller rolls back
the complete operation.

```python
with Session(engine) as db, db.begin():
    # Lock/check the operation and its status here.
    apply_delta(
        db,
        product_id=product_id,
        location_id=location_id,
        delta=Decimal("50"),
        transaction_type="RECEIPT",
        reference_id=str(operation_id),
        entry_key=f"receipt:{operation_id}:{line_id}",
        user_id=user_id,
        to_location_id=location_id,
    )
    # Mark the operation completed within this transaction.
```

Use deterministic entry keys per operation/line/location leg. An exact replay
returns the existing entry; the same key with different arguments returns a conflict.
`reference_id` and `entry_key` must be nonblank strings, at most 120 and 180
characters respectively. Invalid references are rejected before any stock mutation.
For transfers, post a negative source delta and positive destination delta with
distinct keys, identical reference IDs, and source/destination metadata, all in one
transaction. The global sum remains unchanged. Member 2 owns workflow validation,
operation idempotency/status transitions, and source/destination semantics.

For multi-product operations, lock **all product rows in ascending UUID order**
before invoking the service to avoid opposing lock orders. All stock writers must
use this service/locking convention. Direct balance writes bypass the guarantee
that every change has a ledger record. Do not update `products.initial_stock` to
represent current inventory. Do not expose `apply_delta` as an unrestricted route.

## Ownership boundaries and verification

This stage has no receipt/delivery/transfer/adjustment routes, no dashboard/alert
implementation, and no frontend. Tests exercise the shared stock primitive without
adding those workflows. SMTP dispatch is replaced by an in-memory inbox in API
tests; configure a real/local SMTP server to verify delivery in your environment.
