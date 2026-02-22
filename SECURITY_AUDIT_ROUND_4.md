# 🔒 FOURTH-ROUND COMPREHENSIVE SECURITY AUDIT

**Date:** 2025-01-XX  
**Scope:** Full Backend (`/Backend/**`)  
**Stack:** Node.js 20 + Express 4 + MongoDB (Mongoose 8) + Socket.IO 4  
**Auditor:** Automated Deep Code Review  

---

## EXECUTIVE SUMMARY

After reviewing **every file** in the Backend directory (27 route files, 5 middleware files, 23 models, 7 services, 11 utility files, Docker configs, and package.json), this fourth-round audit has identified **17 new vulnerabilities** that were missed or introduced since rounds 1–3. The most critical findings are **IDOR vulnerabilities in order management** and **mass assignment in multiple routes** that bypass tenant isolation.

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 3 |
| 🟠 HIGH | 6 |
| 🟡 MEDIUM | 6 |
| 🔵 LOW | 2 |
| **Total** | **17** |

---

## FINDINGS

---

### FINDING 1 — IDOR: Order Admin Endpoints Missing Tenant Compound Query

| Field | Value |
|-------|-------|
| **Severity** | 🔴 CRITICAL |
| **File** | `Backend/Routes/orders.js` |
| **Lines** | 600–628 (PATCH /:id/status), 707–726 (PATCH /:id/send-to-kitchen), 728–748 (DELETE /:id), 935–969 (PATCH /:id/confirm-payment), 971–1020 (PATCH /:id/reject-payment) |
| **Category** | IDOR / Tenant Isolation |

**Description:**  
Five admin order endpoints use `tenantAuth` middleware, but none of them verify the order belongs to the authenticated user's business. When no `businessId` is in the request body/query, `tenantAuth` sets `req.resolvedBusinessId` from the token and calls `next()`. The route handlers then use `Order.findByIdAndUpdate(id, ...)` or `Order.findById(id)` **without a compound `{ _id, businessId }` query**, allowing any authenticated admin to modify or delete orders from ANY business.

**Affected endpoints:**
- `PATCH /:id/status` — change status of any order
- `PATCH /:id/send-to-kitchen` — mark any order as sent to kitchen
- `DELETE /:id` — delete any order
- `PATCH /:id/confirm-payment` — confirm payment on any order
- `PATCH /:id/reject-payment` — reject payment on any order

**Exploitation scenario:**  
Admin of Business-A obtains the MongoDB `_id` of an order from Business-B (e.g., from a shared tracking URL, enumeration, or leaked ID). They send `PATCH /api/orders/{victimOrderId}/status` with body `{ "status": "cancelled" }`. `tenantAuth` passes because the admin has a valid token, and no `businessId` mismatch is checked. The order is cancelled, impacting Business-B.

**Recommended fix:**
```javascript
// PATCH /:id/status — add compound query
router.patch("/:id/status", tenantAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    
    // ... status validation ...
    
    // Use compound query to enforce tenant isolation
    const userBusinessId = req.user.businessId;
    const filter = req.user.isSuperAdmin
      ? { _id: id }
      : { _id: id, businessId: userBusinessId };
    
    const updatedOrder = await Order.findOneAndUpdate(filter, updateData, { new: true });
    
    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    // ... rest of handler
  }
});

// Apply same pattern to: send-to-kitchen, DELETE /:id, confirm-payment, reject-payment
```

---

### FINDING 2 — IDOR: Categories POST Allows Cross-Tenant Update via `_id` in Body

| Field | Value |
|-------|-------|
| **Severity** | 🔴 CRITICAL |
| **File** | `Backend/Routes/categories.js` |
| **Lines** | 42–58 |
| **Category** | IDOR / Tenant Isolation |

**Description:**  
The `POST /api/categories` route checks if `req.body._id` is set. If it is, the code calls `Category.findByIdAndUpdate(req.body._id, ...)` **without any `businessId` filter**. An authenticated admin can update ANY category from ANY business by providing a known `_id`.

