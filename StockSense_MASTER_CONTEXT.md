# StockSense — Master Context

## 1. Project

**Project Name:** StockSense  
**Project Type:** Inventory Management System (IMS)

StockSense is a modular Inventory Management System designed to digitize and streamline stock operations, replacing manual registers, Excel sheets, and scattered tracking methods with a centralized, real-time, easy-to-use application.

**Primary Users**
- Inventory Managers
- Warehouse Staff

**Source of truth:** StockSense Problem Statement PDF.

**UI/UX reference:** Excalidraw mockup linked from the problem statement.

---

# 2. STRICT SCOPE

Build ONLY the requirements defined in the StockSense problem statement.

Do NOT add features that are not required.

### Explicitly OUT OF SCOPE

- AI/ML
- AI chatbot
- Forecasting
- Anomaly detection
- Recommendation systems
- QR/barcode features
- Mobile warehouse mode
- Advanced analytics/reporting not requested
- External integrations not requested
- Any other "wow" feature not present in the requirement

Engineering safeguards are allowed when they improve correctness, security, maintainability, or reliability of the required features.

---

# 3. CORE PRODUCT MODULES

The system must cover:

1. Authentication
2. Dashboard
3. Products
4. Product Categories
5. Reordering Rules
6. Warehouses
7. Locations
8. Receipts
9. Delivery Orders
10. Internal Transfers
11. Inventory Adjustments
12. Stock Ledger / Move History
13. Low Stock Alerts
14. Profile / Logout
15. Settings → Warehouse

---

# 4. NON-NEGOTIABLE ENGINEERING RULES

## Never do these

- Do not build fake buttons.
- Do not build UI controls that do nothing.
- Do not use hardcoded dashboard numbers.
- Do not use fake stock calculations.
- Do not store only a global product stock number.
- Do not skip the stock ledger.
- Do not allow invalid stock operations.
- Do not expose database credentials.
- Do not hardcode API keys.
- Do not put business logic inside UI components.
- Do not make frontend responsible for authoritative stock calculations.
- Do not silently mutate historical ledger records.
- Do not create fake API responses just to make the UI look complete.
- Do not implement AI/ML.
- Do not add unrequested features.

## Required principles

- Keep business logic in the backend/service layer.
- Keep frontend responsible for presentation and user interaction.
- Use reusable components.
- Use clear naming.
- Keep code maintainable.
- Add comments only where they provide real value.
- Handle errors gracefully.
- Use database transactions for stock operations.
- Make operations idempotent where appropriate.
- Preserve historical ledger records.
- Validate all inputs on the backend.
- Never trust frontend-calculated stock values.
- Keep secrets in environment variables.
- Use proper HTTP status codes and meaningful error responses.
- Prevent invalid/negative stock operations according to business rules.

---

# 5. AUTHENTICATION

Required:

- Sign up
- Login
- OTP-based password reset
- Logout
- Profile
- Redirect authenticated users to Inventory Dashboard

Authentication must be real and connected to the backend/database.

Do not use fake authentication.

Passwords must never be stored as plain text.

OTP/reset flows must be validated server-side.

---

# 6. DASHBOARD

The dashboard must display real data.

Required KPIs:

- Total Products in Stock
- Low Stock / Out of Stock
- Pending Receipts
- Pending Deliveries
- Internal Transfers Scheduled

### Dashboard filters

Document Type:
- Receipts
- Delivery
- Internal
- Adjustments

Status:
- Draft
- Waiting
- Ready
- Done
- Canceled

Other filters:
- Warehouse / Location
- Product Category

### Critical rule

Dashboard values must come from the database/backend.

Never hardcode example numbers.

---

# 7. PRODUCTS

Users must be able to create and update products.

Required product fields:

- Name
- SKU / Code
- Category
- Unit of Measure
- Initial Stock (optional)

Products must support stock availability by location.

Required related functionality:

- Product Categories
- Reordering Rules

### Product rules

