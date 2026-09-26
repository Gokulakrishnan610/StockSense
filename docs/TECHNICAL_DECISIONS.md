# StockSense Technical Decisions

These short architecture decision records (ADRs) explain why StockSense is built the way it is. Each one gives the context, the decision, and its consequences, including the trade-offs we accepted.

| # | Decision |
| --- | --- |
| [ADR-01](#adr-01-postgresql-as-the-single-source-of-truth) | PostgreSQL as the single source of truth |
| [ADR-02](#adr-02-location-level-balances-plus-an-append-only-ledger) | Location-level balances plus an append-only ledger |
| [ADR-03](#adr-03-one-function-for-every-stock-change) | One function for every stock change |
| [ADR-04](#adr-04-pessimistic-row-locks-in-a-fixed-order) | Pessimistic row locks in a fixed order |
| [ADR-05](#adr-05-deterministic-idempotency-keys) | Deterministic idempotency keys |
| [ADR-06](#adr-06-documents-change-stock-only-on-validate) | Documents change stock only on validate |
| [ADR-07](#adr-07-decimal-quantities-sent-as-strings) | Decimal quantities sent as strings |
| [ADR-08](#adr-08-fastapi-with-a-thin-router-and-service-layer) | FastAPI with a thin router and service layer |
| [ADR-09](#adr-09-stateless-jwt-with-token-versioning) | Stateless JWT with token versioning |
| [ADR-10](#adr-10-two-roles-with-self-signup-as-staff) | Two roles, with self-signup as staff |
| [ADR-11](#adr-11-server-sent-events-for-live-notifications) | Server-Sent Events for live notifications |
| [ADR-12](#adr-12-celery-and-redis-for-email) | Celery and Redis for email |
| [ADR-13](#adr-13-react-spa-without-a-state-library) | React SPA without a state library |
| [ADR-14](#adr-14-tests-against-real-postgresql) | Tests against real PostgreSQL |

---

## ADR-01 PostgreSQL as the single source of truth

**Context.** Inventory numbers must be right even when several people validate documents at the same moment.

**Decision.** Use PostgreSQL for all data. Put the core rules into the schema itself: `CHECK` constraints, unique keys, foreign keys and triggers.

**Consequences.**
- ✅ The database rejects invalid stock even if a bug slips past the application layer.
- ✅ Row-level locks (`SELECT … FOR UPDATE`) make concurrency safe without a separate lock service.
- ➖ Tests need a real PostgreSQL instance (see ADR-14).

## ADR-02 Location-level balances plus an append-only ledger

**Context.** The problem statement asks for per-location stock, multi-warehouse support, and a full move history.

**Decision.** Keep two structures:
- `stock_balances(product_id, location_id, quantity)` for fast reads of the current state.
- `stock_ledger` as an append-only list of signed deltas with `before_quantity` and `after_quantity`.

Triggers block `UPDATE`, `DELETE` and `TRUNCATE` on the ledger.

**Consequences.**
- ✅ Dashboards and product pages read balances directly, with no need to replay history.
- ✅ Every balance can be rebuilt and audited from the ledger (see the query in [DATABASE.md](DATABASE.md#useful-queries)).
- ✅ Mistakes are fixed with a new movement (an adjustment), never by editing history, which matches normal accounting practice.
- ➖ Two writes per movement. This is acceptable because both happen in one transaction.

**Alternative rejected.** A single `products.quantity` column. It cannot represent stock in different locations and loses history.

## ADR-03 One function for every stock change

**Decision.** `inventory.apply_delta()` is the only code that touches balances or the ledger. Receipts, deliveries, transfers, adjustments and opening stock all call it. It validates the quantity, checks the idempotency key, prevents negative stock, and writes both rows. It never commits.

**Consequences.**
- ✅ One place to review, test and harden. `test_inventory.py` targets it directly.
- ✅ The caller owns the transaction, so a multi-line document is all-or-nothing.

## ADR-04 Pessimistic row locks in a fixed order

**Context.** Two deliveries of the same product validated together must not both succeed if only one can be filled.

**Decision.** Lock the document row, then lock every affected product row in **ascending UUID order**, before changing any balance.

**Consequences.**
- ✅ There are no lost updates and no overselling. `test_competing_deductions_cannot_oversell` proves this.
- ✅ Every transaction takes locks in the same global order, so there are no deadlocks.
- ➖ Validations on the same product are serialized. At warehouse scale this costs milliseconds.

**Alternative rejected.** Optimistic version columns with retries. That approach needs retry loops in every caller and is harder to reason about for multi-line documents.

## ADR-05 Deterministic idempotency keys

**Decision.** Each ledger row has a unique `entry_key` built from the document and the line, for example `delivery:{doc}:{line}` or `transfer:{doc}:{line}:src`. A replay with identical data returns the existing row. A replay with different data returns `409 IDEMPOTENCY_CONFLICT`.

**Consequences.**
- ✅ Network retries or double clicks cannot post stock twice.
- ✅ The unique index gives a database-level guarantee.

## ADR-06 Documents change stock only on validate

**Decision.** Receipts, deliveries and transfers follow `DRAFT → WAITING → READY → DONE`, with `CANCELED` possible from any open state. Stock changes only inside `validate`. `DONE` and `CANCELED` documents cannot be edited.

**Consequences.**
- ✅ Warehouse staff can prepare documents without affecting stock.
- ✅ The dashboard can count "pending" work by status.
- ➖ The generic `/status` endpoint still allows `READY → DONE` without posting stock. The fix is tracked in the README limitations.

## ADR-07 Decimal quantities sent as strings

**Decision.** Store quantities as `NUMERIC(18,4)` and use Python `Decimal`. The API sends them as JSON strings, for example `"12.5000"`.

**Consequences.**
- ✅ No floating-point drift. Units such as kg and meters get 4-decimal precision.
- ➖ The frontend converts with `Number()` only for display.

## ADR-08 FastAPI with a thin router and service layer

**Decision.** Use FastAPI and Pydantic v2 for routing and validation. Input schemas forbid unknown fields and trim text. Routers call exactly one service function. Services raise `DomainError(status, code, message)`, which one exception handler turns into `{code, message}`.

**Consequences.**
- ✅ OpenAPI docs are generated automatically at `/docs` and `/redoc`.
- ✅ Clients see one consistent error format.
- ✅ Services can be tested without HTTP.

## ADR-09 Stateless JWT with token versioning

**Decision.** Use HS256 access tokens with `iss`, `aud`, `jti` and `type` claims, plus a `ver` claim that must equal `users.token_version`. Logout, password reset and role promotion increment the version.

**Consequences.**
- ✅ Tokens can be revoked instantly without a token blocklist.
- ✅ Tokens are short-lived (30 minutes by default).
- ➖ Each request reads the user row. This is cheap and also supplies the role for authorization.

Supporting controls: Argon2 password hashing, a dummy-hash check for unknown users (so timing matches), lockout for 15 minutes after 5 failures, OTPs stored as HMAC digests, one resend per 60 seconds, 5 verification attempts, and `Cache-Control: no-store` on `/auth/*`.

## ADR-10 Two roles, with self-signup as staff

**Decision.** Use two roles from the problem statement: `INVENTORY_MANAGER` and `WAREHOUSE_STAFF`. Public signup always creates staff. Managers are promoted with a local CLI (`python -m app.admin promote`), not through the API.

**Consequences.**
- ✅ There is no way to escalate privileges through the API. `test_signup_duplicate_and_no_self_promotion` checks this.
- ➖ The first manager needs shell access. This is acceptable for an on-premise tool.

## ADR-11 Server-Sent Events for live notifications

**Decision.** `GET /stream` sends `STOCK_UPDATE` and `LOW_STOCK_ALERT` events. The SPA listens with `EventSource` and shows toasts.

**Consequences.**
- ✅ One-way push is all we need. SSE runs over plain HTTP, reconnects automatically, and needs no extra library.
- ➖ The broadcaster lives in one process's memory. Running several workers needs Redis pub/sub.
- ➖ The stream is not authenticated yet, and events are emitted before the commit. Both are listed as follow-ups.

**Alternative considered.** WebSockets. We do not need two-way messages, and they bring more infrastructure.

## ADR-12 Celery and Redis for email

**Decision.** Send welcome, OTP and low-stock emails from a Celery worker, with Redis as the broker. Validation also increments Redis counters that `/operations/summary` exposes as `lifetime_validations`.

**Consequences.**
- ✅ Slow SMTP never blocks an API request.
- ✅ Email dispatch failures on the validation path are caught, so stock posting always completes.
- ➖ One more process (the worker) and one more service (Redis) to run.

## ADR-13 React SPA without a state library

**Decision.** Use React 19 with TypeScript, React Router 7 and Vite. Styling is custom CSS with CSS variables, and icons come from Lucide. Global state is limited to `AuthContext` and `ToastContext`. Each page loads its own data through a typed `api.ts` client.

**Consequences.**
- ✅ Few dependencies and a fast build. Types mirror the backend schemas.
- ✅ The dashboard calculates KPIs only from backend reads, so its numbers always match the API.
- ➖ There is no shared cache. Pages fetch their data again on navigation.

## ADR-14 Tests against real PostgreSQL

**Decision.** Backend tests run on PostgreSQL. Each test uses a random schema, migrated with Alembic and dropped afterwards. Concurrency tests use real parallel connections.

**Consequences.**
- ✅ Constraints, triggers and row locks are tested for real, not mocked.
- ✅ Migrations are checked in both directions.
- ➖ Running the tests requires a database, which CI provides as a service container.
