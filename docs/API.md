# StockSense API reference

[Back to README](../README.md#api-endpoints)

This reference describes routes in `backend/app/routes.py`, `backend/app/op_routes.py`, and `backend/app/main.py`. It documents the current implementation, including known limitations; the original mockups describe a broader design.

## Base URL and conventions

- Direct backend: `http://localhost:8000`; paths below have **no `/api` prefix**.
- Browser development proxy: `http://localhost:3000/api`; Vite strips `/api` before forwarding.
- JSON bodies use `Content-Type: application/json`. Protected endpoints use `Authorization: Bearer <access_token>`.
- **Public** requires no token. **User** accepts either authenticated role. **Manager** requires `INVENTORY_MANAGER`.
- IDs are UUIDs. Use the full UUID, not the shortened document reference shown by the UI.
- Quantities are decimal strings, with up to four decimal places. Operation line quantities must be positive; counted/opening quantities may be zero.
- Collection endpoints with pagination accept `offset=0`, `limit=100`, with `1 <= limit <= 100`. They return arrays, not `{data, total}` envelopes. Item sublists return all lines without pagination. Summary/health return objects.
- PUT supplies the editable resource fields; there are no PATCH routes. Item editing uses delete/add, not PUT.
- Responses normally use 200, creation uses 201, forgot-password acknowledgement uses 202, and successful deletion/logout/reset uses 204.
- Interactive schemas: [Swagger UI](http://localhost:8000/docs), [ReDoc](http://localhost:8000/redoc), [OpenAPI JSON](http://localhost:8000/openapi.json).

## Endpoint inventory

The `Body` column refers to the payload table below. A dash means no JSON body. All paths in this inventory are actual registered application paths; documentation routes are listed separately above.

### Authentication

| Method | Path | Access | Body | Result / purpose |
| --- | --- | --- | --- | --- |
| `POST` | `/auth/signup` | Public | Signup | Create a warehouse staff account |
| `POST` | `/auth/login` | Public | Login | Return access_token, token_type, expires_in, redirect_to |
| `POST` | `/auth/forgot-password` | Public | Email | Queue reset email; return generic acknowledgement |
| `POST` | `/auth/verify-otp` | Public | OTP | Return reset_token and expires_in |
| `POST` | `/auth/reset-password` | Public | Reset password | Consume reset token and invalidate sessions |
| `POST` | `/auth/logout` | User | — | Invalidate all current user sessions |
| `GET` | `/auth/me` | User | — | Return current public profile |

### Categories

| Method | Path | Access | Body | Result / purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/categories` | User | — | Categories |
| `POST` | `/categories` | Manager | Category | Create category |
| `GET` | `/categories/{id}` | User | — | Category |
| `PUT` | `/categories/{id}` | Manager | Category | Update category |
| `DELETE` | `/categories/{id}` | Manager | — | Delete category |

### Warehouses

| Method | Path | Access | Body | Result / purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/warehouses` | User | — | Warehouses |
| `POST` | `/warehouses` | Manager | Warehouse | Create warehouse |
| `GET` | `/warehouses/{id}` | User | — | Warehouse |
| `PUT` | `/warehouses/{id}` | Manager | Warehouse | Update warehouse |

### Locations

| Method | Path | Access | Body | Result / purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/locations` | User | — | Locations |
| `POST` | `/locations` | Manager | Location | Create location |
| `GET` | `/locations/{id}` | User | — | Location |
| `PUT` | `/locations/{id}` | Manager | Location | Update location |

### Products

| Method | Path | Access | Body | Result / purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/products` | User | — | Products |
| `POST` | `/products` | Manager | New product | Create product |
| `GET` | `/products/{id}` | User | — | Product |
| `PUT` | `/products/{id}` | Manager | Product | Update product |
| `GET` | `/products/{id}/stock` | User | — | Per-location balances for one product |

### Reorder Rules

| Method | Path | Access | Body | Result / purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/reorder-rules` | User | — | Reorder rules |
| `POST` | `/reorder-rules` | Manager | Reorder rule | Create reorder rule |
| `PUT` | `/reorder-rules/{id}` | Manager | Reorder rule | Update reorder rule |

### Receipts

| Method | Path | Access | Body | Result / purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/receipts` | User | — | List receipts |
| `POST` | `/receipts` | User | Receipt | Create receipt |
| `GET` | `/receipts/{id}` | User | — | Get receipt |
| `PUT` | `/receipts/{id}` | User | Receipt | Update receipt |
| `POST` | `/receipts/{id}/items` | User | Stock line | Add receipt item |
| `GET` | `/receipts/{id}/items` | User | — | List receipt items |
| `DELETE` | `/receipts/{id}/items/{item_id}` | User | — | Remove receipt item |
| `POST` | `/receipts/{id}/status` | User | Status | Advance/cancel; use validate to post stock |
| `POST` | `/receipts/{id}/validate` | User | — | READY → DONE; increase stock |

### Deliveries

| Method | Path | Access | Body | Result / purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/deliveries` | User | — | List deliveries |
| `POST` | `/deliveries` | User | Notes | Create delivery |
| `GET` | `/deliveries/{id}` | User | — | Get delivery |
| `PUT` | `/deliveries/{id}` | User | Notes | Update delivery |
| `POST` | `/deliveries/{id}/items` | User | Stock line | Add delivery item |
| `GET` | `/deliveries/{id}/items` | User | — | List delivery items |
| `DELETE` | `/deliveries/{id}/items/{item_id}` | User | — | Remove delivery item |
| `POST` | `/deliveries/{id}/cancel` | User | — | Cancel non-terminal document without stock change |
| `POST` | `/deliveries/{id}/pick` | User | — | DRAFT → WAITING; no stock reservation |
| `POST` | `/deliveries/{id}/pack` | User | — | WAITING → READY; no stock deduction |
| `POST` | `/deliveries/{id}/validate` | User | — | READY → DONE; decrease stock |

### Transfers

| Method | Path | Access | Body | Result / purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/transfers` | User | — | List transfers |
| `POST` | `/transfers` | User | Notes | Create transfer |
| `GET` | `/transfers/{id}` | User | — | Get transfer |
| `PUT` | `/transfers/{id}` | User | Notes | Update transfer |
| `POST` | `/transfers/{id}/items` | User | Transfer line | Add transfer item |
| `GET` | `/transfers/{id}/items` | User | — | List transfer items |
| `DELETE` | `/transfers/{id}/items/{item_id}` | User | — | Remove transfer item |
| `POST` | `/transfers/{id}/status` | User | Status | Advance/cancel; use validate to post stock |
| `POST` | `/transfers/{id}/validate` | User | — | READY → DONE; debit source and credit destination |

### Adjustments

| Method | Path | Access | Body | Result / purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/adjustments` | User | — | List adjustments |
| `POST` | `/adjustments` | User | Adjustment | Create adjustment |
| `GET` | `/adjustments/{id}` | User | — | Get adjustment |
| `POST` | `/adjustments/{id}/cancel` | User | — | Cancel DRAFT without stock change |
| `POST` | `/adjustments/{id}/validate` | User | — | DRAFT → DONE; reconcile counted stock |

### Inventory and summary

| Method | Path | Access | Body | Result / purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/inventory/ledger` | User | — | Signed movements including user_name |
| `GET` | `/inventory/stock` | User | — | Existing product/location balance rows |
| `GET` | `/inventory/stock/{product_id}` | User | — | Existing balances for one product |
| `GET` | `/operations/summary` | User | — | Counts by document type/status; optional Redis lifetime_validations |
| `GET` | `/inventory/alerts/low-stock` | User | — | Products with total stock at or below reorder minimum |

### Health and events

| Method | Path | Access | Body | Result / purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/health` | Public | — | Liveness response; does not check DB/Redis/SMTP |
| `GET` | `/stream` | Public | — | SSE stream; currently public and process-local |

## Request payloads

Names are descriptive labels for this guide, not additional HTTP resources. Unknown body fields are rejected. Refer to OpenAPI for every field's length constraints.

| Body | Fields |
| --- | --- |
| Signup | `login_id`, `email`, `name`, `password`; cannot set role |
| Login | `login_id` (login ID or email), `password` |
| Email | `email` |
| OTP | `email`, six-digit `otp` string |
| Reset password | `reset_token`, `new_password` |
| Category | `name` |
| Warehouse | `name`, `short_code`, optional `address` (default empty) |
| Location | `name`, `short_code`, `warehouse_id`; existing warehouse association cannot change |
| Product | `name`, `sku`, `category_id`, `unit_of_measure` |
| New product | Product fields plus optional `initial_stock` (default zero) and `initial_location_id` (required for positive opening stock) |
| Reorder rule | `product_id`, `minimum_stock >= 0`, `reorder_quantity > 0`; one rule per product |
| Receipt | `supplier`, `notes`; both default to empty strings |
| Notes | `notes`, default empty string |
| Stock line | `product_id`, `location_id`, positive `quantity` |
| Transfer line | `product_id`, `source_location_id`, `destination_location_id`, positive `quantity`; locations must differ |
| Status | `status`: normally `WAITING`, `READY`, or `CANCELED`, subject to current state |
| Adjustment | `product_id`, `location_id`, nonnegative `counted_quantity`, nonblank `reason` |

Product creation, opening balance, and its `INITIAL` ledger entry are one transaction. Product PUT cannot change opening stock; unit changes are blocked after stock movement. SKUs and short codes normalize to uppercase. Category deletion is rejected while referenced. There are no product, warehouse, location, or reorder-rule DELETE routes.

### Workflow rules

- Receipts/transfers: `DRAFT → WAITING → READY → DONE`, with cancellation from non-terminal states. Use `/status` for Waiting/Ready/Canceled and `/validate` for stock posting.
- Deliveries: `/pick` moves Draft to Waiting; `/pack` moves Waiting to Ready; `/validate` deducts stock and completes the document. `/cancel` is available before completion.
- Adjustments: `/validate` reconciles Draft directly to Done; `/cancel` cancels Draft. A zero delta completes without a ledger entry.
- A line document needs at least one line to validate. Completed/canceled documents reject normal edits. Insufficient stock rejects the complete validation transaction.
- **Known implementation gap:** receipt/transfer `/status` also permits `READY → DONE` without ledger posting. Do not use that transition to complete stock operations. Restricting it to `/validate` is follow-up work.
- Sending a valid status string does not imply every transition is allowed. Revalidating Done returns a conflict rather than posting stock again.

## Filters and response details

| GET endpoint | Supported filters in addition to pagination |
| --- | --- |
| `/products` | `search` (literal substring of SKU/name), `category_id`, `warehouse_id`, `location_id` |
| `/locations` | `warehouse_id` |
| `/reorder-rules` | `product_id` |
| `/products/{id}/stock` | `warehouse_id`, `location_id` |
| `/receipts`, `/deliveries`, `/transfers`, `/adjustments` | `status` (uppercase) |
| `/inventory/stock`, `/inventory/stock/{product_id}` | `warehouse_id`, `location_id` |
| `/inventory/ledger` | `product_id`, `location_id`, `transaction_type`, `warehouse_id`, `category_id`, `reference_id`, `date_from`, `date_to` |
| `/inventory/alerts/low-stock` | No additional filters; threshold compares stock summed across all locations |
| `/operations/summary` | No filters or pagination; object of document types and status counts |

Use ISO 8601 date-time values for ledger date bounds, preferably with an explicit UTC offset. Ledger `reference_id` is an exact match to the stored reference (normally the operation UUID). Transaction types are `INITIAL`, `RECEIPT`, `DELIVERY`, `TRANSFER`, and `ADJUSTMENT`. Ledger rows include signed `quantity`, `before_quantity`, `after_quantity`, source/destination IDs, `user_id`, `user_name`, and `created_at`.

An absent balance row represents zero stock. Stock endpoints return existing rows rather than all possible product/location combinations. Product filters by warehouse/location include products with an existing zero balance row. Stock responses contain IDs and quantities; clients resolve names through catalog endpoints.

Search in operation screens is a frontend feature; operation list APIs only accept status and pagination. They do not implement reference/contact/schedule-date query parameters. The summary counts operations by status from PostgreSQL and may append `lifetime_validations` from Redis. Redis counters are supplementary and may differ from database counts.

## Example: receive 50 units

First create a user with `/auth/signup`, log in with `/auth/login`, and provision warehouse, location, category, and product through a manager account. The following examples assume their returned IDs are available. Replace angle-bracket placeholders with real values. All commands call the backend directly.

```bash
export STOCKSENSE_API=http://localhost:8000
export STOCKSENSE_TOKEN='<access_token from POST /auth/login>'

curl -sS "$STOCKSENSE_API/receipts" \
  -H "Authorization: Bearer $STOCKSENSE_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"supplier":"Acme Supplies","notes":"Steel delivery"}'
```

The response is a receipt object with `id`, `supplier`, `notes`, `status: "DRAFT"`, `created_by`, `created_at`, and `updated_at`. Copy its full `id`:

```bash
export STOCKSENSE_RECEIPT_ID='<receipt UUID>'

curl -sS "$STOCKSENSE_API/receipts/$STOCKSENSE_RECEIPT_ID/items" \
  -H "Authorization: Bearer $STOCKSENSE_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"product_id":"<product UUID>","location_id":"<location UUID>","quantity":"50.0000"}'

curl -sS "$STOCKSENSE_API/receipts/$STOCKSENSE_RECEIPT_ID/status" \
  -H "Authorization: Bearer $STOCKSENSE_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"WAITING"}'

curl -sS "$STOCKSENSE_API/receipts/$STOCKSENSE_RECEIPT_ID/status" \
  -H "Authorization: Bearer $STOCKSENSE_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"READY"}'

curl -sS -X POST "$STOCKSENSE_API/receipts/$STOCKSENSE_RECEIPT_ID/validate" \
  -H "Authorization: Bearer $STOCKSENSE_TOKEN"

curl -sS "$STOCKSENSE_API/inventory/ledger?reference_id=$STOCKSENSE_RECEIPT_ID" \
  -H "Authorization: Bearer $STOCKSENSE_TOKEN"
```

Successful validation returns the receipt with status `DONE`; the ledger contains the receiving location's positive delta. If starting from zero, the balance becomes `50.0000`. Do not send `{"status":"DONE"}` to complete this workflow.

Other operation bodies:

```json
{
  "product_id": "<product UUID>",
  "source_location_id": "<source UUID>",
  "destination_location_id": "<destination UUID>",
  "quantity": "10.0000"
}
```

The body above adds a transfer line through `POST /transfers/{id}/items`. An adjustment is created through `POST /adjustments` with:

```json
{
  "product_id": "<product UUID>",
  "location_id": "<location UUID>",
  "counted_quantity": "47.0000",
  "reason": "Physical count after damaged stock was removed"
}
```

Then call `POST /adjustments/{id}/validate` to reconcile against the current balance. Creation alone changes no stock.

## Errors

Domain errors use:

```json
{"code":"INVALID_STATUS","message":"Receipt must be in 'READY' status to perform this action (current: DRAFT)"}
```

Field validation uses:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid request",
  "errors": [{"field": "body.quantity", "message": "Input should be greater than 0"}]
}
```

| Status | Meaning / examples |
| --- | --- |
| 400 | Invalid or expired reset challenge |
| 401 | Missing, expired, invalid, or revoked access token; invalid login |
| 403 | Manager role required |
| 404 | Resource or operation line not found |
| 409 | Data conflict, invalid transition/status, terminal document, empty operation, or insufficient stock |
| 422 | Invalid input, precision, quantity, or source/destination combination |
| 429 | Login lockout (`LOGIN_THROTTLED`) |
| 503 | Password-reset mail is not configured |

Forgot-password requests during the resend cooldown still receive the generic 202 acknowledgement without sending another code. Exhausted OTP attempts return 400. Framework-level and unexpected infrastructure failures are not guaranteed to use this domain-error envelope. `/health` is a liveness check and does not establish that PostgreSQL, Redis, SMTP, or workers are ready.

## Event stream

`GET /stream` returns `text/event-stream`. Current named events are `STOCK_UPDATE` and `LOW_STOCK_ALERT`, for example:

```text
event: STOCK_UPDATE
data: {"type":"RECEIPT","id":"<receipt UUID>"}

event: LOW_STOCK_ALERT
data: {"product_name":"Steel","sku":"STEEL-01","current":"4.0000","minimum":"5.0000"}
```

The frontend listens at `/api/stream` and displays toasts. This stream is currently unauthenticated, process-local, and has no persisted replay; events can precede database commit. It is not a durable audit feed or a guarantee of cross-worker synchronization. See [implementation notes](../README.md#implementation-notes-and-next-steps) for the corresponding follow-up work.