- SKU/code should follow a clear uniqueness rule.
- Product stock must not be treated as only one global number.
- Location-level balances must be represented.
- Product creation/update must be validated by the backend.

---

# 8. WAREHOUSES AND LOCATIONS

The system must support multiple warehouses/locations.

Examples from the requirement:

- Main Warehouse
- Production Floor
- Rack A
- Rack B
- Warehouse 1
- Warehouse 2

A product's stock must be traceable to its location.

The data model must support:

**Product + Location = Stock Balance**

Do not store only:

**Product = Global Stock**

Global stock may be calculated from location-level balances.

---

# 9. STOCK DATA MODEL

The inventory design must support both current state and historical movement.

Recommended conceptual structure:

```text
Product
  |
  +---- Category
  |
  +---- Stock Balances
  |        |
  |        +---- Location
  |
  +---- Reordering Rule
  |
  +---- Stock Ledger
           |
           +---- Receipt
           +---- Delivery
           +---- Internal Transfer
           +---- Adjustment
```

## Stock Balance

Represents current quantity for a product at a specific location.

Conceptually:

```text
product_id
location_id
quantity
updated_at
```

## Stock Ledger

Represents immutable historical stock movements.

Conceptually:

```text
id
product_id
source_location_id
destination_location_id
operation_type
reference_id
quantity
before_quantity
after_quantity
timestamp
user_id
notes
```

Exact schema may be adapted to the chosen backend/database, but the principles must remain.

---

# 10. STOCK LEDGER — CRITICAL

The Stock Ledger is a core part of StockSense.

Every stock-changing operation must create a ledger record.

Ledger history must be preserved.

Do not delete or rewrite historical movement records merely to correct the current state.

Required movement types include:

- Receipt
- Delivery
- Internal Transfer
- Inventory Adjustment

The ledger should make it possible to understand:

- What changed
- Which product changed
- Which location changed
- How much changed
- Previous quantity
- New quantity
- Which operation caused the change
- When it happened
- Who performed it

---

# 11. RECEIPTS

Receipts represent incoming goods from suppliers.

Required flow:

```text
Create Receipt
      ↓
Add Supplier
      ↓
Add Products
      ↓
Enter Quantities
      ↓
Validate
      ↓
Increase Stock
      ↓
Create Ledger Record
```

Example:

```text
Receive 50 Steel Rods
→ Stock increases by 50
→ Ledger records the receipt
```

The stock update and ledger creation must happen in the same database transaction.

---

# 12. DELIVERY ORDERS

Delivery Orders represent outgoing stock.

Required flow:

```text
Create Delivery Order
      ↓
Pick
      ↓
Pack
      ↓
Validate
      ↓
Decrease Stock
      ↓
Create Ledger Record
```

Example:

```text
Deliver 10 Chairs
→ Stock decreases by 10
→ Ledger records the delivery
```

The system must validate that sufficient stock exists before completing a delivery.

Do not allow invalid stock deductions.

---

# 13. INTERNAL TRANSFERS

Internal transfers move stock between company locations.

Examples:

```text
Main Warehouse → Production Floor
Rack A → Rack B
Warehouse 1 → Warehouse 2
```

A transfer must:

1. Validate source stock.
2. Decrease source location quantity.
3. Increase destination location quantity.
4. Preserve total global stock.
5. Create ledger records.
6. Complete atomically in a database transaction.

Example:

```text
Warehouse A = 100
Transfer 30 to Warehouse B

Warehouse A = 70
Warehouse B = 30

Global stock remains 100
```

Do not update only the destination.

Do not update only the source.

Both sides must remain consistent.

---

# 14. INVENTORY ADJUSTMENTS

Adjustments correct differences between recorded stock and physical count.

Required flow:

```text
Select Product
      ↓
Select Location
      ↓
Enter Counted Quantity
      ↓
Calculate Difference
      ↓
Update Stock
      ↓
Create Adjustment Ledger Record
```