```javascript
if (req.body._id) {
  const updatedCategory = await Category.findByIdAndUpdate(
    req.body._id,  // ← No businessId check!
    { name: req.body.name, description: req.body.description, ... },
    { new: true }
  );
}
```

**Exploitation scenario:**  
Admin-A obtains a category `_id` from Business-B (e.g., by viewing a public category listing). They send `POST /api/categories` with `{ "_id": "victimCategoryId", "name": "HACKED" }`. The category from Business-B is renamed.

**Recommended fix:**
```javascript
if (req.body._id) {
  const updatedCategory = await Category.findOneAndUpdate(
    { _id: req.body._id, businessId: req.user.businessId },  // compound query
    {
      name: req.body.name,
      description: req.body.description,
      displayOrder: req.body.displayOrder,
      active: req.body.active
    },
    { new: true }
  );
  
  if (!updatedCategory) {
    return res.status(404).json({ message: "Categoría no encontrada" });
  }
  // ...
}
```

---

### FINDING 3 — Mass Assignment: Categories PUT /:id Passes `{ ...req.body }` Directly

| Field | Value |
|-------|-------|
| **Severity** | 🔴 CRITICAL |
| **File** | `Backend/Routes/categories.js` |
| **Lines** | 155–170 |
| **Category** | Mass Assignment |

**Description:**  
The `PUT /api/categories/:id` route spreads the entire `req.body` into the update:

```javascript
const updatedCategory = await Category.findByIdAndUpdate(
  req.params.id,
  { ...req.body },   // ← ALL fields from body, including businessId
  { new: true, runValidators: true }
);
```

An admin can overwrite the `businessId` field to transfer the category to their own business, or set any other field. Additionally, the query is `findByIdAndUpdate` by `_id` only — no `businessId` compound query.

**Exploitation scenario:**  
Admin-A sends `PUT /api/categories/{victimCategoryId}` with `{ "businessId": "attacker-business-id", "name": "Stolen Category" }`. The category is transferred to their business.

**Recommended fix:**
```javascript
router.put("/:id", tenantAuth, async (req, res) => {
  try {
    // Whitelist allowed fields
    const { name, description, displayOrder, active } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    if (active !== undefined) updateData.active = active;
    
    // Compound query for tenant isolation
    const updatedCategory = await Category.findOneAndUpdate(
      { _id: req.params.id, businessId: req.user.businessId },
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!updatedCategory) {
      return res.status(404).json(formatHttpError(req, "Categoría no encontrada", 404));
    }
    // ...
  }
});
```

---

### FINDING 4 — Mass Assignment: DeliveryZones PUT /:id Uses `Object.assign(zone, updateData)`

| Field | Value |
|-------|-------|
| **Severity** | 🟠 HIGH |
| **File** | `Backend/Routes/deliveryZones.js` |
| **Lines** | 558–564 |
| **Category** | Mass Assignment |

**Description:**  
The delivery zone update endpoint assigns all `req.body` fields directly to the zone document:

```javascript
const updateData = req.body;
// ...
Object.assign(zone, updateData);
await zone.save();
```

While the zone is fetched with `findOne({ _id: id, businessId })` (compound query), the `Object.assign` allows overwriting `businessId`, `_id`, `createdAt`, or any other internal field.

**Recommended fix:**
```javascript
// Whitelist allowed fields
const allowedFields = ['name', 'type', 'geometry', 'pricing', 'isActive', 'priority', 
                        'estimatedTime', 'description', 'color'];
const sanitizedUpdate = {};
for (const field of allowedFields) {
  if (req.body[field] !== undefined) {
    sanitizedUpdate[field] = req.body[field];
  }
}
Object.assign(zone, sanitizedUpdate);
await zone.save();
```

---

