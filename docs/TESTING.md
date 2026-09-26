# StockSense Testing Guide

This guide covers what the automated tests check, how to run them, and how to run a manual end-to-end check.

## Contents

- [Test strategy](#test-strategy)
- [Running the tests](#running-the-tests)
- [Test inventory](#test-inventory)
- [Current results](#current-results)
- [Continuous integration](#continuous-integration)
- [Frontend checks](#frontend-checks)
- [Manual end-to-end checklist](#manual-end-to-end-checklist)

## Test strategy

| Layer | Approach |
| --- | --- |
| Backend API and services | `pytest` + FastAPI `TestClient` against a **real PostgreSQL** database. The tests do not use SQLite, because they rely on row locks, `CHECK` constraints and triggers that only PostgreSQL provides. |
| Isolation | Each test gets a random PostgreSQL schema. Alembic migrates it to `head`, and the schema is dropped afterwards (`tests/conftest.py`). |
| Concurrency | Tests open parallel connections with threads to prove there are no lost updates, no overselling and no duplicate postings. |
| Migrations | `test_migration_round_trip` upgrades, downgrades and upgrades again. |
| Frontend | TypeScript type checking (`tsc -b`), `oxlint`, a production `vite build`, and the manual checklist below. |

## Running the tests

You need a PostgreSQL database that the test user can create schemas in.

```bash
# One-off: start PostgreSQL (any existing server works too)
docker run -d --name stocksense-postgres -e POSTGRES_USER=stocksense \
  -e POSTGRES_PASSWORD=local-dev-password -e POSTGRES_DB=stocksense_test \
  -p 127.0.0.1:5432:5432 postgres:15
```

```bash
cd backend
python -m pip install -e '.[test]'
export TEST_DATABASE_URL='postgresql+psycopg://stocksense:local-dev-password@localhost:5432/stocksense_test'
pytest -q                     # whole suite
pytest -q tests/test_inventory.py        # one file
pytest -q -k "transfer"                   # by keyword
ruff check app tests migrations
ruff format --check app tests migrations
```

On Windows PowerShell, set the variable with `$env:TEST_DATABASE_URL = '...'`.

## Test inventory

The suite has 74 test functions. Parametrization expands them to 89 collected cases.

| File | Tests | What it covers |
| --- | --- | --- |
| `test_auth.py` | 14 | Signup, login, profile, logout; duplicate accounts; no self-promotion; wrong password and 5-attempt lockout; role authorization; OTP reset lifecycle, attempt limit and expiry; single-use OTP and reset token under concurrency; resend invalidates old tokens; passwords are never echoed; extra profile fields are rejected; whitespace in passwords is preserved |
| `test_auth_cache.py` | 2 | Tokens, profiles, errors and reset tokens are sent with `no-store` |
| `test_catalog.py` | 10 | Opening stock is location-aware and logged; a duplicate SKU rolls back stock; product validation; an update keeps stock and blocks unit changes after movements; search and filters; category delete rules; warehouse and location updates; reorder rules; a used location cannot switch warehouse; zero opening stock and invalid relations |
| `test_inventory.py` | 11 | Idempotent `apply_delta` and conflicting retries; invalid references; maximum-length references; rollback and insufficient stock; atomic multi-location changes; **concurrent updates do not lose stock**; **concurrent retries record once**; **competing deductions cannot oversell**; concurrent first entries create one balance; database guards on ledger and balance; migration round trip |
| `test_mailer.py` | 2 | SMTP transport and sanitized SMTP errors |
| `test_operations.py` | 26 | Receipts: create/list, draft does not touch stock, validate increases stock, no double validation, only `READY` can validate, ledger entry. Deliveries: pick → pack → validate decreases stock, rejected on insufficient stock, no double validation, ledger. Transfers: moves stock, cannot exceed source, two ledger rows, same location rejected. Adjustments: updates stock, ledger entry, reason required, no double validation. Inventory: ledger, stock list, product stock, low-stock alert. A full lifecycle. |
| `test_operations_ui_support.py` | 9 | Line list and remove; no line removal on `DONE`; a line must belong to its document; 404 for a missing document; a canceled delivery cannot be validated; adjustment cancel only from `DRAFT`; operation summary counts; ledger filters and `user_name`; the demo flow run through the API |

## Current results

Last run on 2026-09-26 against current `main`, using PostgreSQL 15 on Windows: **79 passed, 10 failed**.

| Failing test(s) | Cause | Fix |
| --- | --- | --- |
| 7 OTP tests in `test_auth.py` and `test_reset_token_is_not_cached` | The tests read the OTP from a synchronous in-memory mail outbox. Email now goes through Celery (`send_reset_code_task.delay`), so the outbox stays empty. | In tests, mock `tasks.send_reset_code_task.delay`, or run Celery in eager mode (`task_always_eager=True`) |
| `test_smtp_transport` | The mailer now sends HTML multipart email, so the test's `KeyError: 'multipart/alternative'` shows it still expects the old plain-text message | Update the assertion to the multipart structure |
| `test_operation_summary_counts_by_status` | `/operations/summary` now also returns `lifetime_validations` from Redis | Ignore that key in the assertion |

All stock, ledger, concurrency and operation-workflow tests pass. The failures are out-of-date tests, not stock-integrity bugs.

## Continuous integration

`.github/workflows/backend.yml` runs on pushes to `main` and on pull requests that touch `backend/**`:

1. It starts a PostgreSQL 15 service container.
2. It installs `requirements.lock` on Python 3.12.
3. It runs `ruff check`, `ruff format --check` and `pytest -q`.

`requirements.lock` does not yet include `celery` and `redis`, which `pyproject.toml` requires. Regenerate the lock file so CI can import `app.tasks`.

## Frontend checks

```bash
cd frontend
npm ci
npm run lint     # oxlint
npm run build    # tsc -b && vite build
```

## Manual end-to-end checklist

Use the demo data (`backend/seed.py`, see [DEMO_GUIDE.md](DEMO_GUIDE.md)) or a fresh database.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Sign up a new user, then log in | Lands on `/dashboard` as warehouse staff |
| 2 | As staff, try to create a product | Blocked (`403`) |
| 3 | Log in as a manager and create a warehouse, locations, a category and a product with opening stock | Product detail shows the stock at that location; Move History shows `INITIAL` |
| 4 | Create a receipt, add lines, then Waiting → Ready → Validate | Stock increases; `RECEIPT` rows appear; a toast is shown |
| 5 | Try to edit the validated receipt | Rejected: the document is `DONE` |
| 6 | Create a delivery for more than is on hand, then Pick → Pack → Validate | `409 INSUFFICIENT_STOCK`; nothing changes |
| 7 | Reduce the quantity and validate again | Stock decreases; `DELIVERY` row appears |
| 8 | Transfer between two locations | Source goes down and destination goes up; the product total is unchanged; two `TRANSFER` rows |
| 9 | Adjustment with a lower counted quantity and a reason | Negative `ADJUSTMENT` row; recorded quantity and delta are shown |
| 10 | Push a product below its reorder minimum | It appears in the dashboard low-stock panel, and a `LOW_STOCK_ALERT` toast is shown |
| 11 | Forgot password with a worker and a local SMTP inbox (Mailpit) running | OTP email arrives; the reset works; old sessions are logged out |
| 12 | Log out, then reuse the old token | `401` |
