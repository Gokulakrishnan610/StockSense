# StockSense

Inventory management system. This stage implements **Member 1's backend core** from
the problem statement and team brief: authentication, products, categories,
warehouses, locations, reorder rules, and shared inventory persistence.

## Run the backend

Requirements: Python 3.12+ and PostgreSQL 15+.

```sh
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.lock
cp .env.example .env
```

Create a PostgreSQL database and set `DATABASE_URL` in `.env` to its connection URL.
Set `JWT_SECRET` to a securely generated random value of at least 32 characters
(for example, generate one with `python -c 'import secrets; print(secrets.token_hex(32))'`).
The example secret is intentionally rejected. Keep `.env` private and untracked.

```sh
alembic upgrade head
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`. Interactive API documentation is at
`http://localhost:8000/docs`; its machine-readable contract is `/openapi.json`.
Set `CORS_ORIGINS` to the actual frontend origins.

Sign up with `POST /auth/signup`. New users are warehouse staff. An operator with
database access can grant manager access to an existing account:

```sh
python -m app.admin promote manager@example.com
```

Log in again after promotion. Managers maintain the catalog; both roles can read it.
Login returns a bearer token and `redirect_to: /dashboard` for the frontend to handle.

Password reset sends codes through SMTP. Configure the `SMTP_*` settings for your
mail server or local SMTP inbox. Password reset reports delivery unavailable when
SMTP is unconfigured; it never returns or logs the code. Actual external email
delivery must be verified with the deployment's SMTP configuration.

## Verify

From `backend`, point tests at a dedicated PostgreSQL database whose user can
create schemas. Each test migrates a uniquely named schema and removes it afterward.
Tests do not use or truncate the database's existing application tables.

```sh
TEST_DATABASE_URL='postgresql+psycopg://localhost/stocksense_test' pytest -q
ruff check app tests migrations
ruff format --check app tests migrations
alembic check
```

The integration tests cover authentication, OTP reset, authorization, catalog CRUD,
multiple warehouses, reorder rules, opening stock, rollback, concurrency,
idempotency, database constraints, and migration upgrade/downgrade.

## Team handoff

See [backend/CONTRACT.md](backend/CONTRACT.md) for the API and schema contract.
The PDF defines product scope; the mockups are visual references. Operations,
dashboards, alerts, and frontend screens belong to the other team members and are
not implemented by this backend stage. The stock service is a shared foundation,
not an implementation of operation workflows.

No production deployment or external email configuration is included.