Example:

```text
Recorded = 100
Physical = 97

Adjustment = -3
New Stock = 97
```

The system must preserve the adjustment history.

---

# 15. LOW STOCK / REORDERING RULES

The system must support reordering rules.

Low-stock alerts must be based on actual stored inventory and configured rules.

Do not hardcode low-stock values in the frontend.

The backend should determine whether a product/location is low stock or out of stock.

---

# 16. SEARCH AND FILTERING

Required:

- SKU search
- Smart filters
- Product category filtering
- Warehouse/location filtering
- Document type filtering
- Status filtering

Filtering must operate on actual database records.

---

# 17. OPERATION STATUS

The requirement includes statuses:

```text
Draft
Waiting
Ready
Done
Canceled
```

Status transitions must be controlled by backend business rules.

Do not allow arbitrary frontend status changes.

Stock should be changed only at the appropriate validated operation stage.

For example:

- Creating a receipt does not automatically mean stock has been received.
- A delivery should not reduce stock before the required validation stage.
- Canceled operations must not accidentally change stock.
- Repeating a completed stock operation must not duplicate the stock movement.

---

# 18. TRANSACTION SAFETY

All stock-changing operations must use database transactions.

Examples:

### Receipt

```text
BEGIN TRANSACTION

Validate receipt
Validate product/location
Update stock balance
Create ledger record
Mark receipt as completed

COMMIT
```

If any step fails:

```text
ROLLBACK
```

### Delivery

```text
BEGIN TRANSACTION

Validate delivery
Check sufficient stock
Update stock balance
Create ledger record
Mark delivery as completed

COMMIT
```

### Transfer

```text
BEGIN TRANSACTION

Check source stock
Decrease source
Increase destination
Create ledger records
Mark transfer as completed

COMMIT
```

### Adjustment

```text
BEGIN TRANSACTION

Read current quantity
Calculate adjustment
Update stock
Create ledger record
Mark adjustment as completed

COMMIT
```

Never leave the database half-updated.

---

# 19. IDEMPOTENCY

Stock-changing operations must be idempotent where appropriate.

Example:

If the same receipt validation request is accidentally submitted twice, the system must not add the receipt quantity twice.

Use appropriate mechanisms such as:

- Operation status checks
- Unique operation/reference IDs
- Database constraints
- Transactional locking where required

The exact implementation is up to the backend team.

---

# 20. FRONTEND ARCHITECTURE

Frontend responsibilities:

- Presentation
- User interaction
- Form handling
- Navigation
- API calls
- Loading states
- Error states
- Validation feedback
- Reusable UI components

Frontend must NOT be the source of truth for:

- Stock quantities
- Ledger records
- Operation validity
- Authorization
- Business rules

Use reusable components.

Avoid duplicated UI logic.

Use clear naming.

Keep components reasonably small and maintainable.

---

# 21. BACKEND ARCHITECTURE

Recommended separation:

```text
Routes / Controllers
        ↓
Services / Business Logic
        ↓
Repositories / Data Access
        ↓
Database
```

Business rules belong in the service layer.

Examples:

```text
ReceiptService
DeliveryService
TransferService
AdjustmentService
InventoryService
ProductService
WarehouseService
AuthService
```

Exact names may vary.

Avoid putting business logic directly inside route handlers.

---

# 22. API RULES

APIs must:

- Validate input
- Authenticate users where required
- Authorize operations where required
- Return meaningful status codes
- Return structured error responses
- Never expose secrets
- Never trust client-calculated stock
- Return real database data
- Prevent invalid stock operations

Example response pattern:

```json
{
  "success": false,
  "message": "Insufficient stock",
  "code": "INSUFFICIENT_STOCK"
}
```

Exact response format can be standardized by the team.

---

# 23. SECURITY

Never commit:

- Database passwords
- JWT secrets
- API keys
- OTP secrets
- Cloud credentials
- Service account keys

Use environment variables.

Provide a safe example such as:

```text
.env.example
```

with placeholders only.

Example:

```text
DATABASE_URL=
JWT_SECRET=
OTP_PROVIDER_KEY=
```

Never put real values in source control.

---

# 24. TEAM OWNERSHIP

## MEMBER 1 — Backend Core

Owns:

- Backend foundation
- Database schema
- Authentication
- Roles
- Products
- Categories
- Warehouses
- Locations
- Reordering rules
- Stock balance foundation
- Stock ledger foundation

Does NOT own:

- Receipt workflow
- Delivery workflow
- Transfer workflow
- Adjustment workflow
- Frontend

---

## MEMBER 2 — Operations Backend

Owns:

- Suppliers
- Receipts
- Delivery Orders
- Internal Transfers
- Inventory Adjustments
- Operation statuses
- Stock operation backend
- Stock ledger operation integration
- Low-stock alerts
- Backend tests

Must use Member 1's inventory/stock services rather than independently creating conflicting stock logic.

Does NOT own:

- Authentication
- Product CRUD
- Warehouse CRUD
- Main dashboard UI
- Frontend
- AI/ML
- Unrequested features

---

## MEMBER 3 — Core Frontend

Owns:

- Application layout
- Sidebar
- Header
- Login
- Signup
- OTP reset UI
- Dashboard
- Products UI
- Categories UI
- Warehouses UI
- Locations UI
- Reordering Rules UI
- Profile
- Logout
- Shared UI components

Does NOT own:

- Operations UI
- Ledger UI
- Backend business logic
- AI/ML
- Unrequested features

---

## MEMBER 4 — Operations Frontend / Ledger

Owns:

- Receipts UI
- Delivery Orders UI
- Internal Transfers UI
- Inventory Adjustments UI
- Move History
- Stock Ledger UI
- Operation status handling
- Integration with Member 2 APIs
- End-to-end testing

Does NOT own:

- Authentication
- Product management
- Warehouse management
- Main dashboard
- Backend business logic
- AI/ML
- Unrequested features

---

# 25. GIT WORKFLOW

Recommended:

```text
main
  ↑
develop
  ↑
feature/member1-core
feature/member2-operations
feature/member3-frontend
feature/member4-operations-ui
```

Do not directly push feature work to `main`.

Each member should:

1. Pull latest `develop`.
2. Create/use their feature branch.
3. Make small logical commits.
4. Push the branch.
5. Open a PR into `develop`.
6. Resolve integration issues.
7. Merge only after review/testing.

---

# 26. COMMIT CONVENTION

Use:

```text
feat(scope): description
fix(scope): description
refactor(scope): description
test(scope): description
docs(scope): description
```

Examples:

```text
feat(auth): implement login
feat(products): implement product CRUD
feat(receipts): implement receipt validation
feat(transfers): implement internal transfer
feat(dashboard): implement inventory KPIs
test(inventory): add stock transaction tests
fix(delivery): prevent negative stock
```

---

# 27. TESTING REQUIREMENTS

At minimum test:

### Authentication
- Signup
- Login
- Invalid credentials
- OTP reset
- Logout

### Products
- Create product
- Update product
- Duplicate SKU handling
- Category handling

### Stock
- Receipt increases stock
- Delivery decreases stock
- Transfer moves stock correctly
- Adjustment changes stock correctly
- Invalid stock operation is rejected
- Insufficient stock is rejected
- Ledger entry is created
- Repeated operation does not duplicate stock

### Dashboard
- KPIs use actual database data
- Filters return correct records

### Integration
Verify the complete stock lifecycle.

---

# 28. CRITICAL DEMO SCENARIO

Use this scenario to verify that all modules work together.

Initial state:

```text
Steel = 0 KG
```

### Step 1 — Receipt

Receive:

```text
+100 KG
```

Expected:

```text
Global = 100 KG
```

### Step 2 — Internal Transfer

Transfer:

```text
40 KG
Warehouse → Production
```