### FINDING 5 — Mass Assignment: BusinessConfig PUT / No Field Blocklist

| Field | Value |
|-------|-------|
| **Severity** | 🟠 HIGH |
| **File** | `Backend/Routes/businessConfig.js` |
| **Lines** | 39–65 |
| **Category** | Mass Assignment |

**Description:**  
The `PUT /api/business-config` route destructures `businessId` but passes everything else to `findByIdAndUpdate`:

```javascript
const { businessId, ...updateData } = req.body;
// No field blocklist!
const config = await BusinessConfig.findByIdAndUpdate(business._id, updateData, { new: true });
```

Unlike the `PUT /:businessId` route (which blocks `_id`, `isActive`, `slug`, `reviewStats`, etc.), this route has **NO blocklist**. An admin can set `isActive: false` to disable their own business permanently, overwrite `reviewStats`, change `slug` (slug squatting), etc.

**Recommended fix:**
```javascript
router.put("/", tenantAuth, async (req, res) => {
    const { businessId, ...updateData } = req.body;
    
    // Block internal/sensitive fields (same blocklist as PUT /:businessId)
    delete updateData._id;
    delete updateData.isActive;
    delete updateData.slug;
    delete updateData.reviewStats;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.__v;
    
    // ... rest of handler
});
```

---

### FINDING 6 — IDOR: ComboGroups POST Uses `req.body.businessId` Instead of Token

| Field | Value |
|-------|-------|
| **Severity** | 🟠 HIGH |
| **File** | `Backend/Routes/comboGroups.js` |
| **Lines** | 24–36 |
| **Category** | IDOR / Tenant Isolation |

**Description:**  
The `POST /api/combo-groups` route uses `tenantAuth` for authentication, but creates the new combo group with `businessId` from `req.body`:

```javascript
const comboGroup = new ComboGroup({
  name: req.body.name,
  businessId: req.body.businessId  // ← from body, not from token!
});
```

`tenantAuth` checks that `req.body.businessId` matches the token's businessId, so it's partially mitigated. However, if the request doesn't include `businessId` at all, `tenantAuth` falls through (sets `req.resolvedBusinessId`) and `req.body.businessId` is `undefined`, creating a combo group with no business association.

**Recommended fix:**
```javascript
router.post("/", tenantAuth, async (req, res) => {
  const comboGroup = new ComboGroup({
    name: req.body.name,
    basePrice: req.body.basePrice,
    description: req.body.description,
    subGroups: req.body.subGroups,
    businessId: req.user.businessId  // Always from token
  });
  // ...
});
```

---

### FINDING 7 — IDOR: Banners GET /business/:businessId Missing Tenant Check

| Field | Value |
|-------|-------|
| **Severity** | 🟠 HIGH |
| **File** | `Backend/Routes/banners.js` |
| **Lines** | 262–275 |
| **Category** | IDOR / Information Disclosure |

**Description:**  
The `GET /api/banners/business/:businessId` route uses `authMiddleware` but performs NO tenant isolation check. Any authenticated admin can view ALL banners (including draft/rejected) for ANY business:

```javascript
router.get('/business/:businessId', authMiddleware, async (req, res) => {
  const { businessId } = req.params;
  const banners = await Banner.find({ businessId }).sort({ createdAt: -1 });
  res.json({ success: true, banners });
});
```

**Recommended fix:**
```javascript
router.get('/business/:businessId', authMiddleware, async (req, res) => {
  try {
    const { businessId } = req.params;
    
    // Tenant isolation: non-SA can only see own business banners
    if (req.user.businessId && req.user.businessId.toString() !== businessId.toString() && !req.user.isSuperAdmin) {
      return res.status(403).json(formatHttpError(req, 'No tienes acceso a estos banners', 403));
    }
    
    const banners = await Banner.find({ businessId }).sort({ createdAt: -1 });
    res.json({ success: true, banners });
  } catch (error) {
    // ...
  }
});
```

