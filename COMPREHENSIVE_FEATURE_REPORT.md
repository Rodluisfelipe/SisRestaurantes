# MenuBy (SisRestaurantes) — Comprehensive Feature Report

> **Generated from full codebase analysis**  
> Platform: Multi-tenant restaurant SaaS  
> Stack: React + Vite (frontend) · Express.js + MongoDB (backend) · Socket.IO (real-time)  
> Market: Colombia (COP currency, Spanish language)  
> URL: menuby.tech

---

## Table of Contents

1. [Authentication & User Management](#1-authentication--user-management)
2. [Business Registration & Onboarding](#2-business-registration--onboarding)
3. [Business Configuration & Settings](#3-business-configuration--settings)
4. [Menu Management (Products, Categories, Toppings, Combos)](#4-menu-management)
5. [Order System](#5-order-system)
6. [Payment System](#6-payment-system)
7. [Delivery Zones & Geolocation](#7-delivery-zones--geolocation)
8. [Customer Management](#8-customer-management)
9. [Favorites & Order History](#9-favorites--order-history)
10. [Reviews & Ratings](#10-reviews--ratings)
11. [Tables & QR Codes](#11-tables--qr-codes)
12. [Push Notifications](#12-push-notifications)
13. [Kitchen Display](#13-kitchen-display)
14. [WhatsApp Integration](#14-whatsapp-integration)
15. [AI-Powered Tools](#15-ai-powered-tools)
16. [Subscription & Billing](#16-subscription--billing)
17. [Coupons (Subscription)](#17-coupons-subscription)
18. [Business Catalog (Public Marketplace)](#18-business-catalog-public-marketplace)
19. [Banners & Promotions](#19-banners--promotions)
20. [Announcements](#20-announcements-platform-wide)
21. [SuperAdmin Platform Management](#21-superadmin-platform-management)
22. [Real-Time Communication](#22-real-time-communication)
23. [Image Management](#23-image-management)
24. [Landing Page & Marketing](#24-landing-page--marketing)
25. [Frontend Architecture & UX](#25-frontend-architecture--ux)
26. [Security & Infrastructure](#26-security--infrastructure)
27. [Automated Background Tasks](#27-automated-background-tasks)
28. [Reporting & Analytics](#28-reporting--analytics)

---

## 1. Authentication & User Management

**Who uses it:** Business admins, SuperAdmin  
**Backend:** `Routes/auth.js` (1012 lines), `Routes/authSuperAdmin.js`  
**Frontend:** `Pages/Login.jsx`, `Pages/Landing/Login.jsx`, `Pages/Landing/Register.jsx`

### Admin Authentication
- **Email/password login** with bcrypt hashing and JWT tokens (access + refresh)
- **Google OAuth login/register** — verifies Google ID token, auto-links if email already exists
- **Token refresh** endpoint for seamless session management (20 requests / 15min)
- **Token verification** (`/auth/verify`) for frontend route guards
- **Logout** — invalidates refresh token server-side
- **Rate limiting**: 5 login attempts per 15 minutes, 3 registrations per hour

### Password Management
- **Change password** (requires old password verification)
- **Force change password** (for accounts created by SuperAdmin with `mustChangePassword` flag)
- Password requirements: minimum 8 characters, uppercase, lowercase, number

### SuperAdmin Authentication
- Separate auth flow (`/auth-superadmin/login`)
- Google OAuth for SuperAdmin
- Forgot password / Reset password via email flow
- Session validation via `/me` endpoint

### Session Management (Frontend)
- `AuthContext.jsx` — React context for auth state
- `useAdminAuth.js` hook — manages token lifecycle
- `authService.js` — handles token storage, refresh logic
- 3-hour customer session timeout on menu pages
- `sessionManager.js` utility for localStorage/sessionStorage operations

---

## 2. Business Registration & Onboarding

**Who uses it:** New business owners  
**Backend:** `Routes/auth.js` (register, google, onboarding endpoints)  
**Frontend:** `Pages/Landing/Register.jsx`, `Components/Admin/WelcomeWizard.jsx`, `Components/Admin/GuideOverlay.jsx`

### Registration Flow
- Collects: business name, email, password, business type, custom slug (URL)
- **8 business types**: fast_food, restaurant, cafe, bakery, ice_cream, bar, food_truck, other
- Each type auto-creates **default categories** (e.g., fast_food gets: Hamburguesas, Perros Calientes, Papas, Bebidas, Combos, Postres)
- Each type has a default **ordering mode** (whatsapp, inapp, or both)
- **Slug generation**: Auto-generates from business name, suggests 5 variations, checks availability
- **Email availability check** pre-registration
- Auto-creates a **7-day trial subscription** + 1-day grace period

### Progressive Onboarding (6 Levels)
- **Level 1** (Post-registration): Categories + products unlocked
- **Level 2** (≥1 category + ≥1 product): Theme customization unlocked
- **Level 3** (Configured ordering or first order): Orders section unlocked
- **Level 4** (≥5 orders or ≥3 customers): Customers & reviews unlocked
- **Level 5** (≥10 orders): Advanced tools (coupons, tables, delivery zones, catalog)
- **Level 6** (≥15 orders): Everything unlocked, onboarding complete
- **Welcome Wizard**: Step-by-step setup guide on first login
- **Guide Overlays**: Contextual tooltips for each new section (tracked per business)
- Sections lock/unlock based on level — prevents overwhelm for new users
- Always-unlocked sections: location, change-password, subscription, dashboard
- Legacy businesses (pre-onboarding feature) get everything unlocked automatically

---

## 3. Business Configuration & Settings

**Who uses it:** Business admins  
**Backend:** `Routes/businessConfig.js` (415 lines), `Models/BusinessConfig.js` (343 lines)  
**Frontend:** `Components/BusinessSettings.jsx`, `Components/BusinessSettingsAdmin.jsx`, `Components/BusinessHoursSettings.jsx`, `Components/ThemeSettings.jsx`, `Components/LocationSettings.jsx`

### General Settings
- Business name, description, logo, cover image
- WhatsApp number (for support and order channel)
- Address, Google Maps URL
- Geographic location (coordinates for catalog search)
- Department & city (Colombian administrative divisions)
- Social media links: Facebook, Instagram, TikTok
- Extra link (custom URL)

### Business Hours
- Per-day schedule (Monday–Sunday)
- Open/close times with toggle per day
- "Open now" status auto-calculated from schedule
- Manual open/closed toggle (overrides hours)
- Real-time broadcast via WebSocket when toggled

### Menu Status
- Active / Paused toggle
- When paused, menu shows "maintenance" state to customers
- WebSocket broadcast on change

### Ordering Mode
- **WhatsApp only**: Orders go via WhatsApp message
- **In-app only**: Full in-app ordering with payment flow
- **Both**: Customer can choose channel per order

### Payment Configuration
- Payment methods per ordering mode (Nequi, Daviplata, bank transfer)
- Nequi number, Daviplata number, bank account details
- Cash on delivery option
- Configurable per payment method

### Theme Customization
- Button color (primary)
- Button text color
- Applied across all customer-facing pages

### Features Toggles
- Favorites enabled/disabled
- Order history enabled/disabled

### Schema Repair
- Admin endpoint to fix corrupted/incomplete business configs

---

## 4. Menu Management

**Who uses it:** Business admins  
**Backend:** `Routes/products.js` (549 lines), `Routes/categories.js` (229 lines), `Routes/toppingGroups.js` (306 lines), `Routes/comboGroups.js`  
**Frontend:** `Components/Admin/ProductManager.jsx`, `Components/CategorySettings.jsx`, `Components/ToppingGroupsManager.jsx`, `Components/ComboGroupManager.jsx`, `Components/Admin/FeaturedProductsManager.jsx`, `Components/ProductOrderSelector.jsx`

### Categories
- Full CRUD with tenant isolation
- Drag & drop **reordering** (displayOrder field)
- Duplicate name prevention per business
- Auto-created on registration based on business type
- WebSocket events on create/update/delete

### Products
- Full CRUD with image upload
- Fields: name, description, price, category, image, active toggle
- **Topping groups association** — products reference which topping groups apply
- **Featured products** — admin marks products as featured with custom ordering
- Drag & drop **reordering** within categories
- Input validation middleware
- WebSocket events on changes
- Products populated with topping details on read

### Topping Groups (Customizations)
- **Hierarchical structure**: Group → Options + SubGroups → SubGroup Options
- Each group: name, basePrice, isMultipleChoice (radio vs. checkbox), isRequired
- Each option: name, price, active toggle
- **SubGroups**: Nested level for complex customizations (e.g., "Pizza Size" → "Adicionales de Pizza Grande")
- Individual option toggle endpoint (`PATCH`)
- WebSocket events on changes

### Combo Groups
- Combo meal definitions with subgroups
- Similar structure to toppings but for fixed-price meal combos
- Soft delete (active=false)
- WebSocket events

### Frontend Menu Features
- `FilterableMenu.jsx` — Category tabs with smooth scroll, search
- `Productcard.jsx` — Product card with image, price, add-to-cart
- `ProductToppingSelector.jsx` / `ProductToppingsSelector.jsx` — Multi-level topping selection UI
- `FeaturedProducts.jsx` — Featured products carousel
- `MenuSkeletons.jsx` — Loading skeleton screens
- `OptimizedImage.jsx` — Lazy loaded images with IntersectionObserver

---

## 5. Order System

**Who uses it:** Customers (create), admins (manage), kitchen (prepare)  
**Backend:** `Routes/orders.js` (1195 lines — largest route file)  
**Frontend:** `Components/ModernOrdersDashboard.jsx` (1470 lines), `Components/OrderTracker.jsx` (726 lines), `Components/MyOrders.jsx`, `Components/CartSummary.jsx` (1738 lines), `Components/CartBar.jsx`, `Components/OrderConfirmationModal.jsx`

### Order Types
- **In-site (Mesa)**: Dine-in at a table, may include table number
- **Takeaway (Para llevar)**: Customer picks up
- **Delivery (Domicilio)**: Delivery to address with zone-based pricing

### Order Channels
1. **WhatsApp Flow**: Order → Builds formatted WhatsApp message → Redirects to WhatsApp
   - Status: pending → confirmed → preparing → ready → completed
2. **In-App Flow**: Order → Payment pending → Payment uploaded → Payment confirmed → Preparing → Ready → Completed/Delivered
   - Full payment proof workflow
   - Status: pending_payment → payment_uploaded → payment_confirmed → preparing → ready → completed/delivered

### Order Creation
- **Server-side price validation**: Re-calculates prices server-side, allows 5% tolerance (non-blocking)
- **Subscription check**: Blocks orders if business subscription is suspended
- **Auto-sequential order numbers**: Per-business, per-day numbering (resets daily)
- **Customer auto-creation**: Creates/updates customer record from phone number
- **Coupon validation & application**: Validates and applies discount coupons at order time
- **Delivery data**: Zone, fee, address, coordinates embedded in order
- **Customer notes**: Free-text field per order
- **Item snapshot**: Full product details + toppings saved at time of order (price immutability)

### Order Tracking (Customer)
- **Public endpoint**: Track order by orderId + customerToken (no auth needed)
- **Real-time updates**: Socket.IO room per order for instant status changes
- **Visual step tracker**: Shows order progress through status pipeline
- **Payment upload inline**: Upload payment proof directly from tracker
- **Push notification opt-in**: Customer can enable push from tracker

### Order Management (Admin)
- **ModernOrdersDashboard**: Grid/list view, search, status filtering
- Update order status through the pipeline
- View order details (items, toppings, customer info, payment proof)
- **Send to kitchen** action — marks order for kitchen display
- Delete orders
- **Audio notification** for new orders + push notification
- **Completed orders** section with summary
- View/confirm/reject payment proofs

### My Orders (Customer)
- View active and completed orders by phone number
- Real-time updates via Socket.IO
- Navigate to order tracker from order list

### Cart System (Frontend)
- `useCart.js` hook — Add/remove/update quantity, session persistence
- `CartSummary.jsx` (1738 lines) — Full checkout flow:
  - Order type selection (in-site/takeaway/delivery)
  - Table number input (for in-site or QR mode)
  - Delivery address with coverage check
  - Payment method selection
  - Coupon application
  - Delivery fee calculation
  - Customer info (name, phone)
  - Order notes
  - Business closed detection
- `CartBar.jsx` — Floating cart button with item count + total
- `FlyToCart.jsx` — Animation of product "flying" into cart
- `CouponInput.jsx` — Coupon code input with validation
- `OrderTypeSelector.jsx` — Visual order type picker
- `OrderConfirmationModal.jsx` — Post-order success modal with tracking link

---

## 6. Payment System

**Who uses it:** Customers (upload proof), admins (confirm/reject)  
**Backend:** `Routes/orders.js` (payment-proof, confirm-payment, reject-payment endpoints)  
**Frontend:** `Components/PaymentUpload.jsx`, `Components/Admin/PaymentConfig.jsx`

### Payment Flow (In-App Orders)
1. Customer places order → Status: `pending_payment`
2. Customer sees business payment info (Nequi number, Daviplata number, bank details)
3. Customer uploads payment proof (photo of transfer receipt) → Status: `payment_uploaded`
4. Admin gets notified (push + socket) and reviews proof
5. Admin confirms → Status: `payment_confirmed` → order moves to preparation
6. Admin rejects → Status: `payment_rejected` → customer gets push notification to resubmit

### Payment Proof Upload
- Multer with 10MB limit
- Supports HEIC/HEIF format (iPhone photos)
- Image stored in DigitalOcean Spaces
- Customer identified by customerToken (no login required)

### Payment Methods Configuration (Admin)
- Nequi: phone number
- Daviplata: phone number
- Bank Transfer: account number, bank name, account type, holder name
- Cash on delivery (for delivery orders)
- Per-ordering-mode configuration

---

## 7. Delivery Zones & Geolocation

**Who uses it:** Business admins (configure), customers (check coverage)  
**Backend:** `Routes/deliveryZones.js` (754 lines), `services/deliveryZoneService.js` (343 lines), `utils/geocoding.js`, `utils/geospatial.js`  
**Frontend:** `Components/DeliveryZoneManager.jsx`, `Components/DeliveryCoverageChecker.jsx`

### Zone Types
- **Polygon zones**: Drawn on map (array of lat/lng coordinates)
- **Radius zones**: Circle around center point (center + radius in km)

### Pricing Modes (per zone)
- **Fixed fee**: Same delivery charge for entire zone
- **Distance-based**: Price per kilometer from business location
- **Tiered**: Distance brackets with different prices (e.g., 0-2km: $3,000; 2-5km: $5,000)

### Zone Features
- Minimum order amount per zone
- Free delivery threshold (orders above X get free delivery)
- Estimated delivery time (configurable per zone)
- Schedule per zone (different hours than business hours)
- Priority ordering (which zone applies when overlapping)
- Active/inactive toggle

### Geocoding (Address ↔ Coordinates)
- **Forward geocoding**: Address → coordinates (via external API with caching)
- **Reverse geocoding**: Coordinates → address
- Country-scoped to Colombia (`CO`)
- Results cached to reduce API calls

### Coverage Check (Public)
- Customer enters address or uses GPS
- System geocodes address → finds matching zone → returns fee, min order, estimated time
- Falls back to GPS-based location detection
- Integrated into cart checkout flow

### Delivery Validation
- Validates full delivery order: coverage + minimum order + pricing calculation
- Returns detailed zone info for order creation

### Frontend Map Integration
- Leaflet.js maps (`react-leaflet`)
- Visual zone drawing (polygon/circle)
- Customer sees zones on interactive map
- Address search with autocomplete

---

## 8. Customer Management

**Who uses it:** Business admins  
**Backend:** `Routes/customers.js` (425 lines), `Models/Customer.js`  
**Frontend:** `Components/CustomersManager.jsx`

### Customer Records
- Auto-created when orders are placed (phone number as identifier)
- Fields: name, phone, email, address, notes, status (active/inactive/vip)
- Aggregated stats: totalOrders, totalSpent, lastOrderDate, averageOrderValue

### Customer Dashboard (Admin)
- List all customers with search
- Filter by status: active, inactive, VIP
- Sort by: name, totalOrders, totalSpent, lastOrderDate
- **Dashboard stats**: Total customers, VIP count, total revenue, average orders per customer
- View individual customer order history (active + completed)

### Address Management
- Customers can update their delivery address (public endpoint, rate-limited)
- Address stored for future orders

---

## 9. Favorites & Order History

**Who uses it:** Customers  
**Backend:** `Routes/favorites.js` (204 lines), `Models/Favorite.js`  
**Frontend:** `Components/FavoritesModal.jsx`, `Components/OrderHistoryModal.jsx`

### Favorites
- Customer saves product configurations (product + selected toppings + options) as favorites
- Identified by phone number + businessId
- Quick re-order: Add favorite directly to cart with all saved options
- Delete favorites
- Usage tracking: Records when a favorite is added to cart
- Feature can be disabled by admin via business settings

### Order History
- View past orders by phone number
- Re-order from history (adds items to cart)
- Feature can be disabled by admin via business settings

---

## 10. Reviews & Ratings

**Who uses it:** Customers (submit), admins (manage)  
**Backend:** `Routes/reviews.js` (580 lines), `Models/Review.js`  
**Frontend:** `Components/ReviewModal.jsx`, `Components/ReviewsSheet.jsx`, `Components/Admin/AdminReviews.jsx`, `Components/PendingReviewCard.jsx`

### Review Submission (Customer)
- Rate 1–5 stars
- Thumbs up/down quick feedback
- Free-text comment
- Linked to a completed order (one review per order)
- Phone verification against order record
- 30-day review window after order completion

### Review Display
- `ReviewsSheet.jsx`: Customer-facing reviews list
- Star breakdown display (5-star, 4-star, etc.)
- Overall average rating

### Pending Review Detection
- System detects most recent unreviewed order per customer
- `PendingReviewCard.jsx`: Gentle nudge UI for customers to leave a review

### Review Management (Admin)
- View all reviews with star/thumbs breakdown
- **Reply to reviews**: Admin can post a response
- **Hide reviews** (moderation): Remove inappropriate reviews from public display
- Auto-recalculates business `reviewStats` on every review change (average, count, breakdown)

### Favorite Product Detection
- Products appearing in 4-5 star reviews with ≥2 mentions are flagged as "favorite products"
- Used for business insights

### Real-time
- WebSocket notification to admin when new review is submitted

---

## 11. Tables & QR Codes

**Who uses it:** Business admins (manage), customers (scan)  
**Backend:** `Routes/tables.js` (292 lines)  
**Frontend:** `Components/TableSettings.jsx`, `Components/TableValidator.jsx`

### Table Management
- CRUD for restaurant tables
- Each table: tableNumber, tableName, notes
- **QR code URL generation**: `/{slug}/mesa/{tableNumber}`

### QR Code Flow
- Customer scans QR → Opens business menu with table pre-selected
- Table validation endpoint (verify table exists before showing menu)
- Order type auto-set to "inSite" with table number
- Option to switch to "takeaway" from QR flow

### Frontend
- `tableUtils.js` — Table number parsing from URL

---

## 12. Push Notifications

**Who uses it:** Admin devices (new orders), customer devices (order status)  
**Backend:** `Routes/push.js`, `services/pushService.js`  
**Frontend:** `Components/PushNotificationToggle.jsx`, `utils/pushNotifications.js`

### Technology
- Web Push API with VAPID keys
- Service worker registration for background notifications

### Admin Notifications
- New order received
- Payment proof uploaded by customer
- New review submitted

### Customer Notifications
- Order status changes (payment confirmed, preparing, ready, delivered)
- Payment rejected (needs resubmission)

### Subscription Management
- Subscribe/unsubscribe endpoints (rate-limited)
- Multiple device support per admin/customer
- Auto-cleanup of expired push subscriptions (410/404 responses)

### iOS Support
- Detection of iOS devices and installed PWA state
- Special handling since iOS has limited push support

---

## 13. Kitchen Display

**Who uses it:** Kitchen staff  
**Backend:** Uses existing order endpoints  
**Frontend:** `Components/ModernKitchen.jsx` (791 lines), `Pages/Kitchen.jsx`

### Features
- **Dedicated full-screen kitchen view** at `/{businessId}/kitchen`
- Shows orders in preparation pipeline
- Order cards with: items, toppings, order type (table/takeaway/delivery), customer info
- **Time elapsed** per order (visual urgency indicator)
- Order type indicators with icons (Mesa, Para llevar, Delivery)
- Status progression buttons (mark as preparing → ready → completed)
- **Real-time via Socket.IO** — new orders appear instantly, status changes reflect immediately
- **Socket connection indicator** (connected/disconnected)
- Auto-refresh fallback polling
- Current time/date display
- Protected route (requires admin auth)

---

## 14. WhatsApp Integration

**Who uses it:** Customers (order via WhatsApp), admins (configure)  
**Backend:** `Routes/whatsappTemplates.js`  
**Frontend:** `Components/WhatsAppCustomizer.jsx`

### WhatsApp Ordering
- When ordering mode is "whatsapp" or "both", order is formatted as a WhatsApp message
- Message sent to business WhatsApp number via `wa.me` deep link
- `orderUtils.js`: `createWhatsAppMessage()` utility formats the full order

### Customizable Templates
- Admins configure what sections appear in the WhatsApp message
- **Modules** (toggleable): Order summary, item details, toppings, prices, customer info, delivery info, order notes
- Custom additional message field
- Reset to default template option
- Template preview in customizer UI

### Technical Note
- Uses native MongoDB driver (not Mongoose) to avoid virtual/id conflicts with template modules

---

## 15. AI-Powered Tools

**Who uses it:** Business admins  
**Backend:** `Routes/aiTools.js`, `Routes/helpChat.js` (243 lines)  
**Frontend:** `Components/Admin/FloatingHelpChat.jsx`, `Components/Admin/FloatingHelpButton.jsx`

### Product Name Generator
- Admin describes a product → AI generates 5 creative menu item names
- Takes into account: description, category, business type
- Powered by Groq API (free tier)

### Review Response Generator
- AI generates personalized admin replies to customer reviews
- Context-aware: uses rating, comment, business name
- Tone matches rating (empathetic for low, grateful for high)

### In-App Help Chat (FloatingHelpChat)
- AI-powered assistant embedded in admin panel
- **Strictly scoped** to MenuBy platform questions only (rejects off-topic queries)
- Personalized with business name and URL
- Conversation history: in-memory with 30-minute TTL, max 10 messages
- Fallback: Directs to WhatsApp support (3138178003)
- Floating button in bottom corner of admin panel

### AI Infrastructure
- Groq API with **model fallback chain**: llama-3.3-70b → llama-3.1-8b → gpt-oss-120b
- If all models fail, returns graceful error message
- In-memory conversation cache per business

---

## 16. Subscription & Billing

**Who uses it:** Business admins, SuperAdmin  
**Backend:** `Routes/subscriptions.js` (530 lines), `Routes/adminSubscriptions.js`, `Routes/paymentRequests.js` (758 lines), `Models/Subscription.js`  
**Frontend:** `Components/SubscriptionStatus.jsx`, `Components/SubscriptionDetailsCard.jsx`, `Components/SubscriptionPaymentCard.jsx`, `Pages/SubscriptionPayment.jsx`, `Components/Admin/SubscriptionManagementWrapper.jsx`

### Plan Types
- **Monthly** subscription
- **Annual** subscription

### Status Lifecycle
- `active` → Business fully operational
- `grace` → 1 day after expiry, business still works but sees warnings
- `suspended` → Cannot receive new orders, must renew

### Trial Period
- 7-day trial on registration (configurable via `SUBSCRIPTION_TRIAL_DAYS`)
- 1-day grace period (configurable via `SUBSCRIPTION_GRACE_DAYS`)
- Marked as `isTrialPeriod: true`

### Admin Self-Service
- View current subscription status, plan, days remaining
- Grace period countdown warning
- Payment request submission for renewal

### Payment Request Flow (Manual Billing)
1. Admin initiates payment (selects months, payment method)
2. Admin uploads payment proof (bank transfer, Nequi, Daviplata)
3. SuperAdmin reviews request in dashboard
4. SuperAdmin approves → Subscription extended by N months
5. SuperAdmin rejects → Admin notified, can resubmit
- Prevents duplicate pending requests

### Subscription Enforcement
- `checkSubscription.js` middleware
- Suspended businesses: order creation blocked, menu shows warning
- Grace period: everything works, warning banners shown

### SuperAdmin Subscription Dashboard
- Overview KPIs: MRR, active count, grace count, suspended count, churn rate
- Create/update/list all subscriptions
- Manual subscription adjustments

---

## 17. Coupons (Subscription)

**Who uses it:** SuperAdmin (create), business admins (redeem)  
**Backend:** `Routes/coupons.js`, `Models/Coupon.js`  
**Frontend:** `Components/CouponsManager.jsx`

> **Note:** These are **subscription coupons**, not order discount coupons.

### Features
- SuperAdmin creates coupons: code, months of subscription, max uses, expiry date
- Admin enters coupon code → Subscription extended by N months
- **Public validation endpoint** (for sharing/marketing)
- Usage tracking per business (prevents same business using twice)
- **Shareable URL** generation for marketing campaigns
- `canBeUsed` validation method on model (checks expiry, max uses, active status)

---

## 18. Business Catalog (Public Marketplace)

**Who uses it:** General public (discover restaurants)  
**Backend:** `Routes/businesses.js` (611 lines)  
**Frontend:** `Pages/Catalog/MenuByCatalog.jsx` (720 lines), `Pages/Catalog/RestaurantDetail.jsx`, `Components/Catalog/RestaurantCard.jsx`, `Components/Catalog/AdvancedSearch.jsx`, `Components/Catalog/CatalogNavbar.jsx`

### Public Restaurant Discovery
- Browse all active businesses on MenuBy
- **Search**: By name, by location, by products
- **Filters**: Open now, free delivery, business type
- **Sort**: By popularity, rating, distance, price
- **Location-based**: Uses browser geolocation to show nearby restaurants
- **Delivery coverage**: Checks user coordinates against all business delivery zones

### Featured Sections
- **Trending**: Most popular restaurants
- **Free delivery**: Restaurants offering free delivery
- **Low price**: Budget-friendly options
- **Best rated**: Top-rated restaurants

### Batch Data Optimization
- Single API call returns categories, product count, min price, top products, popularity score per restaurant
- Eliminates N+1 query problem

### Restaurant Detail Page
- Full business profile with menu preview
- Reviews, hours, location on map
- Direct link to order

### Catalog Features (Frontend)
- `RestaurantCard.jsx` — Card with logo, cover, rating, delivery info, open status
- `BannerCarousel.jsx` — Promotional banners at top of catalog
- `AdvancedSearch.jsx` — Multi-criteria search interface
- `CatalogNavbar.jsx` — Navigation for catalog pages
- **Recent restaurants**: Tracked in localStorage
- **Infinite scroll**: Load more restaurants as user scrolls
- **Search suggestions**: Auto-suggest as user types
- **Favorite restaurants**: Customer can favorite restaurants in catalog (localStorage)

---

## 19. Banners & Promotions

**Who uses it:** SuperAdmin (create/approve), business admins (request)  
**Backend:** `Routes/banners.js` (658 lines)  
**Frontend:** `Components/Catalog/BannerCarousel.jsx`, `Components/Catalog/BannerUpload.jsx`, `Components/Catalog/BannerApproval.jsx`, `Components/Catalog/SuperAdminBannerManagement.jsx`, `Components/Catalog/RestaurantBannerView.jsx`

### Features
- **SuperAdmin creates banners** for specific businesses or platform-wide
- **Admin requests banners** for their own business
- **Approval workflow**: PENDING → APPROVED
- Active banners shown in catalog carousel (max 5, sorted by priority)
- Image upload via multer (5MB limit)
- Banner fields: title, description, image, link, business association, priority

---

## 20. Announcements (Platform-Wide)

**Who uses it:** SuperAdmin (create), business admins (view)  
**Backend:** `Routes/announcements.js` (291 lines)  
**Frontend:** `Components/Admin/AnnouncementPopup.jsx`

### Features
- SuperAdmin creates platform-wide announcements (e.g., maintenance, new features, policy changes)
- Priority levels
- Image support
- **Read tracking**: Records which businesses have seen each announcement, with timestamp
- **Unread detection**: Admin dashboard shows popup for unread announcements
- **SuperAdmin analytics**: See count and percentage of businesses who have read each announcement

---

## 21. SuperAdmin Platform Management

**Who uses it:** Platform operator (SuperAdmin)  
**Backend:** `Routes/superadmin.js`, `Routes/adminSubscriptions.js`  
**Frontend:** `Pages/SuperAdmin/SuperAdminDashboard.jsx`, `Pages/SuperAdmin/BusinessTable.jsx`, `Pages/SuperAdmin/CreateBusinessModal.jsx`, `Pages/SuperAdmin/OrderManagement.jsx`, `Pages/SuperAdmin/PaymentRequestsReview.jsx`, `Pages/SuperAdmin/PaymentsDashboard.jsx`

### Business Management
- List all businesses with status indicators
- Create new business (sets `mustChangePassword` flag for admin)
- Activate / deactivate businesses
- Delete businesses
- View any business's admin panel (SuperAdmin can "impersonate")

### Cross-Business Order View
- View ALL orders across ALL businesses
- Filter by business, search by customer name
- Change order status from any business
- Move orders between active ↔ completed collections

### Payment Requests Review
- Dashboard of all pending payment requests
- Approve/reject with notes
- On approval: auto-extends subscription

### Payments Dashboard
- Financial overview: MRR, total revenue, transaction history
- Subscription status overview: active, grace, suspended, churn metrics

### SuperAdmin Auth Pages
- `LoginSuperAdmin.jsx` — Login page
- `ChangePasswordSuperAdmin.jsx` — Password change
- `ForgotPasswordSuperAdmin.jsx` / `ResetPasswordSuperAdmin.jsx` — Password recovery

---

## 22. Real-Time Communication

**Who uses it:** All users (transparent)  
**Backend:** `services/socketService.js` (277 lines), `services/eventService.js`, `Routes/events.js`

### Socket.IO (WebSocket)
- **Business-scoped rooms**: JWT authentication, tenant guard
- SuperAdmin channel for cross-business monitoring
- **Customer order tracking rooms**: Per-order, token-based (no auth)
- Slug cache for efficient broadcasting

### Socket Events
| Event | Direction | Purpose |
|-------|-----------|---------|
| `order_created` | Server → Client | New order notification |
| `order_updated` | Server → Client | Status change |
| `order_deleted` | Server → Client | Order removed |
| `payment_proof_uploaded` | Server → Client | Customer uploaded proof |
| `payment_confirmed` | Server → Client | Admin confirmed payment |
| `payment_rejected` | Server → Client | Admin rejected payment |
| `products_update` | Server → Client | Product catalog changed |
| `categories_update` | Server → Client | Categories changed |
| `topping_groups_update` | Server → Client | Toppings changed |
| `business_status_update` | Server → Client | Open/closed toggled |
| `menu_status_update` | Server → Client | Menu active/paused |
| `business_hours_update` | Server → Client | Hours changed |

### Server-Sent Events (SSE)
- Alternative real-time channel for admin dashboard
- Business-scoped (tenant isolated)
- Keepalive every 30 seconds
- Auto-cleanup on disconnect
- `DebugSSE.jsx` page for debugging

### Frontend Hooks
- `useBusinessSocket.js` — Manages socket connection per business
- `useBusinessStatus.js` — Real-time open/closed status
- `useOrderTracking.js` — Order-specific real-time tracking

---

## 23. Image Management

**Who uses it:** All uploads (products, logos, banners, payment proofs)  
**Backend:** `Routes/upload.js`, `services/imageUploadService.js`

### Upload Pipeline
1. Image received via multer middleware
2. Compression with `sharp` library → converts to WebP format
3. Upload to **DigitalOcean Spaces** (S3-compatible object storage)
4. Return public URL

### Configuration
- Max file size: 5MB (general), 10MB (payment proofs), 25MB (payment proofs client)
- Accepted formats: JPEG, PNG, WebP, HEIC, HEIF (iPhone)
- Organized by folders: `products/`, `banners/`, `proofs/`, `order-proofs/`, `announcements/`, `logos/`
- Delete endpoint for cleanup

### Frontend
- `Components/Admin/ImageUploader.jsx` — Reusable image upload component
- `Components/OptimizedImage.jsx` — Lazy loading with IntersectionObserver
- Image preview on upload

---

## 24. Landing Page & Marketing

**Who uses it:** Prospective business owners  
**Frontend:** `Pages/Landing/Home.jsx` (851 lines), `Pages/Landing/Features.jsx`, `Pages/Landing/Pricing.jsx` (303 lines), `Pages/Landing/Demo.jsx`, `Pages/Landing/Contact.jsx`, `Pages/Landing/Login.jsx`, `Pages/Landing/Register.jsx`, `Pages/LeadCapturePage.jsx`

### Landing Pages
- **Home**: Hero with phone mockup, animated counters, testimonials, feature highlights
- **Features**: Detailed feature breakdown with icons and descriptions
- **Pricing**: Monthly/annual toggle, feature list, benefit cards, testimonials
- **Demo**: Platform demonstration
- **Contact**: Contact form / support information
- **Login/Register**: Business admin account creation

### Lead Capture (404 → Opportunity)
- When someone visits a non-existent business URL (e.g., `/mi-restaurante`)
- Instead of 404, shows a lead capture page:
  - "¿Quieres este link para tu negocio?" (Want this link for your business?)
  - CTA to register with that slug
  - Business name auto-formatted from slug
  - Link to main MenuBy homepage

### Marketing Components
- `Components/Landing/CTA.jsx` — Call-to-action sections
- Animated counters, scroll reveals, parallax effects
- Mobile-responsive design

---

## 25. Frontend Architecture & UX

**Stack:** React 18 + Vite + Tailwind CSS + Framer Motion

### Project Structure
```
Frontend/src/
├── Pages/          (12+ page components)
├── Components/     (60+ components)
│   ├── Admin/      (19 admin-specific components)
│   ├── Catalog/    (8 catalog components)
│   ├── Landing/    (landing page components)
│   └── SuperAdmin/ (superadmin components)
├── Context/        (Auth, Business, Theme contexts)
├── hooks/          (15 custom hooks)
├── services/       (api, auth, socket, superadminApi)
├── utils/          (9 utility files)
└── Layouts/        (layout wrappers)
```

### Key UX Features
- **Lazy loading / Code splitting**: Major components loaded via `React.lazy()` + `Suspense`
- **Skeleton screens**: Loading states for menu, products, catalog
- **Splash screen**: Branded loading screen with business logo on first load
- **Pull to refresh**: `PullToRefresh.jsx` component
- **Fly to cart animation**: Product visually flies into cart
- **Confetti burst**: Celebration animation (e.g., on order completion)
- **Business closed overlay**: Full-screen overlay when business is closed
- **Restaurant closed modal**: Warning when trying to order from closed business

### Custom Hooks
| Hook | Purpose |
|------|---------|
| `useAdminAuth` | Admin authentication state & token refresh |
| `useAdminData` | Admin panel data fetching |
| `useBusinessSocket` | Socket.IO connection management |
| `useBusinessStatus` | Real-time open/closed status |
| `useCart` | Cart state management |
| `useCustomerData` | Customer information management |
| `useFormValidation` | Form validation logic |
| `useMemorizedData` | Memoized data caching |
| `useMenuData` | Menu products/categories fetching |
| `useOnboarding` | Onboarding state & level progression |
| `useOrderTracking` | Order tracking with Socket.IO |
| `useProductHandlers` | Product interaction handlers |
| `useSEO` | Dynamic meta tags / SEO management |
| `useSubscriptionData` | Subscription status fetching |
| `useUserLocation` | Browser geolocation |

### Admin Panel Layout
- `ModernAdminSidebar.jsx` — Responsive sidebar with section grouping
- `Components/Admin/AdminHeader.jsx` — Top bar with business info
- `Components/Admin/AdminDashboard.jsx` — Dashboard home with stats
- `Components/Admin/AdminTabWrapper.jsx` — Tab content wrapper
- `Components/Admin/AdminSectionErrorBoundary.jsx` — Per-section error handling
- `Components/Admin/AdminToasts.jsx` — Toast notification system
- `Components/Admin/ConfirmationModal.jsx` / `DeleteConfirmationModal.jsx` — Reusable dialogs
- `Components/Admin/OrderNotificationBanner.jsx` — New order alert banner

### Other UI Components
- `MultiSessionWarning.jsx` — Warning when admin is logged in on multiple devices
- `AccountManagementModal.jsx` — Account settings modal
- `StoreStatusToggle.jsx` — Quick open/close toggle
- `BusinessLogo.jsx` — Logo display component
- `EmptyStates.jsx` — Empty state illustrations
- `ErrorBoundary.jsx` — Global error boundary
- `LoadingSpinner.jsx` — Reusable spinner
- `DynamicManifest.jsx` — Dynamic PWA manifest per business

### SEO & PWA
- `useSEO` hook for dynamic page titles and meta tags
- `DynamicManifest.jsx` — Generates per-business PWA manifest (name, colors, icons)
- Service worker for push notifications
- Mobile-optimized (mobile-first design approach)

---

## 26. Security & Infrastructure

### Authentication Security
- **JWT tokens**: Short-lived access tokens + long-lived refresh tokens
- **bcrypt** password hashing
- **Rate limiting** on all sensitive endpoints:
  - Login: 5/15min
  - Register: 3/hour
  - Token refresh: 20/15min
  - Google auth: 10/15min
  - Customer address update: rate-limited
  - Push subscriptions: rate-limited

### Multi-Tenant Isolation
- `tenantAuth.js` middleware forces `businessId` from JWT token (not from request)
- Non-SuperAdmin users can only access their own business data
- All queries scoped to `businessId`

### Subscription Enforcement
- `checkSubscription.js` middleware blocks operations for suspended businesses

### Input Validation
- `validators.js` / `utils/businessValidator.js` — Input sanitization
- Product/category input validation middleware
- MongoDB ObjectId validation

### Infrastructure
- **Docker**: `Dockerfile` + `docker-compose.yml` for containerized deployment
- **DigitalOcean**: VPS deployment with Spaces for object storage
- **Nginx**: Reverse proxy with SSL configuration scripts
- **Health endpoint**: `/health` returns server status
- **Logging**: Custom `logger.js` utility (backend + frontend)

### Deployment Scripts
- Multiple deployment scripts for various environments:
  - `deploy-production.sh`, `deploy-backend-only.sh`, `deploy-direct-to-server.sh`
  - Windows PowerShell: `deploy-backend-windows.ps1`, `deploy-final.ps1`, etc.
  - Vercel: `deploy-to-vercel.bat` (frontend)
  - Keep-alive: `keep-alive.bat` (prevents idle shutdown)

---

## 27. Automated Background Tasks

**Backend:** `services/orderCleanupCron.js`, `services/subscriptionCron.js`

### Order Cleanup (Runs every 10 minutes)
- **Auto-cancel stale orders**:
  - `pending_payment` older than 1 hour → cancelled
  - `pending` older than 30 minutes → cancelled
  - `payment_uploaded` older than 24 hours → cancelled
- **Archive cancelled orders**: Moves to completed collection after 2 hours
- Prevents order queue pollution

### Subscription Reminders (Runs daily)
- Push notifications at **7, 3, 1, 0 days** before subscription expiry
- Grace period notification
- Suspension notification when grace expires
- Targets admin push subscriptions per business

---

## 28. Reporting & Analytics

**Who uses it:** Business admins  
**Backend:** `Routes/orders.js` (daily-closing endpoint)  
**Frontend:** `Components/DailyReportPDF.js` (403 lines), `Components/CompletedOrdersSummary.jsx`, `Components/EnhancedCompletedOrders.jsx`, `Components/Admin/AdminDashboard.jsx`

### Daily Closing Report
- **Generates comprehensive sales report**:
  - Total orders count
  - Total sales amount
  - Breakdown by order type (in-site, takeaway, delivery)
  - Top selling items (by quantity)
  - Revenue per category
- Marks reported orders (prevents double-counting)

### PDF Export
- `DailyReportPDF.js` — Generates downloadable PDF using jsPDF + autoTable
- Includes business logo, formatted tables, COP currency
- Professional layout with headers, sections, totals

### Admin Dashboard Analytics
- `AdminDashboard.jsx` — Overview stats:
  - Today's orders & revenue
  - Active orders count
  - Customer growth metrics
- Real-time updates via Socket.IO

### Customer Analytics
- Per-customer: total orders, total spent, average order value
- Business-wide: total customers, VIP count, revenue totals

### Review Analytics
- Average rating, rating breakdown (5-star through 1-star)
- Thumbs up/down feedback percentages
- Favorite product detection from high-rated reviews

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Backend route files | 29 |
| Backend models | 23 |
| Backend services | 7 |
| Backend middleware | 5 |
| Backend utilities | 12 |
| Frontend pages | 12+ |
| Frontend components | 60+ |
| Frontend hooks | 15 |
| Frontend utilities | 9 |
| Total feature categories | 28 |
| Socket.IO events | 12 |
| Business types supported | 8 |
| Onboarding levels | 6 |
| Order statuses | 11 |
| AI models (fallback chain) | 3 |

---

*Report generated from complete analysis of all backend routes, models, services, middleware, utilities, frontend pages, components, hooks, and utilities in the SisRestaurantes/MenuBy codebase.*