Expected:

```text
Warehouse = 60 KG
Production = 40 KG
Global = 100 KG
```

### Step 3 — Delivery

Deliver:

```text
20 KG
```

Assuming the delivery is from the Warehouse:

```text
Warehouse = 40 KG
Production = 40 KG
Global = 80 KG
```

### Step 4 — Adjustment

Adjust damaged stock:

```text
-3 KG
```

If adjustment is from the Warehouse:

```text
Warehouse = 37 KG
Production = 40 KG
Global = 77 KG
```

The ledger must contain records for:

```text
Receipt +100
Transfer 40
Delivery 20
Adjustment -3
```

The exact source/destination and resulting balances must match the operation data entered during the demo.

---

# 29. DEFINITION OF DONE

A feature is NOT complete merely because its UI exists.

A feature is complete only when:

- UI exists where required.
- API exists where required.
- Database persistence works.
- Validation works.
- Errors are handled.
- Business logic is in the backend/service layer.
- Stock calculations are real.
- Ledger records are created where required.
- Transactions protect stock operations.
- Duplicate execution is handled where appropriate.
- No secrets are exposed.
- No hardcoded fake data is used for production behavior.
- Tests cover important business rules.
- The feature integrates correctly with the rest of the system.

---

# 30. FINAL ACCEPTANCE CHECKLIST

Before declaring StockSense complete, verify:

## Authentication
- [ ] Signup works
- [ ] Login works
- [ ] OTP password reset works
- [ ] Logout works
- [ ] Profile works

## Products
- [ ] Product creation works
- [ ] Product update works
- [ ] SKU/code validation works
- [ ] Categories work
- [ ] Reordering rules work

## Warehouse
- [ ] Multiple warehouses/locations work
- [ ] Product stock is location-aware

## Receipts
- [ ] Receipt creation works
- [ ] Supplier/product/quantity data is stored
- [ ] Validation increases stock
- [ ] Ledger entry is created
- [ ] Duplicate validation cannot double-add stock

## Deliveries
- [ ] Delivery creation works
- [ ] Pick/Pack/Validate flow works
- [ ] Stock availability is checked
- [ ] Validation decreases stock
- [ ] Ledger entry is created
- [ ] Invalid delivery is rejected

## Transfers
- [ ] Source stock is checked
- [ ] Source decreases
- [ ] Destination increases
- [ ] Global stock remains consistent
- [ ] Ledger records are created
- [ ] Transaction is atomic

## Adjustments
- [ ] Product/location can be selected
- [ ] Counted quantity can be entered
- [ ] Difference is calculated
- [ ] Stock is updated
- [ ] Ledger entry is created

## Dashboard
- [ ] KPIs are database-driven
- [ ] No hardcoded stock numbers
- [ ] Filters work
- [ ] Status filtering works
- [ ] Warehouse/location filtering works
- [ ] Category filtering works

## Ledger
- [ ] Every stock-changing operation is recorded
- [ ] Historical records are preserved
- [ ] Move History works
- [ ] Ledger data is accurate

## Security
- [ ] No database credentials in source
- [ ] No API keys in source
- [ ] Environment variables are used
- [ ] Backend validates requests
- [ ] Authorization is enforced

## Code Quality
- [ ] Business logic is in services
- [ ] Frontend is presentation-focused
- [ ] Components are reusable
- [ ] Naming is clear
- [ ] Errors are handled gracefully
- [ ] Comments are meaningful
- [ ] Tests exist for critical stock logic

---

# 31. FINAL RULE

If a requested implementation is not present in the StockSense problem statement, DO NOT add it automatically.

If a requirement is ambiguous:

1. Check the problem statement.
2. Check the existing architecture/code.
3. Prefer the smallest implementation that satisfies the documented requirement.
4. Do not invent product behavior.
5. Do not add AI or other unrequested functionality.

**StockSense should be a real, working Inventory Management System — not a UI mockup with fake data.**