---

### FINDING 8 — IDOR: Products POST Allows businessId from Body

| Field | Value |
|-------|-------|
| **Severity** | 🟠 HIGH |
| **File** | `Backend/Routes/products.js` |
| **Lines** | 157–195 |
| **Category** | IDOR / Tenant Isolation |

**Description:**  
`POST /api/products` uses `tenantAuth` but creates the product with `productData.businessId` from `req.body`. While `tenantAuth` validates match with token, the flow is fragile — the resolved businessId from body is used for the product rather than the authoritative `req.user.businessId`. If the body contains a slug that resolves differently than expected, mismatches could occur.

More critically, `tenantAuth` trusts the body's `businessId` after comparing with the token. But the route then calls `resolveBusinessId(productData.businessId)` **again** after tenantAuth already resolved it, potentially getting a different result (TOCTOU).

**Recommended fix:**
```javascript
router.post("/", tenantAuth, validateProductInput, async (req, res) => {
  try {
    let productData = req.body;
    
    // Force businessId from token — never trust client input
    productData.businessId = req.user.businessId;
    
    // ... rest of handler
  }
});
```

---

### FINDING 9 — Socket.IO CORS Allows Null Origin in Production

| Field | Value |
|-------|-------|
| **Severity** | 🟡 MEDIUM |
| **File** | `Backend/server.js` |
| **Lines** | 57–68 |
| **Category** | CORS Misconfiguration |

**Description:**  
The Express CORS correctly rejects null origins in production, but the Socket.IO CORS does NOT:

```javascript
// Socket.IO CORS
origin: function (origin, callback) {
  if (!origin) return callback(null, true);  // ← Allows null in production!
  // ...
}

// Express CORS (correctly blocks in production)
if (!origin) {
  if (isProd) {
    return callback(new Error('Origin required'));
  }
}
```

This allows websocket connections from sandboxed iframes or local files in production.

**Recommended fix:**
```javascript
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) {
        if (isProd) {
          return callback(new Error('Origin required'));
        }
        return callback(null, true);
      }
      // ...
    }
  }
});
```

---

### FINDING 10 — Missing Rate Limit: Auth /verify Endpoint

| Field | Value |
|-------|-------|
| **Severity** | 🟡 MEDIUM |
| **File** | `Backend/Routes/auth.js` |
| **Lines** | 263–281 |
| **Category** | Rate Limiting |

**Description:**  
The `GET /api/auth/verify` endpoint has NO rate limiting. While other auth endpoints (login, register, check-email, refresh) all have rate limiters, `/verify` can be called unlimited times. An attacker could brute-force stolen JWT tokens or enumerate valid tokens without throttling.

**Recommended fix:**
```javascript
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: 'Demasiadas solicitudes. Intente nuevamente más tarde.' }
});

router.get('/verify', verifyLimiter, async (req, res) => {
  // ...
});
```

---

### FINDING 11 — Race Condition: Order Number Generation

| Field | Value |
|-------|-------|
| **Severity** | 🟡 MEDIUM |
| **File** | `Backend/Routes/orders.js` |
| **Lines** | 88–101 |
| **Category** | Business Logic |

**Description:**  
`generateOrderNumber()` uses a non-atomic read-then-increment pattern:

```javascript
const latestOrder = await Order.findOne({ businessId }).sort({ createdAt: -1 });
const lastNumber = parseInt(latestOrder.orderNumber, 10);
return (lastNumber + 1).toString();
```

Two concurrent requests can read the same `latestOrder` and produce duplicate order numbers. In a restaurant system, this causes operational confusion.

**Recommended fix:**
```javascript
const generateOrderNumber = async (businessId) => {
  // Atomic findOneAndUpdate with upsert on a counter collection
  const Counter = require('../Models/Counter'); // Create a simple counter model
  const counter = await Counter.findOneAndUpdate(
    { businessId, name: 'orderNumber' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq.toString();
};
```

