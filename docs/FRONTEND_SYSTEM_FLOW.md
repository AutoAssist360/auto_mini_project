# Quick Auto Assist — Frontend System Flow (Production Blueprint)

> Date: 2026-02-28  
> Scope: End-to-end frontend flow aligned with `backend/POSTMAN_TESTING_GUIDE.md` and mounted routes in `backend/src/server.js`.

---

## 1) Goal of this document

This document defines the **complete frontend flow** for the platform:
- Which page appears first and what appears next
- Role-based login/register/navigation behavior
- What each page contains (cards, fields, buttons, actions)
- Which backend API each button calls
- How chat, location tracking, towing, OTP, and emergency journey should work
- What is already supported by current backend vs what needs extension

Use this as your implementation reference while connecting frontend to backend and Prisma-backed data.

---

## 2) Current reality in your repository

### Frontend projects currently present
- `landing_page/` (React + Vite)
- `user_dashboard/` (React + Vite)
- `technician_dashboard/` (React + Vite)
- `admin_dashboard/` (React + Vite)
- `vender_dashboard/` (React + Vite)

### Backend role modules available
- User routes (`/auth`, `/profile`, `/vehicles`, `/requests`, `/offers`, `/jobs`, `/invoices`, `/orders`, `/reviews`, `/requests/:id/messages`)
- Technician routes (`/tech/*`)
- Admin routes (`/admin/*`)
- Vendor routes (`/vendor/*`)

### Important alignment note
For production, you should expose one public web entry domain and route users into role apps. Internally you can keep multiple Vite apps now, then migrate to a single shell later if needed.

---

## 3) Implemented vs planned capabilities (critical clarity)

### Already supported by backend (can integrate now)
- JWT auth + refresh + logout for all roles
- User service requests, offers, jobs, invoices, orders, reviews
- Technician availability, offers, assignments, job updates, invoice creation
- Messaging between user and technician for a request
- Technician location update endpoint (`POST /tech/location`)
- Admin management/analytics/audit logs
- Vendor warehouse/inventory/order/fulfillment/analytics

### Not fully implemented as dedicated backend features (plan/add)
- OTP-based auth (SMS/Email verification endpoints)
- Guest emergency request endpoint (non-logged-in instant raise)
- Real-time socket-based chat (currently REST messaging)
- Real-time map stream from technician to user (currently location update endpoint exists; user-facing read stream should be added)
- External towing provider orchestration APIs (if integrating third-party tow fleet)

If you build UI for these planned items now, keep them behind feature flags until endpoints are added.

---

## 4) System entry flow (first screen to role dashboard)

## 4.1 Landing page: `/`

### Sections/components
- Header: logo + nav links (`Features`, `How It Works`, `Pricing/Plans`, `Help`)
- Hero:
  - Title: Quick Auto Assist
  - Subtitle: roadside help, towing, parts, live tracking
  - Primary CTA: **Get Help Now**
  - Secondary CTA: **Join as Technician**
- Quick actions:
  - `Login`
  - `Sign Up`
  - Optional small `Admin Access` text link (not in primary nav)
- Footer: support email, legal, terms, privacy

### CTA navigation
- `Get Help Now` → `/auth/role?intent=help`
- `Join as Technician` → `/auth/role?intent=signup&role=technician`
- `Login` → `/auth/role?intent=login`
- `Admin Access` (hidden style) → `/auth/role?intent=login&role=admin`

---

## 4.2 Role selection page: `/auth/role`

### UI
- Title: Select your role
- Role cards:
  - Customer
  - Technician
  - Vendor
  - Admin (can be hidden unless direct link or privileged mode)

### Role routing
- Customer:
  - Login → `${VITE_USER_APP_URL}/auth/user/signin`
  - Register → `${VITE_USER_APP_URL}/auth/user/signup`
- Technician:
  - Login → `${VITE_TECHNICIAN_APP_URL}/auth/technician/signin`
  - Register → `${VITE_TECHNICIAN_APP_URL}/auth/technician/signup`
- Vendor:
  - Login → `${VITE_VENDOR_APP_URL}/auth/vendor/signin`
  - Register → `${VITE_VENDOR_APP_URL}/auth/vendor/signup`
- Admin:
  - Login only → `${VITE_ADMIN_APP_URL}/admin/login` (admins are seeded/created by ops)

