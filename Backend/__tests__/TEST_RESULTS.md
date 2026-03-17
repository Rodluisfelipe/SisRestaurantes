# Resultados de Pruebas — Backend SisRestaurantes

**Fecha:** 2026-03-17  
**Comando:** `npx jest --forceExit --detectOpenHandles --verbose`  
**Resultado:** ✅ 9 suites, 151 tests, 0 fallos  
**Tiempo:** 2.86s

---

## Resumen

| Suite | Tests | Estado |
|---|---|---|
| categories.test.js | 16 | ✅ PASS |
| orders.test.js | 21 | ✅ PASS |
| validate.test.js | 24 | ✅ PASS |
| customers.test.js | 25 | ✅ PASS |
| reviews.test.js | 20 | ✅ PASS |
| auth.test.js | 16 | ✅ PASS |
| products.test.js | 19 | ✅ PASS |
| sanitizeUpload.test.js | 7 | ✅ PASS |
| asyncHandler.test.js | 3 | ✅ PASS |
| **Total** | **151** | **✅ ALL PASS** |

---

## Detalle por Suite

### categories.test.js (16 tests)
- POST /categories — Create
  - ✅ accepts valid category
  - ✅ accepts category with description and displayOrder
  - ✅ trims whitespace from name
  - ✅ rejects empty name
  - ✅ rejects whitespace-only name
  - ✅ rejects name longer than 100 chars
- GET /categories — List
  - ✅ returns categories for businessId
  - ✅ returns empty array without businessId
- PUT /categories/:id — Update
  - ✅ accepts valid update
  - ✅ rejects update with empty name
  - ✅ rejects invalid ID format
- DELETE /categories/:id — Delete
  - ✅ accepts valid category ID
  - ✅ rejects invalid ID
- PUT /categories/reorder — Reorder
  - ✅ accepts valid reorder payload
  - ✅ rejects missing categories array
  - ✅ rejects non-array categories

### orders.test.js (21 tests)
- POST /orders — Create
  - ✅ accepts valid inSite order
  - ✅ accepts valid delivery order with address
  - ✅ accepts valid takeaway order
  - ✅ accepts order with multiple items
  - ✅ accepts order with optional fields
  - ✅ rejects missing businessId
  - ✅ rejects missing customerName
  - ✅ rejects customerName longer than 100 chars
  - ✅ rejects invalid orderType
  - ✅ rejects empty items array
  - ✅ rejects items with missing name
  - ✅ rejects items with zero quantity
  - ✅ rejects negative totalAmount
  - ✅ rejects address longer than 500 chars
  - ✅ rejects items with negative price
  - ✅ rejects more than 100 items
- Order status transitions
  - ✅ all expected statuses are defined
  - ✅ terminal statuses should include completed, delivered, cancelled
  - ✅ valid flow: pending → inProgress → ready → completed
  - ✅ valid flow: pending → confirmed → preparing → ready → delivered
  - ✅ cancellation is a valid status

### validate.test.js (24 tests)
- POST /register validation
  - ✅ accepts valid payload
  - ✅ rejects missing name
  - ✅ rejects missing email
  - ✅ rejects invalid email format
  - ✅ rejects short password
  - ✅ rejects missing businessName
  - ✅ rejects name longer than 100 chars
- POST /login validation
  - ✅ accepts valid credentials
  - ✅ rejects missing username
  - ✅ rejects missing password
  - ✅ rejects username longer than 100 chars
- POST /order validation
  - ✅ accepts valid order
  - ✅ rejects missing businessId
  - ✅ rejects missing customerName
  - ✅ rejects invalid orderType
  - ✅ rejects empty items array
  - ✅ rejects item without name
  - ✅ rejects item with quantity 0
  - ✅ rejects negative totalAmount
  - ✅ rejects address longer than 500 chars
  - ✅ accepts delivery order with valid address
  - ✅ accepts takeaway order
  - ✅ accepts customerName with max 100 chars
  - ✅ rejects customerName longer than 100 chars

### customers.test.js (25 tests)
- POST /customers — Create
  - ✅ accepts valid customer
  - ✅ accepts customer with optional email and address
  - ✅ rejects missing phone
  - ✅ rejects missing name
  - ✅ rejects empty phone
  - ✅ rejects empty name
  - ✅ rejects invalid email
  - ✅ rejects duplicate customer (same phone + businessId)