---

### FINDING 12 — IDOR: Categories Reorder/Update-Order Missing businessId Check

| Field | Value |
|-------|-------|
| **Severity** | 🟡 MEDIUM |
| **File** | `Backend/Routes/categories.js` |
| **Lines** | 109–137 (PUT /reorder), 167–193 (POST /update-order) |
| **Category** | IDOR |

**Description:**  
Both reorder endpoints update categories by `_id` without verifying they belong to the authenticated user's business:

```javascript
// PUT /reorder
const updatePromises = categories.map(category => 
  Category.findByIdAndUpdate(category._id, { displayOrder: category.order })
);

// POST /update-order
const updatePromises = categories.map(item => 
  Category.findByIdAndUpdate(item.id, { displayOrder: item.order })
);
```

An admin can reorder categories from another business.

**Recommended fix:**
```javascript
const updatePromises = categories.map(category => 
  Category.findOneAndUpdate(
    { _id: category._id, businessId: req.user.businessId },
    { displayOrder: category.order }
  )
);
```

---

### FINDING 13 — Products Reorder/Featured-Reorder Missing businessId Check

| Field | Value |
|-------|-------|
| **Severity** | 🟡 MEDIUM |
| **File** | `Backend/Routes/products.js` |
| **Lines** | 226–252 (PUT /products-reorder), 276–302 (PUT /reorder-featured) |
| **Category** | IDOR |

**Description:**  
The product reorder endpoints use `Product.bulkWrite` or `Product.findByIdAndUpdate` without verifying product IDs belong to the user's business:

```javascript
// products-reorder
const bulkOps = products.map(productData => ({
  updateOne: {
    filter: { _id: productData._id },  // No businessId!
    update: { displayOrder: productData.order }
  }
}));

// reorder-featured
const updatePromises = orderedIds.map((id, index) => 
  Product.findByIdAndUpdate(id, { featuredOrder: index + 1 })  // No businessId!
);
```

**Recommended fix:**
```javascript
// products-reorder
const bulkOps = products.map(productData => ({
  updateOne: {
    filter: { _id: productData._id, businessId: req.user.businessId },
    update: { displayOrder: productData.order }
  }
}));

// reorder-featured
const updatePromises = orderedIds.map((id, index) => 
  Product.findOneAndUpdate(
    { _id: id, businessId: req.user.businessId },
    { featuredOrder: index + 1 }
  )
);
```

---

### FINDING 14 — Products toggle-featured Missing businessId Compound Query

| Field | Value |
|-------|-------|
| **Severity** | 🟡 MEDIUM |
| **File** | `Backend/Routes/products.js` |
| **Lines** | 310–390 (PUT /:id/toggle-featured), 490–510 (PATCH /:id/toggle) |
| **Category** | IDOR |

**Description:**  
Both endpoints use `Product.findById(productId)` without compound query on `businessId`. An admin can toggle featured/active status of products from other businesses.

**Recommended fix:**
```javascript
const product = await Product.findOne({ _id: productId, businessId: req.user.businessId });
if (!product) {
  return res.status(404).json({ message: "Producto no encontrado" });
}
```

---

### FINDING 15 — Debug Routes Accessible to Any Authenticated Admin

| Field | Value |
|-------|-------|
| **Severity** | 🔵 LOW |
| **File** | `Backend/Routes/debug.js` |
| **Lines** | 13–14 |
| **Category** | Access Control |

**Description:**  
Debug routes are protected with `authMiddleware` but not `protectSuperAdmin`. Any authenticated admin (not just SA) can access debug endpoints to view all connected socket clients and test-emit fake socket events to any business. While only available in non-production (`server.js` line 186), development environments with real data are still at risk.

```javascript
router.use(authMiddleware);  // Any admin, not just SA
```

**Recommended fix:**
```javascript
const { protectSuperAdmin } = require('../middleware/authSuperAdmin');
router.use(protectSuperAdmin);  // Only SA can access debug routes
```

