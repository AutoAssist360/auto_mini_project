# Comprehensive Audit: `user_dashboard` & `technician_dashboard`

> Generated from a line-by-line read of **every** source file in both apps.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [User Dashboard Audit](#2-user-dashboard-audit)
   - [Routes](#21-routes)
   - [Auth Flow](#22-auth-flow)
   - [Lazy Loading](#23-lazy-loading)
   - [Error Boundary](#24-error-boundary)
   - [Dark Mode](#25-dark-mode)
   - [Maps / Location](#26-maps--location)
   - [File Uploads](#27-file-uploads)
   - [Payments](#28-payments)
   - [PDF Generation](#29-pdf-generation)
   - [Messaging](#210-messaging)
   - [Notifications](#211-notifications)
   - [Skeleton Loaders](#212-skeleton-loaders)
   - [Toasts](#213-toasts)
   - [Breadcrumbs](#214-breadcrumbs)
   - [Mobile Nav](#215-mobile-nav)
   - [Charts](#216-charts)
   - [Delete Account](#217-delete-account)
   - [Dashboard Stats](#218-dashboard-stats)
   - [Live Tracking](#219-live-tracking)
   - [Request Flow](#220-request-flow)
3. [Technician Dashboard Audit](#3-technician-dashboard-audit)
   - [Routes](#31-routes)
   - [Auth Flow](#32-auth-flow)
   - [Lazy Loading](#33-lazy-loading)
   - [Error Boundary](#34-error-boundary)
   - [Dark Mode](#35-dark-mode)
   - [Request Discovery](#36-request-discovery)
   - [Maps / Location](#37-maps--location)
   - [Live Location Update](#38-live-location-update)
   - [Messaging](#39-messaging)
   - [Offers](#310-offers)
   - [Jobs](#311-jobs)
   - [Earnings / Charts](#312-earnings--charts)
   - [Notifications](#313-notifications)
   - [Skeleton Loaders](#314-skeleton-loaders)
   - [Toasts](#315-toasts)
   - [Breadcrumbs](#316-breadcrumbs)
   - [Mobile Nav](#317-mobile-nav)
   - [Delete Account](#318-delete-account)
   - [Dashboard Stats](#319-dashboard-stats)
4. [Shared Components Comparison](#4-shared-components-comparison)
5. [Bugs & Issues](#5-bugs--issues)
6. [Missing Features](#6-missing-features)
7. [Recommendations](#7-recommendations)

---

## 1. Architecture Overview

| Aspect | Details |
|---|---|
| **Framework** | React 18+ with hooks + one class component (ErrorBoundary) |
| **Router** | React Router v6 (Routes/Route/Navigate) |
| **State** | Redux Toolkit — `configureStore` + single `auth` slice per app |
| **Styling** | Tailwind CSS v4 (`@import "tailwindcss"` + `@custom-variant dark`) |
| **Build** | Vite — env vars via `import.meta.env.VITE_*` |
| **Real-time** | Socket.io-client for chat + live tracking |
| **Maps** | Leaflet + react-leaflet + OpenStreetMap (Nominatim geocoding) |
| **PDF** | jsPDF + jspdf-autotable |
| **Payments** | Stripe (checkout redirect) + manual payment forms |
| **Charts** | recharts (technician only) |
| **Auth** | httpOnly cookie-based — no tokens stored in JS |

---

## 2. User Dashboard Audit

**File count:** 36 source files under `user_dashboard/src/`

### 2.1 Routes

Defined in `user_dashboard/src/App.jsx` (lines 96–226):

| Path | Component | Auth |
|---|---|---|
| `/` | Redirect → `/auth/user/signin` | No |
| `/auth/user/signin` | `UserSignInPage` | No |
| `/auth/user/signup` | `UserSignUpPage` | No |
| `/auth/user/forgot-password` | `UserForgotPasswordPage` | No |
| `/auth/user/reset-password` | `UserResetPasswordPage` | No |
| `/dashboard` | `UserDashboardPage` | **Yes** |
| `/requests` | `UserRequestsPage` | **Yes** |
| `/requests/new` | `UserNewRequestPage` | **Yes** |
| `/requests/:requestId` | `UserRequestDetailPage` | **Yes** |
| `/orders` | `UserOrdersPage` | **Yes** |
| `/orders/:orderId` | `UserOrderDetailPage` | **Yes** |
| `/invoices` | `UserInvoicesPage` | **Yes** |
| `/invoices/:invoiceId` | `UserInvoiceDetailPage` | **Yes** |
| `/jobs` | `UserJobsPage` | **Yes** |
| `/jobs/:jobId` | `UserJobDetailPage` | **Yes** |
| `/reviews` | `UserReviewsPage` | **Yes** |
| `/requests/:requestId/messages` | `UserMessagesPage` | **Yes** |
| `/profile` | `UserProfilePage` | **Yes** |
| `/vehicles` | `UserVehiclesPage` | **Yes** |
| `/notifications` | `UserNotificationsPage` | **Yes** |
| `*` | Redirect → `/auth/user/signin` | No |

**Total: 20 lazy routes** + 1 catch-all.

### 2.2 Auth Flow

**Session management** — `user_dashboard/src/App.jsx` lines 71–84:
- On mount, calls `getMyProfile()` (cookie auto-sent)
- Verifies `response.user.role === 'user'` — dispatches `setAuthUser` or `clearAuth`
- If access token expired, the API layer auto-calls `POST /auth/refresh` before retrying

**Sign In** — `user_dashboard/src/pages/UserSignInPage.jsx` lines 50–73:
- Calls `userSignIn(email, password)` → cookies set by backend
- Then `getMyProfile()` → verifies `role === 'user'`
- Client validation: email regex, password required
- Signup success message shown via `location.state`

**Sign Up** — `user_dashboard/src/pages/UserSignUpPage.jsx` lines 1–232:
- **Two-step flow**: form → 6-digit OTP verification
- Step 1: Name, email, phone (10 digits), password (8+ chars), confirm password
- Step 2: Calls `sendOtp(email)`, then `userSignUp(payload)` with the OTP
- 60-second resend cooldown timer
- Redirects to signin on success with state message

**Token Refresh** — `user_dashboard/src/lib/api.js` lines 70–90:
- Shared `refreshPromise` prevents concurrent refresh calls
- On 401 TOKEN_EXPIRED: auto-refresh then retry original request (once)
- Multi-base-URL strategy: tries normalized URL and with/without `/api` suffix

**Route Guard** — `user_dashboard/src/App.jsx` lines 39–45:
- `RequireAuth` checks `isAuthenticated` from Redux
- Returns `null` during `isInitializing` (prevents flash)
- Redirects to `/auth/user/signin` if not authenticated

### 2.3 Lazy Loading

All 20 page imports use `React.lazy()` — `user_dashboard/src/App.jsx` lines 7–27.

```jsx
const UserSignInPage = lazy(() => import('./pages/UserSignInPage'))
// ... 19 more lazy imports
```

Wrapped in `<Suspense fallback={<PageLoader />}>` at line 96, using `PageSkeleton` as the fallback.

**Verdict:** ✅ Fully implemented. Every page is code-split.

### 2.4 Error Boundary

`user_dashboard/src/ErrorBoundary.jsx` (67 lines):
- Class component with `getDerivedStateFromError` + `componentDidCatch`
- Renders "Try Again" button (resets error state) + "Reload Page" button (`window.location.reload()`)
- Full dark mode support
- Wraps the entire app tree in `main.jsx` line 10

**Verdict:** ✅ Implemented correctly.

### 2.5 Dark Mode

`user_dashboard/src/App.jsx` lines 49–59:
- **Storage key:** `qa-user-theme`
- **System preference:** `window.matchMedia('(prefers-color-scheme: dark)')` used as fallback
- **Toggle:** `document.documentElement.classList.toggle('dark', theme === 'dark')`
- **Tailwind:** `@custom-variant dark (&:where(.dark, .dark *))` in `index.css` line 8
- **Props:** `theme` and `onToggleTheme` passed to every page component
- Every page has a theme toggle button in the header

**Verdict:** ✅ Fully implemented with system preference detection.

### 2.6 Maps / Location

`user_dashboard/src/components/LocationPicker.jsx` (230 lines):
- Leaflet + react-leaflet + OpenStreetMap tiles
- **Click-to-place marker** on map
- **GPS geolocation** with accuracy, timeout, and error handling
- **Forward geocoding** (search): Nominatim with debounce (400ms), bounded to Nagpur area
- **Reverse geocoding**: on click / on GPS
- Default center: Nagpur `[21.1458, 79.0882]`
- `FlyToMarker` sub-component for smooth map transitions

**Used in:** `UserNewRequestPage.jsx` (breakdown location)

`user_dashboard/src/components/LiveTracker.jsx` (128 lines):
- Socket.io-based real-time technician location display
- Leaflet map showing technician marker
- Haversine distance calculation
- ETA estimation (default speed 30 km/h)

**Used in:** `UserJobDetailPage.jsx` (for assigned/in_progress jobs)

**Verdict:** ✅ Comprehensive map integration with search, GPS, and live tracking.

### 2.7 File Uploads

`user_dashboard/src/components/FileUploader.jsx` (158 lines):
- Drag-and-drop upload with XHR (`withCredentials: true`)
- Progress bar with percentage
- Single (`/uploads/single`) or multi-file (`/uploads/multiple`) support
- `FileGallery` sub-component: grid of uploaded files with image previews
- Delete button on hover (opacity transition)
- 10 MB per file limit (UI hint)
- Accepts images, PDFs, videos

**API functions** — `user_dashboard/src/lib/api.js` lines 388–419:
- `uploadFile`, `uploadFiles`, `getMyFiles`, `deleteFile`

**Verdict:** ✅ Fully implemented with progress tracking.

### 2.8 Payments

**Stripe checkout** — used in:
- `UserOrderDetailPage.jsx` lines 97–108: `createOrderCheckout(orderId)` → `window.location.href = data.url`
- `UserInvoiceDetailPage.jsx` lines 98–109: `createInvoiceCheckout(invoiceId)` → redirect to Stripe

**Manual payment** — used in:
- `UserOrderDetailPage.jsx` lines 110–128: form with method (upi/card/netbanking/cash) + transaction_id → `payOrder()`
- `UserInvoiceDetailPage.jsx` lines 111–129: same form → `payInvoice()`

**Verdict:** ✅ Dual payment: Stripe + manual. Both invoice and order payment flows exist.

### 2.9 PDF Generation

`user_dashboard/src/lib/generateInvoicePDF.js` (164 lines):
- jsPDF with autoTable plugin
- Branded header: "Quick Auto Assist" in emerald color
- Subtitle: "Vehicle Roadside Assistance"
- Large "INVOICE" label right-aligned
- Meta section: Invoice ID, issue date, payment status, method, transaction ID, customer/technician names
- Line items table: #, Type, Description, Qty, Unit Price, Total (striped theme)
- Totals: Subtotal, Tax, Total (emerald bold)
- Footer: "Thank you for choosing Quick Auto Assist!" + "computer-generated invoice" disclaimer
- Saves as `invoice-{shortId}.pdf`

**Used in:** `UserInvoiceDetailPage.jsx`, `UserJobDetailPage.jsx`

**Verdict:** ✅ Professional PDF output with branding.

### 2.10 Messaging

`user_dashboard/src/pages/UserMessagesPage.jsx` (195 lines):

**Transport:** HYBRID — Socket.io real-time + 30-second polling fallback

**Socket.io events:**
- `chat:join` (join room on connect)
- `chat:new_message` (receive messages, deduplication by `message_id`)
- `chat:typing` / `chat:stop_typing` (typing indicators with 2s timeout)

**Features:**
- Auto-scroll to newest message
- Auto-detects receiver ID from message history
- Enter to send (Shift+Enter for newline)
- Messages reversed for chronological display
- Connection via `io(SOCKET_URL, { withCredentials: true })`

**Verdict:** ✅ Real-time with polling fallback. Typing indicators work.

### 2.11 Notifications

`user_dashboard/src/pages/UserNotificationsPage.jsx` (135 lines):
- Paginated notification list (10 per page)
- Type icons: 📨 offer_received, ✅ offer_accepted, ❌ offer_rejected, 🔧 job_assigned, etc.
- **Mark read** (individual) / **Mark all read** / **Delete**
- **Deep-linking**: routes to `/jobs/{id}`, `/requests/{id}`, `/invoices/{id}`, `/orders/{id}` based on notification data
- Relative timestamps ("Just now", "5m ago", "2h ago", "3d ago")

**Note:** Different styling pattern than rest of app — uses sticky header + gray color scheme instead of slate card style.

**Verdict:** ✅ Full notifications with deep-linking. UI consistency issue noted.

### 2.12 Skeleton Loaders

`user_dashboard/src/components/Skeleton.jsx` (87 lines):

| Export | Usage |
|---|---|
| `SkeletonLine` | Low-level primitive (animated pulse bar) |
| `SkeletonBlock` | Multiple lines, last line shorter |
| `PageSkeleton` | Used as Suspense fallback + session init screen |
| `ListSkeleton` | Used in list/table pages (most data pages) |
| `DetailSkeleton` | Available but **not used** in any page |
| `CardSkeleton` | Available but **not used** in user dashboard pages |

**Verdict:** ✅ Present and used, but `DetailSkeleton` and `CardSkeleton` are unused dead code in user dashboard.

### 2.13 Toasts

`user_dashboard/src/components/Toast.jsx` (110 lines):
- Context-based system with `ToastProvider` + `useToast()` hook
- Variants: success, error, info, warn
- Auto-dismiss: configurable duration (default 4000ms)
- Bottom-right positioned (`z-9999`)
- CSS animation: `animate-slide-in` from `index.css`
- `aria-live="polite"` for accessibility

**CRITICAL FINDING:** `ToastProvider` wraps the app in `App.jsx`, but **`useToast()` is never called in any page component**. All pages use inline `useState`-based error/success message divs instead.

**Verdict:** ⚠️ Toast infrastructure exists but is **completely unused** — dead code.

### 2.14 Breadcrumbs

`user_dashboard/src/components/Breadcrumbs.jsx` (38 lines):
- Takes `items[]` with `label` + optional `to`
- Returns `null` if ≤ 1 item (no single-crumb breadcrumbs)
- Uses `/` separator with `aria-label="Breadcrumb"`

**Used in:** `UserNewRequestPage`, `UserRequestDetailPage`, `UserOrderDetailPage`, `UserInvoiceDetailPage`, `UserJobDetailPage`

**NOT used in:** `UserDashboardPage`, `UserRequestsPage`, `UserOrdersPage`, `UserInvoicesPage`, `UserJobsPage`, `UserReviewsPage`, `UserProfilePage`, `UserVehiclesPage`, `UserMessagesPage`, `UserNotificationsPage`

**Verdict:** ✅ Present, used in detail pages. Missing from list/index pages (acceptable pattern).

### 2.15 Mobile Nav

`user_dashboard/src/components/MobileNav.jsx` (73 lines):
- `md+`: children rendered inline as flex row
- `<md`: hamburger icon (≡ / ✕) with dropdown
- Click-outside-to-close via `pointerdown` event
- `z-50` dropdown, `aria-label` + `aria-expanded`

**Used in:** Most pages (Dashboard, Requests, NewRequest, RequestDetail, Orders, OrderDetail, Jobs, JobDetail, Reviews, Profile, Vehicles)

**NOT used in:** `UserInvoicesPage` (uses inline buttons), `UserNotificationsPage` (completely different layout)

**Verdict:** ✅ Present in most pages. Inconsistent usage in Invoices and Notifications pages.

### 2.16 Charts

**Not implemented.** No charting library is imported or used in the user dashboard.

**Verdict:** ❌ No charts or analytics visualizations.

### 2.17 Delete Account

**Not implemented.** `UserProfilePage.jsx` (133 lines) allows editing name + phone only.

**Verdict:** ❌ Missing delete account functionality.

### 2.18 Dashboard Stats

`user_dashboard/src/pages/UserDashboardPage.jsx` (65 lines):
- Welcome section with user name + email
- Navigation card grid: 7 cards (Requests, New Request, Orders, Invoices, Jobs, Profile, Vehicles)
- **No stat cards, no counters, no analytics**

**Verdict:** ❌ Dashboard is a navigation page only — no statistics.

### 2.19 Live Tracking

`user_dashboard/src/components/LiveTracker.jsx` (128 lines):
- Connects to Socket.io room `tracking:join`
- Listens for `tracking:location` events with `{ latitude, longitude }`
- Displays technician position on Leaflet map with custom blue marker
- Calculates distance using Haversine formula
- Estimates ETA at 30 km/h default speed
- Shows "Waiting for technician location…" when no data

**Used in:** `UserJobDetailPage.jsx` — rendered when job status is `assigned` or `in_progress`

**Verdict:** ✅ Full live tracking with distance and ETA.

### 2.20 Request Flow

`user_dashboard/src/components/RequestStepper.jsx` (134 lines):
- Visual pipeline: `created` → `pending_offers` → `offer_accepted` → `in_progress` → `completed`
- Cancelled state: red styling
- Desktop: horizontal stepper with connector lines + ping animation on current step
- Mobile: vertical stepper

**Used in:** `UserRequestDetailPage.jsx`

**Verdict:** ✅ Polished, responsive stepper component.

---

## 3. Technician Dashboard Audit

**File count:** 30 source files under `technician_dashboard/src/`

### 3.1 Routes

Defined in `technician_dashboard/src/App.jsx` (lines 92–115):

| Path | Component | Auth |
|---|---|---|
| `/` | Redirect → `/auth/technician/signin` | No |
| `/auth/technician/signin` | `TechnicianSignInPage` | No |
| `/auth/technician/signup` | `TechnicianSignUpPage` | No |
| `/auth/technician/forgot-password` | `TechnicianForgotPasswordPage` | No |
| `/auth/technician/reset-password` | `TechnicianResetPasswordPage` | No |
| `/dashboard` | `TechnicianDashboardPage` | **Yes** |
| `/profile` | `TechnicianProfilePage` | **Yes** |
| `/offers` | `TechnicianOffersPage` | **Yes** |
| `/discover` | `TechnicianDiscoverPage` | **Yes** |
| `/assignments` | `TechnicianAssignmentsPage` | **Yes** |
| `/jobs` | `TechnicianJobsPage` | **Yes** |
| `/jobs/:jobId` | `TechnicianJobDetailPage` | **Yes** |
| `/earnings` | `TechnicianEarningsPage` | **Yes** |
| `/messages/:requestId` | `TechnicianMessagesPage` | **Yes** |
| `/notifications` | `TechnicianNotificationsPage` | **Yes** |
| `*` | Redirect → `/auth/technician/signin` | No |

**Total: 14 lazy routes** + 1 catch-all.

### 3.2 Auth Flow

**Session management** — `technician_dashboard/src/App.jsx` lines 64–77:
- On mount, calls `getTechnicianProfile()`
- Checks `response.profile` exists → dispatches `setAuthUser(response.profile)` or `clearAuth`

**Sign In** — `TechnicianSignInPage.jsx` lines 51–73:
- Calls `technicianSignIn(email, password)` → `getTechnicianProfile()` → verifies `role === 'technician'`
- Role check at line 67: `profileResponse?.profile?.user?.role`

**Sign Up** — `TechnicianSignUpPage.jsx` (232 lines):
- **Single-step form** (no OTP, unlike user dashboard)
- Fields: name, email, phone, password, confirm password, technician type (individual/garage), business name (optional), **LocationPicker** for workshop location, service radius (km)
- Validation: email regex, 10-digit phone, 8+ char password, valid lat/lng, positive service radius
- Redirects to signin on success

**Token Refresh** — `technician_dashboard/src/lib/api.js` lines 80–98:
- Same shared-promise pattern
- Refresh endpoint: `POST /tech/auth/refresh`

**Additional auth:** `technicianChangePassword` function exists in api.js (line 134) but **no UI for it** exists.

**Verdict:** ✅ Full auth. Note: `technicianChangePassword` API exists with no corresponding page.

### 3.3 Lazy Loading

All 14 pages use `React.lazy()` — `technician_dashboard/src/App.jsx` lines 7–20. Same `<Suspense>` pattern.

**Verdict:** ✅ Fully implemented.

### 3.4 Error Boundary

Identical to user dashboard. Same class component, same buttons, same dark mode support.

**Verdict:** ✅ Implemented correctly (duplicated code).

### 3.5 Dark Mode

Same pattern as user dashboard.
- **Storage key:** `qa-technician-theme`
- System preference detection + manual toggle

**Verdict:** ✅ Fully implemented.

### 3.6 Request Discovery

`technician_dashboard/src/pages/TechnicianDiscoverPage.jsx` (423 lines):

**Two view modes:**

1. **List View** — card grid (`sm:grid-cols-2 lg:grid-cols-3`)
   - Issue type badge, time-ago, description (truncated 120 chars)
   - Vehicle info, location type, distance badge, car match indicator, towing flag
   - Offer count
   - "Submit Offer" button per card

2. **Map View** — Leaflet map centered on Nagpur
   - Red custom markers for each request with location data
   - Popups with request details + "Submit Offer" button
   - Shows count: "Showing X of Y requests with location data"

**Offer Modal:**
- Repair mode (onsite / tow to garage)
- Estimated cost (₹), estimated time (minutes)
- Optional message to customer
- Submit with loading state

**Pagination:** 12 items per page

**Verdict:** ✅ Excellent discovery with dual view + inline offer submission.

### 3.7 Maps / Location

`technician_dashboard/src/components/LocationPicker.jsx` (230 lines):
- **Identical code** to user dashboard (copy-pasted)
- Same Nominatim geocoding, GPS, debounced search

**Used in:** `TechnicianSignUpPage` (workshop location), `TechnicianProfilePage` (edit location)

**Discover page map:** Uses `MapContainer` + `TileLayer` + `Marker` + `Popup` directly (not LocationPicker).

**Verdict:** ✅ Maps are well-integrated.

### 3.8 Live Location Update

`technician_dashboard/src/pages/TechnicianJobDetailPage.jsx` lines 72–114:

**Socket.io setup (lines 82–92):**
```jsx
const socket = io(SOCKET_URL, { withCredentials: true, transports: ['websocket', 'polling'] })
socket.on('connect', () => socket.emit('tracking:join', jobId))
```

**Start sharing (lines 94–108):**
- `navigator.geolocation.watchPosition` with `enableHighAccuracy: true`
- Emits `tracking:update` with `{ jobId, latitude, longitude }`
- Continuous updates until stopped

**Stop sharing (lines 110–114):**
- `navigator.geolocation.clearWatch`
- Cleanup on unmount

**UI:** "📍 Share Location" / "■ Stop Sharing Location" buttons — only shown when job status is `in_progress`.

**Verdict:** ✅ Full live location broadcasting.

### 3.9 Messaging

`technician_dashboard/src/pages/TechnicianMessagesPage.jsx` (195 lines):

Same hybrid pattern as user dashboard:
- Socket.io: `chat:join`, `chat:new_message`, `chat:typing`, `chat:stop_typing`
- 30-second polling fallback
- Typing indicators, auto-scroll, Enter to send
- Auto-detect receiver ID from message history

**Verdict:** ✅ Mirrors user dashboard messaging. Same code structure.

### 3.10 Offers

**My Offers** — `TechnicianOffersPage.jsx` (225 lines):
- Paginated list of technician's own offers with status badges
- Status colors: pending (amber), accepted (emerald), rejected (red), expired (slate)
- **New Offer form**: manual UUID input for `request_id` + repair mode + cost + time + message
- Shows issue type, description, repair mode, cost, time for each offer

**Discovery Offers** — `TechnicianDiscoverPage.jsx`:
- Submit via modal from request cards or map popups
- Pre-filled request context in modal

**Verdict:** ✅ Two paths to submit offers. Offers page could benefit from linking to discover page.

### 3.11 Jobs

**Jobs List** — `TechnicianJobsPage.jsx` (130 lines):
- Status filter buttons: All / Assigned / In Progress / Completed
- Each job links to detail page
- Shows: issue type, repair mode, cost, dates, invoice status

**Job Detail** — `TechnicianJobDetailPage.jsx` (480 lines):

| Feature | Details |
|---|---|
| **JobStepper** | Visual 5-step pipeline: Assigned → In Progress → Completed → Invoiced → Paid |
| **Status actions** | Start Job (assigned→in_progress), Complete Job (in_progress→completed) |
| **Parts suggest** | Dynamic rows: part_id + quantity |
| **Invoice creation** | Dynamic line items (type, description, qty, unit_price) + tax rate + live preview |
| **File upload** | FileUploader component for work photos |
| **PDF download** | `generateInvoicePDF` on existing invoice |
| **Chat link** | Links to `/messages/:requestId` |
| **Location sharing** | Start/Stop live location broadcast |
| **Breadcrumbs** | Dashboard → My Jobs → Job Details |

**Verdict:** ✅ Comprehensive job management. All CRUD operations present.

### 3.12 Earnings / Charts

`technician_dashboard/src/pages/TechnicianEarningsPage.jsx` (240 lines):

**Uses `recharts` library:**

| Chart | Type | Data |
|---|---|---|
| Earnings Overview | `BarChart` | Total Earned vs Pending |
| Invoice Status | `PieChart` (donut) | Paid vs Pending count |
| Earnings by Issue Type | `BarChart` (horizontal) | Revenue grouped by issue type |

**Summary cards:**
- Total Earned (₹), Pending (₹), Paid Invoices (count), Total Jobs (count)

**Job breakdown:** List of all jobs with invoice total + payment status

**Verdict:** ✅ Three charts + summary cards + detailed breakdown. Well-implemented analytics.

### 3.13 Notifications

`technician_dashboard/src/pages/TechnicianNotificationsPage.jsx` (130 lines):
- Same features as user dashboard: mark read, mark all, delete, deep-linking, pagination
- Type icons: 📨 offer_received, ✅ offer_accepted, 🔧 job_assigned, ⚙️ job_started, 🏁 job_completed, 🧾 invoice_created, 💳 payment_received, 💬 message_received, 📍 location_update, 🔔 system
- Deep-links to `/jobs/{jobId}` or `/messages/{requestId}`

**Note:** Uses a completely different styling pattern (gray-based colors, sticky header) vs the rest of the app.

**Verdict:** ✅ Functional but visually inconsistent.

### 3.14 Skeleton Loaders

Same exports as user dashboard. Used in:
- `TechnicianDashboardPage` → `CardSkeleton`
- `TechnicianDiscoverPage`, `TechnicianJobDetailPage`, `TechnicianOffersPage`, `TechnicianJobsPage`, `TechnicianProfilePage` → `ListSkeleton`
- `TechnicianEarningsPage` → `CardSkeleton`

**Verdict:** ✅ Good usage. `DetailSkeleton` still unused.

### 3.15 Toasts

Same `ToastProvider` + `useToast` setup.

**CRITICAL FINDING:** Same as user dashboard — `ToastProvider` wraps the app but **`useToast()` is never called**. All pages use inline state-based messages.

**Verdict:** ⚠️ Dead code.

### 3.16 Breadcrumbs

Same component. **Only used in:** `TechnicianJobDetailPage.jsx`

**NOT used in:** Dashboard, Discover, Offers, Assignments, Jobs list, Earnings, Messages, Profile, Notifications

**Verdict:** ⚠️ Severely underused — only 1 of 10 protected pages uses breadcrumbs.

### 3.17 Mobile Nav

Same component. **Used in:** `TechnicianDashboardPage`, `TechnicianDiscoverPage`

**NOT used in:** Offers, Assignments, Jobs, JobDetail, Earnings, Messages, Profile, Notifications (these use inline nav buttons or `← Dashboard` links)

**Verdict:** ⚠️ Inconsistent — only 2 of 10 protected pages use MobileNav.

### 3.18 Delete Account

**Not implemented.** No UI or API call exists.

**Verdict:** ❌ Missing.

### 3.19 Dashboard Stats

`technician_dashboard/src/pages/TechnicianDashboardPage.jsx` (195 lines):

**Stat cards (4):**
- Pending Assignments (count)
- Active Jobs (count)
- Total Earned (₹)
- Completed Jobs (count)

**Online/Offline toggle:** Button to set availability via `updateAvailability()` API
**Verification badge:** Shows "Account pending verification" or "Verified"
**Quick actions (6 cards):** Discover, Offers, Assignments, Jobs, Earnings, Profile
**Data loading:** `Promise.allSettled` for resilient partial loading

**Verdict:** ✅ Real dashboard with stats + quick actions + availability toggle.

---

## 4. Shared Components Comparison

| Component | User Dashboard | Technician Dashboard | Identical? |
|---|---|---|---|
| `Breadcrumbs.jsx` | 38 lines | 38 lines | ✅ Yes |
| `FileUploader.jsx` | 158 lines | 158 lines | ✅ Yes |
| `LocationPicker.jsx` | 230 lines | 230 lines | ✅ Yes |
| `MobileNav.jsx` | 73 lines | 73 lines | ✅ Yes |
| `Skeleton.jsx` | 87 lines | 87 lines | ✅ Yes |
| `Toast.jsx` | 110 lines | 110 lines | ✅ Yes |
| `ErrorBoundary.jsx` | 67 lines | 67 lines | ✅ Yes |
| `index.css` | 30 lines | 30 lines | ✅ Yes |
| `main.jsx` | 22 lines | 22 lines | ✅ Yes (structure) |
| `store/authSlice.js` | 38 lines | 38 lines | ✅ Yes |
| `store/index.js` | 9 lines | 9 lines | ✅ Yes |
| `lib/useSocket.js` | 58 lines | 58 lines | ✅ Yes |
| `lib/generateInvoicePDF.js` | 164 lines | ~164 lines | ✅ Yes |
| **User-only** | `LiveTracker.jsx`, `RequestStepper.jsx` | — | — |
| **Tech-only** | — | `JobStepper.jsx` | — |

**12 components are copy-pasted across both apps.** This is a significant DRY violation. A shared package or monorepo structure would eliminate ~1,200 lines of duplication.

---

## 5. Bugs & Issues

### Bug 1: FileUploader prop name mismatch (Technician Dashboard)

**File:** `technician_dashboard/src/pages/TechnicianJobDetailPage.jsx` line ~375  
**Component:** `technician_dashboard/src/components/FileUploader.jsx` line 10

The page passes `onUpload` prop:
```jsx
<FileUploader onUpload={async (file) => { await uploadFile(file, 'job', jobId) }} />
```
But `FileUploader` accepts `onUploadComplete` prop:
```jsx
export default function FileUploader({ onUploadComplete, entityType, entityId, ... }) {
```

The `FileUploader` handles upload internally and calls `onUploadComplete?.(result.files)`. The `onUpload` prop is **silently ignored** — files upload but the parent is never notified of completion.

**Severity:** Medium — Upload works (FileUploader handles it) but the parent can't react to completion.

---

### Bug 2: Wrong environment variable name (Technician Dashboard)

**File:** `technician_dashboard/src/pages/TechnicianJobDetailPage.jsx` line 43

```javascript
const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000'
```

Uses `VITE_API_URL` while **every other file** uses `VITE_API_BASE_URL`. This means the Socket.io connection for live tracking will always fall back to `http://localhost:3000` in production.

**Severity:** High — Live location tracking will fail in production.

---

### Bug 3: Duplicate initial notification load (Technician Dashboard)

**File:** `technician_dashboard/src/pages/TechnicianNotificationsPage.jsx` lines 44–56

The `load` function is defined (line 44) and a separate `useEffect` (line 50) both call `getNotifications` on mount:
```jsx
// load function exists but is only called from pagination buttons
const load = async (p = 1) => { ... }

// This useEffect fires on mount — duplicates initial load
useEffect(() => {
  getNotifications({ page: 1, limit: 20 }).then(...)
}, [])
```

Two network requests fire on mount instead of one.

**Severity:** Low — Wastes one API call, no user-visible impact.

---

### Bug 4: `loadMessages` depends on `loading` state (Technician Dashboard)

**File:** `technician_dashboard/src/pages/TechnicianMessagesPage.jsx` lines 23–30

```jsx
const loadMessages = useCallback(async () => {
  try { ... }
  catch (err) {
    if (loading) setError(...) // ← depends on loading
  }
  finally { setLoading(false) }
}, [requestId, loading]) // ← loading in deps
```

The `loading` dependency causes `loadMessages` to be recreated every time loading state changes, which triggers the `useEffect` and polling `setInterval` to be torn down and recreated unnecessarily.

**Severity:** Low — Causes unnecessary effect re-runs, possible subtle timing issues with polling.

---

### Bug 5: Unused `useMap` import (Technician Dashboard)

**File:** `technician_dashboard/src/pages/TechnicianDiscoverPage.jsx` line 3

```jsx
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
```

`useMap` is imported but never used.

**Severity:** Trivial — Dead import, no runtime impact (tree-shaken away in prod).

---

### Bug 6: LocationPicker dark mode styling incomplete (Both Dashboards)

**File:** `user_dashboard/src/components/LocationPicker.jsx` (and tech copy)

The component uses hardcoded light-mode Tailwind classes without `dark:` variants:
- Line 153: `text-gray-700` (label)
- Line 160: `border-gray-300`, `bg-gray-100` (search input disabled state)
- Line 168: `border-gray-200 bg-white` (search results dropdown)
- Line 197: `border-gray-300` (map container)
- Line 181: `bg-blue-600` (GPS button) — blue instead of emerald theme

**Severity:** Medium — Visually broken in dark mode; blue button is off-brand.

---

### Bug 7: Toast system integrated but never used (Both Dashboards)

**Files:** `App.jsx` wraps in `<ToastProvider>`, `Toast.jsx` exports `useToast()`

No page or component calls `useToast()`. All 34 page files use inline `useState` for error/success messages.

**Severity:** Low — Dead code, unnecessary provider overhead.

---

### Bug 8: UI layout inconsistency in notifications pages (Both Dashboards)

**Files:** `UserNotificationsPage.jsx`, `TechnicianNotificationsPage.jsx`

Both notification pages use a completely different design pattern than all other pages:
- Sticky header instead of card header
- Gray color scheme (`bg-gray-950`, `text-gray-100`) instead of slate (`bg-slate-950`, `text-slate-100`)
- No `rounded-2xl border` card wrapper
- Different font sizes and spacing

**Severity:** Low — Functional but visually jarring navigation between pages.

---

### Bug 9: No loading skeleton in Assignments page (Technician Dashboard)

**File:** `technician_dashboard/src/pages/TechnicianAssignmentsPage.jsx` line 73

```jsx
{loading ? (
  <div className="mt-10 text-center text-sm text-slate-500">Loading assignments...</div>
) : ...}
```

Uses plain text "Loading assignments..." instead of the `ListSkeleton` component used everywhere else.

**Severity:** Trivial — Inconsistent loading UX.

---

### Bug 10: `UserInvoicesPage` header inconsistency

**File:** `user_dashboard/src/pages/UserInvoicesPage.jsx`

This page does NOT use the `MobileNav` component like other pages. It renders navigation buttons inline without the hamburger collapse pattern:

```jsx
<div className="flex gap-2">
  <button>Dashboard</button>
  <button>Theme</button>
  <button>Logout</button>
</div>
```

On mobile, these buttons may overflow or wrap poorly.

**Severity:** Low — Works on desktop, may have UX issues on narrow screens.

---

## 6. Missing Features

| Feature | User Dashboard | Technician Dashboard |
|---|---|---|
| **Delete account** | ❌ Not implemented | ❌ Not implemented |
| **Change password** (UI) | ❌ No page exists | ❌ API exists (`technicianChangePassword`) but no UI |
| **Dashboard statistics** | ❌ Nav grid only | ✅ 4 stat cards + availability toggle |
| **Charts / Analytics** | ❌ None | ✅ 3 recharts visualizations |
| **Email verification** | ❌ Not shown in UI | ❌ Not shown in UI |
| **Profile photo** | ❌ No avatar upload | ❌ No avatar upload |
| **Search / filter requests** | ⚠️ Status filter only | ⚠️ No filters on discover page |
| **Change password via UI** | ❌ | ❌ (API exists at `api.js` line 134) |
| **Toast notifications (runtime)** | ❌ Infrastructure unused | ❌ Infrastructure unused |

---

## 7. Recommendations

### Critical (Fix Before Production)

1. **Fix `VITE_API_URL` → `VITE_API_BASE_URL`** in `technician_dashboard/src/pages/TechnicianJobDetailPage.jsx` line 43. Live tracking will fail in production otherwise.

2. **Fix FileUploader prop mismatch** in `TechnicianJobDetailPage.jsx` — either use the component's `entityType`/`entityId` props (which handle upload internally) or change the prop name to `onUploadComplete`.

### High Priority

3. **Add dark mode classes to `LocationPicker.jsx`** in both dashboards — the search input, dropdown, map border, and GPS button all lack `dark:` variants.

4. **Either use `useToast()` or remove `ToastProvider`** — currently dead code wrapping both apps. Migrate inline error/success messages to use the toast system, or remove the unused infrastructure.

5. **Extract shared components into a common package** — 12 identical files are duplicated across both dashboards (~1,200 lines). Use a monorepo workspace package or symlinked shared module.

### Medium Priority

6. **Standardize page layouts** — Notification pages use different design language. Apply the same card-header + content-area pattern.

7. **Add user dashboard statistics** — the dashboard is navigation-only. Add request/order/job counts at minimum.

8. **Add change password page** for both dashboards — the admin dashboard has one, these two don't.

9. **Implement delete account** — GDPR/privacy compliance.

10. **Use `ListSkeleton`** in `TechnicianAssignmentsPage` instead of plain text loading indicator.

### Low Priority

11. **Remove unused `useMap` import** from `TechnicianDiscoverPage.jsx`.

12. **Fix duplicate notification fetch** on mount in `TechnicianNotificationsPage.jsx`.

13. **Fix `loadMessages` callback dependency** on `loading` in `TechnicianMessagesPage.jsx` — remove `loading` from deps array.

14. **Add `MobileNav`** to all technician pages for consistent mobile UX (currently only 2/10 pages use it).

15. **Add breadcrumbs** to more technician pages (currently only 1/10 pages uses them).

16. **Use `DetailSkeleton`** in detail pages instead of `ListSkeleton` for more appropriate loading placeholders.