- GET /customers — List
  - ✅ returns paginated customer list
  - ✅ defaults to page 1, limit 20
  - ✅ supports search param
- GET /customers/:phone — Get
  - ✅ returns customer by phone
  - ✅ returns 404 for unknown phone
  - ✅ rejects too-short phone
- PUT /customers/:phone — Update
  - ✅ accepts valid update
  - ✅ rejects updating protected field: businessId
  - ✅ rejects updating protected field: totalOrders
  - ✅ rejects updating protected field: phone
- PATCH /customers/:phone/address — Update Address
  - ✅ accepts address update
  - ✅ accepts name update
  - ✅ rejects when neither name nor address provided
- DELETE /customers/:phone — Delete by Phone
  - ✅ accepts valid phone
  - ✅ rejects too-short phone
- DELETE /customers/by-id/:id — Delete by ID
  - ✅ accepts valid ObjectId
  - ✅ rejects invalid ObjectId

### reviews.test.js (20 tests)
- POST /reviews — Create
  - ✅ accepts valid 5-star review
  - ✅ accepts review with thumbsUp
  - ✅ accepts 1-star review
  - ✅ accepts review without comment
  - ✅ rejects duplicate review for same orderId
  - ✅ rejects missing phone
  - ✅ rejects missing businessId
  - ✅ rejects missing orderId
  - ✅ rejects missing customerName
  - ✅ rejects missing rating
  - ✅ rejects invalid businessId format
  - ✅ rejects rating 0
  - ✅ rejects rating 6
  - ✅ rejects non-integer rating
- GET /reviews — List
  - ✅ returns reviews for businessId
  - ✅ supports pagination params
  - ✅ rejects missing businessId
- GET /reviews/check/:orderId — Check
  - ✅ returns true for order that already has review
  - ✅ returns false for order without review
  - ✅ rejects invalid orderId format

### auth.test.js (16 tests)
- Registration Flow
  - ✅ accepts valid registration
  - ✅ accepts registration with optional businessType
  - ✅ rejects empty name
  - ✅ rejects name longer than 100 chars
  - ✅ rejects empty businessName
  - ✅ rejects businessName longer than 100 chars
  - ✅ rejects invalid email format
  - ✅ rejects missing email
  - ✅ rejects password shorter than 8 chars
  - ✅ rejects missing password
  - ✅ normalizes email to lowercase
- Login Flow
  - ✅ accepts valid login
  - ✅ rejects empty username
  - ✅ rejects missing password
  - ✅ rejects username longer than 100 chars
  - ✅ trims whitespace from username

### products.test.js (19 tests)
- POST /products — Create
  - ✅ accepts valid product
  - ✅ accepts product with price 0 (free item)
  - ✅ accepts product with string price (FormData)
  - ✅ accepts product with optional fields
  - ✅ rejects missing name
  - ✅ rejects empty name
  - ✅ rejects missing price
  - ✅ rejects negative price
  - ✅ rejects NaN price
  - ✅ rejects missing businessId on POST
  - ✅ rejects non-string businessId
  - ✅ rejects multiple validation errors at once
- PUT /products/:id — Update
  - ✅ accepts valid update (businessId not required for PUT)
  - ✅ rejects update with empty name
  - ✅ rejects update with negative price
- PATCH /products/:id/toggle — Deactivate/Activate
  - ✅ accepts valid ObjectId
  - ✅ rejects invalid ID format
- DELETE /products/:id — Delete
  - ✅ accepts valid product ID
  - ✅ rejects invalid ID format

### sanitizeUpload.test.js (7 tests)
- ✅ exports a function
- ✅ returns a middleware function when called with options
- ✅ returns a middleware function when called without options
- ✅ middleware accepts 3 args (req, res, next)
- ✅ calls next() immediately when no file is present
- ✅ calls next() for non-image file (PDF)
- ✅ does not throw for image file without actual disk file (graceful)

### asyncHandler.test.js (3 tests)
- ✅ calls the wrapped function with req, res, next
- ✅ calls next with error when handler rejects
- ✅ calls next with error when handler throws synchronously