---

### FINDING 16 — Force-Change-Password Skips Password Strength Validation

| Field | Value |
|-------|-------|
| **Severity** | 🔵 LOW |
| **File** | `Backend/Routes/auth.js` |
| **Lines** | 353–366 |
| **Category** | Authentication |

**Description:**  
The `/force-change-password` endpoint only checks `newPassword.length < 8`, but doesn't require uppercase, lowercase, or numbers like the `validatePassword()` function used in `/register`:

```javascript
// force-change-password — weak validation
if (!newPassword || newPassword.length < 8) {
  return res.status(400).json({ message: '...' });
}

// register — strong validation
const passwordError = validatePassword(password);  // 8+ chars, upper, lower, number
```

**Recommended fix:**
```javascript
router.post('/force-change-password', authMiddleware, async (req, res) => {
  try {
    const { newPassword } = req.body;
    
    // Use the same strength validation as registration
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }
    // ...
  }
});
```

Also apply the same fix to `POST /change-password` (line 330) which only checks length ≥ 8.

---

### FINDING 17 — Customers DELETE /:phone Uses businessId from Query Instead of Token

| Field | Value |
|-------|-------|
| **Severity** | 🟠 HIGH |
| **File** | `Backend/Routes/customers.js` |
| **Lines** | 347–365 |
| **Category** | Tenant Isolation |

**Description:**  
Although `tenantAuth` validates the request, the actual delete query uses `businessId` from `req.query`:

```javascript
router.delete('/:phone', tenantAuth, async (req, res) => {
  const { businessId } = req.query;
  const customer = await Customer.findOneAndDelete({ 
    businessId: isValidObjectId(businessId) ? businessId : null, 
    phone 
  });
});
```

If the admin omits the `businessId` query param entirely, the query becomes `{ businessId: null, phone }`. While no customer should have `businessId: null`, it's defensive-coding best practice to always use the token's businessId.

**Recommended fix:**
```javascript
router.delete('/:phone', tenantAuth, async (req, res) => {
  const resolvedBusinessId = req.user.businessId;
  const customer = await Customer.findOneAndDelete({ 
    businessId: resolvedBusinessId, 
    phone 
  });
  // ...
});
```

---

## PRIOR-FIX VERIFICATION TABLE

Verification of all major security fixes implemented in rounds 1–3:

| # | Fix Description | File | Status | Notes |
|---|----------------|------|--------|-------|
| 1 | JWT secrets from env (throw if missing) | `config/jwt.js` | ✅ INTACT | Lines 6-10 throw on start |
| 2 | Access token 24h, refresh 7d expiry | `config/jwt.js` | ✅ INTACT | Lines 13, 19 |
| 3 | Refresh token hashed (SHA-256) in DB | `Models/Admin.js` | ✅ INTACT | Pre-save hook |
| 4 | Hashed refresh token comparison | `Models/Admin.js` | ✅ INTACT | `findByRefreshToken` static |
| 5 | Password bcrypt hashing | `Models/Admin.js` | ✅ INTACT | Pre-save hook |
| 6 | Login rate limiter (5/15min) | `Routes/auth.js` | ✅ INTACT | Line 11 |
| 7 | Register rate limiter (3/hr) | `Routes/auth.js` | ✅ INTACT | Line 18 |
| 8 | Check-email rate limiter | `Routes/auth.js` | ✅ INTACT | Line 25 |
| 9 | Refresh rate limiter (20/15min) | `Routes/auth.js` | ✅ INTACT | Line 291 |
| 10 | Password strength validation on register | `Routes/auth.js` | ✅ INTACT | `validatePassword()` |
| 11 | Email format validation on register | `Routes/auth.js` | ✅ INTACT | `validateEmail()` |
| 12 | Helmet with full CSP | `server.js` | ✅ INTACT | Lines 111-130 |
| 13 | HSTS with preload | `server.js` | ✅ INTACT | Line 127 |
| 14 | express-mongo-sanitize | `server.js` | ✅ INTACT | Line 139 |
| 15 | CORS origin whitelist | `server.js` | ✅ INTACT | Lines 83-103 |
| 16 | Null origin rejected in production (Express) | `server.js` | ✅ INTACT | Lines 89-92 |
| 17 | Sentry with sendDefaultPii: false | `server.js` | ✅ INTACT | Line 23 |
| 18 | Debug routes only in non-production | `server.js` | ✅ INTACT | Line 186 |
| 19 | Proof uploads behind authMiddleware | `server.js` | ✅ INTACT | Lines 147-148 |
| 20 | User-exists cache with TTL (5min) | `middleware/authMiddleware.js` | ✅ INTACT | |
| 21 | Token expiry check in authMiddleware | `middleware/authMiddleware.js` | ✅ INTACT | |
| 22 | Generic error messages (no internal leaks) | `middleware/authMiddleware.js` | ✅ INTACT | |
| 23 | tenantAuth compares businessId | `middleware/tenantAuth.js` | ✅ INTACT | |
| 24 | SuperAdmin bypass in tenantAuth | `middleware/tenantAuth.js` | ✅ INTACT | |
| 25 | protectSuperAdmin verifies role + DB existence | `middleware/authSuperAdmin.js` | ✅ INTACT | |
| 26 | SA password reset token hashed (SHA-256) | `Models/SuperAdmin.js` | ✅ INTACT | Pre-save hook |
| 27 | Order creation rate limiter (20/15min) | `Routes/orders.js` | ✅ INTACT | Line 67 |
| 28 | Server-side price validation (5% tolerance) | `Routes/orders.js` | ✅ INTACT | Lines 201-240 |
| 29 | Customer token (crypto.randomBytes) | `Routes/orders.js` | ✅ INTACT | Line 83 |
| 30 | Order track endpoint requires customerToken | `Routes/orders.js` | ✅ INTACT | Lines 441-470 |
| 31 | GET /:id has inline tenant isolation check | `Routes/orders.js` | ✅ INTACT | Lines 478-480 |
| 32 | Items array size limit (100) | `Routes/orders.js` | ✅ INTACT | Line 181 |
| 33 | Customer POST field whitelist | `Routes/customers.js` | ✅ INTACT | Lines 165-167 |
| 34 | Customer rate limiter (30/15min) | `Routes/customers.js` | ✅ INTACT | Line 13 |
| 35 | Customer search ReDoS prevention | `Routes/customers.js` | ✅ INTACT | Escaped regex |
| 36 | Product PUT compound query | `Routes/products.js` | ✅ INTACT | Line 458 |
| 37 | Product DELETE compound query | `Routes/products.js` | ✅ INTACT | Line 472 |
| 38 | validateProductInput middleware | `Routes/products.js` | ✅ INTACT | |
| 39 | Banner POST forces businessId from token | `Routes/banners.js` | ✅ INTACT | Line 293 |
| 40 | Banner DELETE compound query | `Routes/banners.js` | ✅ INTACT | Line 453 |
| 41 | validateBannerInput middleware | `Routes/banners.js` | ✅ INTACT | |
| 42 | Upload folder whitelist | `Routes/upload.js` | ✅ INTACT | |
| 43 | Upload MIME validation | `Routes/upload.js` | ✅ INTACT | |
| 44 | ComboGroups PATCH/DELETE compound query | `Routes/comboGroups.js` | ✅ INTACT | Lines 47, 67 |
| 45 | ComboGroups PATCH field whitelist | `Routes/comboGroups.js` | ✅ INTACT | Lines 52-55 |
| 46 | Review reply/visibility TOCTOU fix | `Routes/reviews.js` | ✅ INTACT | Fetch-check-update |
| 47 | Review admin uses businessId from token | `Routes/reviews.js` | ✅ INTACT | Line 340 |
| 48 | Review search escaped regex | `Routes/reviews.js` | ✅ INTACT | Line 348 |
| 49 | Socket.IO JWT auth in handshake | `services/socketService.js` | ✅ INTACT | |
| 50 | Socket joinBusiness tenant validation | `services/socketService.js` | ✅ INTACT | |
| 51 | Logger PII redaction | `utils/logger.js` | ✅ INTACT | `redactPII()` |
| 52 | Docker non-root user | `Dockerfile` | ✅ INTACT | Lines 20-25 |
| 53 | Docker port bound to 127.0.0.1 | `docker-compose.yml` | ✅ INTACT | Line 6 |
| 54 | Business config PUT /:businessId field blocklist | `Routes/businessConfig.js` | ✅ INTACT | Lines 359-366 |
| 55 | Subscription check on order creation | `Routes/orders.js` | ✅ INTACT | Lines 250-270 |