---

## 5) Authentication and session flow

## 5.1 Shared auth behavior
- On successful sign-in, backend sets httpOnly cookies and returns access token
- On successful sign-up (user/technician/vendor), backend returns success message only; frontend navigates to corresponding sign-in page
- Frontend should use `credentials: 'include'`
- Token refresh flow: call refresh endpoint on `401 TOKEN_EXPIRED`, retry original request once
- On logout, clear local user store and navigate to `/`

## 5.2 Endpoints by role
- User: `/auth/signup`, `/auth/signin`, `/auth/logout`, `/auth/refresh`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`
- Technician: `/tech/auth/signup`, `/tech/auth/signin`, `/tech/auth/logout`, `/tech/auth/refresh`
- Vendor: `/vendor/auth/signup`, `/vendor/auth/signin`, `/vendor/auth/logout`, `/vendor/auth/refresh`
- Admin: `/admin/auth/signin`, `/admin/auth/logout`, `/admin/auth/refresh`

---

## 6) Customer (User) journey — exact screen sequence

## 6.1 Registration page: `/auth/user/signup`

### Fields
- `full_name`
- `email`
- `phone_number` (10 digits)
- `password`
- `confirm_password` (frontend-only validation)

### Buttons
- `Create Account`
- `Already have account? Sign In`

### API mapping
- Submit → `POST /auth/signup`
- Success → `/auth/user/signin` (with success message)

---

## 6.2 Login page: `/auth/user/signin`

### Fields
- `email`
- `password`

### Buttons
- `Sign In`
- `Forgot Password`

### API mapping
- Submit → `POST /auth/signin`
- Forgot password → `POST /auth/forgot-password`

---

## 6.3 User dashboard: `/user/dashboard`

### Top widgets
- Profile completion
- Active request count
- Pending invoices
- Recent orders

### Main actions/buttons
- `Add Vehicle` → `/user/vehicles/new`
- `Raise New Issue` → `/user/requests/new`
- `Track Active Job` (if active) → `/user/jobs/:jobId`
- `My Requests` → `/user/requests`
- `My Invoices` → `/user/invoices`
- `Order Parts` → `/user/orders/new`
- `Profile` → `/user/profile`
- `Logout`

### API mapping
- Load profile → `GET /profile`
- Load recent request list → `GET /requests?page=&limit=`
- Load pending invoices → `GET /invoices?payment_status=pending`

---

## 6.4 Add vehicle: `/user/vehicles/new`

### Fields
- Company
- Model
- Variant
- Registration number
- VIN (optional as per business policy)

### Buttons
- `Save Vehicle`
- `Cancel`

### API mapping
- Submit → `POST /vehicles`
- List/edit/delete pages use `GET /vehicles`, `PATCH /vehicles/:vehicleId`, `DELETE /vehicles/:vehicleId`

---

## 6.5 Raise issue: `/user/requests/new`

### Fields (backend-aligned)
- `vehicle_id`
- `issue_description`
- `issue_type` (`mechanical_failure`, `electrical_issue`, `tire_related`, `battery_issue`, `engine_problem`, `brake_issue`, `other`)
- `breakdown_latitude` (optional but recommended)
- `breakdown_longitude` (optional but recommended)
- `service_location_type` (`roadside`, `home`, `office`)
- `requires_towing` (boolean)

### Optional UX blocks
- Image uploader (if you add file upload API later)
- “Use current GPS” button (browser geolocation)

### Buttons
- `Submit Request`
- `Save Draft` (frontend local draft)

### API mapping
- Submit → `POST /requests`
- Success navigate → `/user/requests/:requestId`

---

## 6.6 Request details + offer tracking: `/user/requests/:requestId`

### Panels
- Request summary (issue, location, towing requirement)
- Status timeline (`created` → `pending_offers` → `offer_accepted`/`in_progress` → `completed`)
- Offers list from technicians
- Chat preview

### Actions
- `Refresh Offers`
- `Accept Offer`
- `Reject Offer`
- `Open Chat`
- `Cancel Request` (if still cancellable)

### API mapping
- Request detail → `GET /requests/:requestId`
- Offers list → `GET /requests/:requestId/offers`
- Accept → `PATCH /offers/:offerId/accept`
- Reject → `PATCH /offers/:offerId/reject`
- Cancel request → `PATCH /requests/:requestId/cancel`

---

## 6.7 Job tracking page: `/user/jobs/:jobId`

### Panels
- Technician card (name, rating, phone masked policy)
- ETA and job status
- Live map block (if location feed available)
- Job notes

### Actions
- `Chat with Technician`
- `Call Technician` (if policy allows)
- `Cancel Job` (business-rule based)

### API mapping
- Job detail → `GET /jobs/:jobId`
- Messages read/write (request scoped) → `GET /requests/:requestId/messages`, `POST /requests/:requestId/messages`

---

## 6.8 Invoice + payment page: `/user/invoices/:invoiceId`

### Panels
- Items list (labor/part/towing/diagnostic/other)
- Tax, subtotal, total
- Payment status badge

### Actions
- `Pay Now`
- `Download Invoice` (frontend PDF rendering or backend pdf endpoint in future)

### API mapping
- Invoice detail/list → `GET /invoices` / `GET /invoices/:invoiceId`
- Payment action → `POST /invoices/:invoiceId/pay`

---

## 6.9 Review page/modal (post-payment)

### Fields
- Rating (1–5)
- Comment

### API mapping
- Submit → `POST /reviews`

---

## 7) Technician journey — exact sequence

## 7.1 Technician signup: `/auth/technician/signup`

### Fields (backend-aligned)
- `full_name`, `email`, `phone_number`, `password`
- `business_name` (optional)
- `technician_type` (`individual` or `garage`)
- `location`, `latitude`, `longitude`
- `service_radius`

### API
- `POST /tech/auth/signup`

### Post-signup states
- Account is created and frontend redirects to `/auth/technician/signin` with success message
- If verification is required, backend can return pending/blocked state during sign-in until admin verification is complete

---

## 7.2 Technician dashboard: `/technician/dashboard`

### Widgets
- Online/offline toggle
- Pending opportunities count
- Active jobs count
- Earnings summary

### Actions
- `Go Online/Offline` → `PATCH /tech/availability`
- `View Opportunities` → `/technician/offers/pool`
- `View Assignments` → `/technician/assignments`
- `Active Jobs` → `/technician/jobs`
- `Update Profile` → `/technician/profile`

---

## 7.3 Offer pool: `/technician/offers/pool`

### List content per request
- Issue type, vehicle, distance estimate, location type, towing required
- Request age and urgency label

### Action
- `Send Offer`

### Offer submit fields
- `request_id`
- `repair_mode` (`onsite` or `tow_to_garage`)
- `estimated_cost`
- `estimated_time`
- Optional message

### API
- Pool list → `GET /tech/offers/pending`
- Submit offer → `POST /tech/offers`

---

## 7.4 Assignment flow

### Routes
- Pending assignments: `/technician/assignments`
- Job details: `/technician/jobs/:jobId`

### API
- `GET /tech/assignments/pending`
- `POST /tech/assignments/:jobId/accept`
- `GET /tech/jobs` / `GET /tech/jobs/:jobId`
- Status update → `PATCH /tech/jobs/:jobId/status`

---

## 7.5 Parts suggestion + invoice

### Actions
- Suggest parts → `POST /tech/jobs/:jobId/suggest-parts`
- Complete job → `POST /tech/jobs/:jobId/complete`
- Create invoice → `POST /tech/jobs/:jobId/invoice`

### Invoice creation UI
- Dynamic row editor: item type, description, qty, unit price
- Tax rate field
- Auto total calculation preview

---

## 7.6 Technician chat + location

### Messaging API
- Read: `GET /tech/requests/:requestId/messages`
- Send: `POST /tech/requests/:requestId/messages`

### Location update API
- `POST /tech/location` with `{ latitude, longitude }`

### Frontend behavior
- If job is active and tech is online, auto-send location every 15–30 seconds (throttled + battery aware)
- On app background/offline, pause and resume safely

---

## 8) Vendor journey (parts supply)

## 8.1 Vendor auth
- Signup/Login via `/vendor/auth/*`
- Signup success redirects to `/auth/vendor/signin` with a success message

## 8.2 Vendor dashboard: `/vendor/dashboard`
- Warehouse count
- Inventory low stock alerts
- Open orders and fulfillment status

## 8.3 Vendor feature routes
- Warehouses: `/vendor/warehouses`
- Inventory: `/vendor/inventory`
- Reservations: `/vendor/reservations`
- Orders: `/vendor/orders`
- Fulfillment: `/vendor/fulfillment`
- Analytics: `/vendor/analytics`

## 8.4 Core API mapping
- Warehouses: `POST/GET/PATCH/DELETE /vendor/warehouses...`
- Inventory: `/vendor/warehouses/:id/inventory`, `/vendor/inventory/:inventoryId`
- Orders: `/vendor/orders`, `PATCH /vendor/orders/:orderId/confirm`
- Fulfillment: `PATCH /vendor/fulfillment/:id/status`

---

## 9) Admin journey (private entry)

## 9.1 Admin login
- Route: `/admin/login`
- API: `POST /admin/auth/signin`
- Admin should not be in public register flow (manual admin creation only)

## 9.2 Admin dashboard route map
- `/admin/dashboard`
- `/admin/users`
- `/admin/technicians`
- `/admin/vendors`
- `/admin/warehouses`
- `/admin/requests`
- `/admin/jobs`
- `/admin/orders`
- `/admin/invoices`
- `/admin/analytics`
- `/admin/audit-logs`

## 9.3 Primary actions
- Verify/suspend technicians
- Suspend users
- Monitor active incidents/jobs
- Review platform payments/invoices/orders
- Audit sensitive actions

---

## 10) Emergency (no-login fast request) — production design

This is required by your ask but needs backend extension for clean implementation.

## 10.1 UX flow
1. Landing `Get Help Now` click
2. Modal asks: `Continue as Guest` or `Login`
3. If Guest:
	- Minimal form: name, phone, issue type, current GPS, towing yes/no
	- OTP verify phone/email
	- Create temporary emergency request
4. System dispatches nearest available technician
5. User receives tracking link + OTP to view status

## 10.2 Suggested new endpoints (to add)
- `POST /emergency/guest/request`
- `POST /emergency/guest/send-otp`
- `POST /emergency/guest/verify-otp`
- `GET /emergency/guest/request/:token`

## 10.3 Prisma impact
- Add guest request model or allow nullable `user_id` + `guest_contact_*` fields on request model
- Track OTP verification state and audit timestamps

---

## 11) OTP architecture (email/SMS)

## 11.1 Providers
- SMS: Twilio / MessageBird / AWS SNS
- Email OTP: SendGrid / SES / Resend

## 11.2 Frontend OTP flow
1. User submits phone/email
2. Call `send-otp`
3. OTP input screen with resend timer
4. Call `verify-otp`
5. On success continue auth/request flow

## 11.3 Security requirements
- 4–6 digit OTP, short expiry (2–10 mins)
- Retry limits + cooldown
- Device fingerprint/rate-limit checks
- Never store OTP in plaintext

---

## 12) Live chat and tracking design

## 12.1 Chat (current and future)
- Current backend: REST messages per request
- Production improvement: add WebSocket channel per request

### Suggested fallback strategy
- Tier 1: WebSocket live stream
- Tier 2: if socket fails, poll every 5–10 seconds

## 12.2 Tracking
- Technician app sends periodic location updates (`POST /tech/location`)
- User map reads latest location (needs existing or new read endpoint)
- Add route protection so only request owner/admin can view live coordinates

---

## 13) Frontend route matrix (recommended)

Note: In current implementation, these routes are served by separate role-specific apps and selected from `landing_page` via app base URLs from environment variables.

## Public
- `/`
- `/auth/role`
- `/auth/user/signin`, `/auth/user/signup`
- `/auth/technician/signin`, `/auth/technician/signup`
- `/auth/vendor/signin`, `/auth/vendor/signup`
- `/admin/login`
- `/emergency` (guest fast flow)

## User protected
- `/user/dashboard`
- `/user/profile`
- `/user/vehicles`, `/user/vehicles/new`
- `/user/requests`, `/user/requests/new`, `/user/requests/:requestId`
- `/user/jobs/:jobId`
- `/user/invoices`, `/user/invoices/:invoiceId`
- `/user/orders`, `/user/orders/new`, `/user/orders/:orderId`

## Technician protected
- `/technician/dashboard`
- `/technician/profile`
- `/technician/offers/pool`
- `/technician/assignments`
- `/technician/jobs`, `/technician/jobs/:jobId`
- `/technician/earnings`

## Vendor protected
- `/vendor/dashboard`
- `/vendor/warehouses`
- `/vendor/inventory`
- `/vendor/orders`
- `/vendor/fulfillment`
- `/vendor/analytics`

## Admin protected
- `/admin/dashboard`
- `/admin/users`
- `/admin/technicians`
- `/admin/vendors`
- `/admin/warehouses`
- `/admin/requests`
- `/admin/jobs`
- `/admin/orders`
- `/admin/invoices`
- `/admin/analytics`
- `/admin/audit-logs`

---

## 14) Navigation guards and access control (frontend)

- `PublicRoute`: redirects authenticated users to their role dashboard if needed
- `ProtectedRoute`: checks auth + role
- `RoleGuard`: only permit routes allowed for role
- `SessionGuard`: handles refresh on token expiry and logout on hard failure

### Role-to-default-dashboard mapping
- `user` → `/user/dashboard`
- `technician` → `/technician/dashboard`
- `vendor` → `/vendor/dashboard`
- `admin` → `/admin/dashboard`

---

## 15) API integration standards (frontend)

## 15.1 HTTP client rules
- Base URL from env (`VITE_API_BASE_URL`)
- `credentials: 'include'`
- Uniform error normalization (`status`, `message`, `fieldErrors`)
- Automatic one-time retry after refresh on `401 TOKEN_EXPIRED`

## 15.2 Suggested frontend modules
- `api/authApi.ts`
- `api/userApi.ts`
- `api/technicianApi.ts`
- `api/vendorApi.ts`
- `api/adminApi.ts`
- `api/chatApi.ts`
- `api/locationApi.ts`

## 15.3 Request state handling
- Use loading, success, empty, error states for each page
- Preserve unsent draft text for chat/request forms

---

## 16) Critical edge cases and expected UX behavior

1. **User clicks Get Help with no login**  
	- Offer guest emergency path with OTP

2. **Token expired while paying invoice**  
	- Silent refresh + retry once, else redirect login with preserved intent

3. **Technician goes offline during active job**  
	- Show warning and require confirmation

4. **No technician offer received in N minutes**  
	- Show escalation CTA: widen radius / allow towing priority / contact support

5. **Location permission denied**  
	- Ask manual pin-drop + address fallback

6. **Chat fails due to network**  
	- Queue unsent message and retry

7. **Admin route accessed by non-admin**  
	- Force redirect to role dashboard + show unauthorized toast

---

## 17) End-to-end frontend test scenarios (must have)

## Auth
- User signup/login/logout/refresh cycle
- Technician signup redirects to sign-in; pending verification state (if enabled) is handled at sign-in response
- Admin hidden entry login

## User service lifecycle
- Add vehicle → create request → view offers → accept offer → job tracking → invoice payment → review submit

## Technician lifecycle
- Go online → submit offer → accept assignment → update status → complete job → create invoice

## Messaging/location
- User and tech exchange messages on same request
- Tech location updates and user receives map updates/fallback status

## Vendor/Admin
- Vendor inventory + order + fulfillment transitions
- Admin verification/suspension/audit views

## Emergency
- Guest emergency minimal details + OTP verification + dispatch flow

---

## 18) Build sequence recommendation (fast and safe)

1. Implement auth + role routing + guards
2. Implement complete user flow (vehicle → request → offer → job → invoice → review)
3. Implement technician operational flow
4. Add chat + location tracking UI with REST polling first
5. Add vendor/admin management panels
6. Add guest emergency + OTP (after backend endpoints are added)
7. Add websocket real-time layer as optimization

---

## 19) How frontend updates Prisma-backed data

Frontend never writes to Prisma directly. It sends API requests to backend routes, and backend controllers validate + write to PostgreSQL through Prisma.

Data path:

`UI action` → `Frontend API call` → `Express route` → `Validation + business logic` → `Prisma ORM` → `PostgreSQL (Neon)`

So once your UI forms are connected to the correct endpoints above, data will automatically persist in your Prisma-managed DB.

---

## 20) Final implementation note for your project

To reduce confusion while building:
- Keep this file as the single source of truth for frontend flow
- Keep backend route contract aligned with `POSTMAN_TESTING_GUIDE.md`
- Mark every planned feature in UI as either `LIVE` (API exists) or `PLANNED` (API pending)

This will prevent broken flows during development and make integration predictable.