**All 55 prior fixes remain intact.**

---

## DEPENDENCY AUDIT

| Package | Version | Status | Notes |
|---------|---------|--------|-------|
| express | ^4.19.0 | ⚠️ CHECK | Verify latest 4.x.x patch |
| mongoose | ^8.14.1 | ✅ | Recent |
| jsonwebtoken | ^9.0.2 | ✅ | Latest |
| bcryptjs | ^3.0.2 | ✅ | Latest |
| helmet | ^8.1.0 | ✅ | Latest |
| socket.io | ^4.6.1 | ⚠️ UPDATE | Latest is 4.8.x — upgrade for security patches |
| multer | ^1.4.5-lts.1 | ✅ | LTS line maintained |
| express-rate-limit | ^6.11.2 | ⚠️ UPDATE | v7 available with improved features |
| sharp | ^0.34.5 | ✅ | Recent |
| @sentry/node | ^10.38.0 | ✅ | Recent |
| axios | ^1.7.0 | ✅ | Verify latest 1.x patch |
| nodemailer | ^7.0.2 | ✅ | Recent |

**Recommendation:** Run `npm audit` and update `socket.io` and `express-rate-limit` to latest major versions.

---

## REMEDIATION PRIORITY

| Priority | Findings | Effort |
|----------|----------|--------|
| **P0 — Fix Immediately** | #1 (Order IDOR ×5), #2 (Category IDOR), #3 (Category mass assignment) | 2-3 hours |
| **P1 — Fix This Sprint** | #4-#8 (Mass assignment, IDOR variants), #17 (Customer delete) | 2-3 hours |
| **P2 — Fix This Cycle** | #9-#14 (Socket CORS, rate limit, race condition, reorder IDORs) | 3-4 hours |
| **P3 — Track** | #15-#16 (Debug access, password strength) | 1 hour |

---

## SUMMARY OF PATTERNS

The primary attack surface that remains is **route handlers that don't enforce compound `{ _id, businessId }` queries** despite using `tenantAuth` middleware. `tenantAuth` verifies the user is authenticated and the *request's* businessId matches the token, but many handlers then perform queries using only `_id` — defeating the tenant isolation guarantee.

**Recommended systemic fix:** Create a `requireTenantQuery(model)` utility that wraps Mongoose queries to always include `businessId`:

```javascript
// utils/tenantQuery.js
function tenantFind(model, filter, req) {
  if (!req.user.isSuperAdmin) {
    filter.businessId = req.user.businessId;
  }
  return model.findOne(filter);
}

function tenantFindByIdAndUpdate(model, id, update, options, req) {
  const filter = req.user.isSuperAdmin 
    ? { _id: id } 
    : { _id: id, businessId: req.user.businessId };
  return model.findOneAndUpdate(filter, update, options);
}

module.exports = { tenantFind, tenantFindByIdAndUpdate };
```

This would prevent future regressions by making tenant isolation the default at the query level.
