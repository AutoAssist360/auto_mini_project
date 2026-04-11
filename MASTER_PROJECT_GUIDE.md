# MASTER PROJECT GUIDE

## 1. What this file is

This is a single master guide for the `auto_assist` project.

The goal of this document is:

- to help you understand the full project in simple language
- to explain how frontend, backend, database, Redis, sockets, and payments connect
- to show button -> function -> API -> route -> database -> response -> UI update flow
- to prepare you for interviews, debugging, and future coding

I use technical words where needed, but I explain them in simple words immediately after.

## 2. Important scope note

I analyzed the project code that belongs to this repo.  
I did **not** do a line-by-line explanation of `node_modules` because that folder is third-party vendor code downloaded from npm, not your project logic.  
Instead, I explain every important dependency in the `package.json` section.

I also separate:

- authored source code: files your team edits
- generated files: Vite build output in `dist/`
- generated Prisma client code in `backend/generated/prisma`
- runtime files: uploaded media in `backend/uploads`

That distinction matters because an interviewer usually cares most about the authored logic.

## 3. Project at a glance

This project is a multi-app platform for roadside assistance and automotive parts/logistics.

It has:

- a public landing page
- a user dashboard
- a technician dashboard
- a vendor dashboard
- an admin dashboard
- one shared backend
- PostgreSQL through Prisma
- optional Redis for geo and caching-style operations
- Socket.IO for real-time tracking and notifications
- Stripe, Razorpay, and UPI-style payment flows

In simple words:

- users create service requests and parts orders
- technicians discover or receive jobs, travel, repair, and invoice
- vendors manage warehouses, inventory, orders, delivery, returns, and commission dues
- admins watch the whole system, manage catalog data, and intervene when needed

## 4. Full project scan

### 4.1 Folder list

```text
admin_dashboard
backend
docs
landing_page
technician_dashboard
tests
user_dashboard
vender_dashboard
admin_dashboard\dist
admin_dashboard\public
admin_dashboard\src
admin_dashboard\dist\assets
admin_dashboard\src\components
admin_dashboard\src\lib
admin_dashboard\src\pages
admin_dashboard\src\store
backend\generated
backend\prisma
backend\scripts
backend\src
backend\uploads
backend\prisma\migrations
backend\prisma\migrations\20260123150625_initial_migration
backend\prisma\migrations\20260128183940_init
backend\prisma\migrations\20260202194623
backend\prisma\migrations\20260204172307_complete_schema
backend\prisma\migrations\20260212000000_schema_enhancements
backend\prisma\migrations\20260222000000_add_vendor_warehouse_system
backend\prisma\migrations\20260222010000_add_optimisation_indexes
backend\prisma\migrations\20260315000000_vendor_delivery_return_flow
backend\prisma\migrations\20260401000000_remove_wallet_balance
backend\src\cron
backend\src\lib
backend\src\middleware
backend\src\modules
backend\src\utils
backend\src\modules\admin
backend\src\modules\chat
backend\src\modules\emergency
backend\src\modules\notifications
backend\src\modules\payments
backend\src\modules\shared
backend\src\modules\technician
backend\src\modules\uploads
backend\src\modules\user
backend\src\modules\vendor
backend\src\modules\admin\analytics
backend\src\modules\admin\auditLogs
backend\src\modules\admin\auth
backend\src\modules\admin\catalog
backend\src\modules\admin\dashboard
backend\src\modules\admin\invoices
backend\src\modules\admin\jobs
backend\src\modules\admin\orders
backend\src\modules\admin\payouts
backend\src\modules\admin\requests
backend\src\modules\admin\technicians
backend\src\modules\admin\users
backend\src\modules\admin\vendors
backend\src\modules\admin\warehouses
backend\src\modules\technician\assignments
backend\src\modules\technician\auth
backend\src\modules\technician\availability
backend\src\modules\technician\discovery
backend\src\modules\technician\earnings
backend\src\modules\technician\jobs
backend\src\modules\technician\location
backend\src\modules\technician\messages
backend\src\modules\technician\offers
backend\src\modules\technician\profile
backend\src\modules\user\auth
backend\src\modules\user\invoices
backend\src\modules\user\jobs
backend\src\modules\user\messages
backend\src\modules\user\offers
backend\src\modules\user\orders
backend\src\modules\user\parts
backend\src\modules\user\profile
backend\src\modules\user\requests
backend\src\modules\user\reviews
backend\src\modules\user\vehicles
backend\src\modules\vendor\analytics
backend\src\modules\vendor\auth
backend\src\modules\vendor\fulfillment
backend\src\modules\vendor\inventory
backend\src\modules\vendor\orders
backend\src\modules\vendor\profile
backend\src\modules\vendor\reservations
backend\src\modules\vendor\warehouses
landing_page\dist
landing_page\public
landing_page\src
landing_page\dist\assets
landing_page\src\pages
technician_dashboard\dist
technician_dashboard\public
technician_dashboard\src
technician_dashboard\dist\assets
technician_dashboard\src\components
technician_dashboard\src\lib
technician_dashboard\src\pages
technician_dashboard\src\store
user_dashboard\dist
user_dashboard\public
user_dashboard\src
user_dashboard\dist\assets
user_dashboard\src\components
user_dashboard\src\lib
user_dashboard\src\pages
user_dashboard\src\store
vender_dashboard\dist
vender_dashboard\public
vender_dashboard\src
vender_dashboard\dist\assets
vender_dashboard\src\components
vender_dashboard\src\lib
vender_dashboard\src\pages
vender_dashboard\src\store
```

### 4.2 Hidden environment and git files

```text
.gitignore
admin_dashboard\.env
admin_dashboard\.env.example
admin_dashboard\.gitignore
backend\.env
backend\.gitignore
backend\uploads\.gitkeep
landing_page\.env
landing_page\.env.example
landing_page\.gitignore
technician_dashboard\.env
technician_dashboard\.env.example
technician_dashboard\.gitignore
user_dashboard\.env
user_dashboard\.env.example
user_dashboard\.gitignore
vender_dashboard\.env
vender_dashboard\.env.example
vender_dashboard\.gitignore
```

### 4.3 Confirmation

I will now explain every file without skipping anything.

## 5. High-level architecture

Think of the system in 5 layers:

1. UI layer  
   React pages, forms, tables, buttons, trackers, charts.

2. Client API layer  
   `src/lib/api.js` files in each dashboard send HTTP requests and automatically handle cookies and token refresh.

3. Backend route layer  
   Express route files handle each business area: auth, requests, jobs, orders, inventory, payouts, admin actions.

4. Data layer  
   Prisma talks to PostgreSQL. Tables are defined in `backend/prisma/schema.prisma`.

5. Real-time and side-effect layer  
   Socket.IO sends live location and refresh events. Email and notifications are side effects. Redis helps fast geo lookup when available.

## 6. Core backend entry files

### `backend/src/index.js`

Purpose:

- starts the backend server
- creates the HTTP server from Express app
- initializes Socket.IO
- starts reservation cleanup

### `backend/src/server.js`

Purpose:

- creates the Express app
- mounts all routes
- configures middleware
- sets security and parsing behavior
- defines 404 and global error handling

Important behavior:

- Stripe webhook raw body middleware is placed before `express.json()`
- CORS is configured here
- static uploads folder is exposed here
- all module routers are mounted here

Important mounted route groups:

- `/api/auth`
- `/api/profile`
- `/api/vehicles`
- `/api/requests`
- `/api/offers`
- `/api/jobs`
- `/api/invoices`
- `/api/reviews`
- `/api/messages`
- `/api/orders`
- `/api/parts`
- `/api/notifications`
- `/api/uploads`
- `/api/chat`
- `/api/payments`
- `/api/tech/*`
- `/api/admin/*`
- `/api/vendor/*`

Important risk:

- `server.js` contains comments about a public emergency route, but there is no real mounted implementation for the landing-page quick emergency request flow

### `backend/src/socket.js`

Purpose:

- authenticates socket connections
- decides who can view or publish live tracking
- handles chat events
- sends role-based refresh events
- sends notifications and email fallback

### `backend/config.js`

Purpose:

- central place to read environment variables
- exports config values like secrets, URLs, payment settings, and admin UPI details

### `backend/src/lib/prisma.js`

Purpose:

- creates the Prisma client using PostgreSQL adapter
- all route files import this shared client

### `backend/src/lib/redis.js`

Purpose:

- optional Redis connection
- if Redis URL does not exist, the app falls back gracefully

## 7. Database model deep explanation

The database is defined in `backend/prisma/schema.prisma`.

### Main identity model

- `User`

This table stores the base person account.

A user can have roles like:

- user
- technician
- vendor
- admin

### User service models

- `UserVehicle`
- `ServiceRequest`
- `ServiceRequestPart`
- `ServiceRequestMedia`
- `TechnicianOffer`
- `Job`
- `Invoice`
- `InvoiceItem`
- `Review`
- `PlatformMessage`

### Catalog and automotive structure

- `CarCompany`
- `CarModel`
- `CarVariant`
- `CarPartCategory`
- `CarPart`
- `PartPrice`

Real-world example:

- Company: Maruti Suzuki
- Model: Swift
- Variant: Swift VXI 2022 Petrol Manual
- Category: Brakes
- Part: Front Brake Pad
- Price: Rs 2499 for that specific variant

### Technician models

- `TechnicianProfile`
- `TechnicianCarSupport`
- `TechnicianPartSkill`
- `TechnicianCertification`
- `TechnicianResource`

### Vendor and inventory models

- `Warehouse`
- `Inventory`
- `InventoryReservation`
- `Order`
- `OrderItem`
- `Fulfillment`

### Finance and platform models

- `Notification`
- `FileUpload`
- `Payout`
- `AuditLog`

## 8. File responsibility map

This section answers: "Which file does what?"

### Root files

- `package.json` -> root orchestration scripts and a few shared dependencies
- `package-lock.json` -> exact dependency versions
- `README.md` -> project overview
- `SETUP_GUIDE.md` -> setup instructions and port layout
- `MASTER_PROJECT_GUIDE.md` -> this document

### Docs and tests

- `docs/README.md` -> docs landing page
- `docs/E2E_TEST_CASES.md` -> end-to-end test scenarios
- `docs/FRONTEND_AUDIT_REPORT.md` -> frontend audit notes
- `docs/FRONTEND_GAP_ANALYSIS.md` -> missing feature and UI gap notes
- `docs/FRONTEND_SYSTEM_FLOW.md` -> screen and flow explanation
- `docs/USER_TECHNICIAN_DASHBOARD_AUDIT.md` -> dashboard audit notes
- `tests/README.md` -> test folder explanation, but there is not a strong automated test suite here

### Backend config, scripts, and runtime helpers

- `backend/package.json` -> backend scripts and dependencies
- `backend/prisma.config.js` -> Prisma configuration
- `backend/config.js` -> env value exports
- `backend/runTest.cjs` -> helper test runner script
- `backend/runTest.js` -> helper test runner script
- `backend/testLedger.js` -> ledger testing helper
- `backend/tmp_check.js` -> temporary debugging helper
- `backend/README.md` -> backend-specific notes
- `backend/POSTMAN_TESTING_GUIDE.md` -> API testing guide
- `backend/scripts/demo-flow-check.mjs` -> demo scenario script
- `backend/scripts/discover-regression-check.mjs` -> discovery regression check
- `backend/scripts/edge-case-check.mjs` -> edge case scenario script
- `backend/scripts/fix-import-extensions.mjs` -> import extension fixer
- `backend/scripts/realtime-flow-check.mjs` -> realtime/socket flow check

### Backend Prisma and schema files

- `backend/prisma/schema.prisma` -> complete database schema
- `backend/prisma/seed.mjs` -> sample data seed
- `backend/prisma/migrations/*/migration.sql` -> schema history
- `backend/prisma/migrations/migration_lock.toml` -> Prisma migration state

### Backend main runtime files

- `backend/src/index.js` -> server startup
- `backend/src/server.js` -> express app and route mounting
- `backend/src/socket.js` -> socket auth, rooms, tracking, chat, refresh events
- `backend/src/cron/settlement.js` -> scheduled payout/settlement processing

### Backend shared libs and middleware

- `backend/src/lib/prisma.js` -> shared Prisma client
- `backend/src/lib/redis.js` -> Redis connection wrapper
- `backend/src/middleware/auth.js` -> request auth and current user resolution
- `backend/src/middleware/errorHandler.js` -> consistent error response handling
- `backend/src/middleware/rateLimiter.js` -> request throttling
- `backend/src/middleware/roleGuard.js` -> role-based access control
- `backend/src/middleware/sanitize.js` -> input cleanup against unsafe payloads
- `backend/src/middleware/upload.js` -> upload middleware
- `backend/src/middleware/validate.js` -> Zod schema validation
- `backend/src/middleware/validateParams.js` -> route param validation

### Backend utilities

- `backend/src/utils/AppError.js` -> custom application error class
- `backend/src/utils/asyncWrapper.js` -> async route wrapper to avoid repeated try/catch
- `backend/src/utils/cloudinary.js` -> Cloudinary upload config
- `backend/src/utils/cookieHelper.js` -> cookie setting/clearing helpers
- `backend/src/utils/emailService.js` -> SMTP email sender
- `backend/src/utils/geo.js` -> geo distance and nearby technician helpers
- `backend/src/utils/matchingAlgorithm.js` -> technician ranking score
- `backend/src/utils/orderLifecycle.js` -> order payment/return lifecycle rules
- `backend/src/utils/paginate.js` -> page/limit helpers
- `backend/src/utils/reservationCleanup.js` -> clears expired reservations
- `backend/src/utils/tokenHelper.js` -> JWT generation/verification helpers

### Backend shared modules

- `backend/src/modules/shared/vehicle.select.js` -> reusable Prisma select objects for vehicle queries
- `backend/src/modules/chat/chat.controller.js` -> AI chat assistant logic using Gemini
- `backend/src/modules/chat/chat.routes.js` -> chat endpoint
- `backend/src/modules/notifications/notifications.routes.js` -> list/read/delete notifications
- `backend/src/modules/uploads/uploads.routes.js` -> upload/list/delete file APIs
- `backend/src/modules/payments/ledgerService.js` -> create payout ledger records from payments
- `backend/src/modules/payments/payments.routes.js` -> platform fee, invoice payment, order payment, dues payment, webhook

### Backend admin modules

- `backend/src/modules/admin/admin.helpers.js` -> shared admin query helpers
- `backend/src/modules/admin/admin.schemas.js` -> admin-related validation
- `backend/src/modules/admin/auth/auth.routes.js` -> admin login/logout/refresh
- `backend/src/modules/admin/dashboard/dashboard.routes.js` -> dashboard metrics
- `backend/src/modules/admin/users/users.routes.js` -> user list/block/delete
- `backend/src/modules/admin/technicians/technicians.routes.js` -> technician moderation
- `backend/src/modules/admin/vendors/vendors.routes.js` -> vendor moderation
- `backend/src/modules/admin/warehouses/warehouses.routes.js` -> warehouse oversight
- `backend/src/modules/admin/requests/requests.routes.js` -> request oversight and forced assignment/cancellation
- `backend/src/modules/admin/jobs/jobs.routes.js` -> job oversight and status intervention
- `backend/src/modules/admin/orders/orders.routes.js` -> order oversight, refund, mark-paid
- `backend/src/modules/admin/invoices/invoices.routes.js` -> invoice oversight
- `backend/src/modules/admin/payouts/payouts.routes.js` -> payout reporting and manual marking
- `backend/src/modules/admin/analytics/analytics.routes.js` -> revenue, matching, and system analytics
- `backend/src/modules/admin/auditLogs/auditLogs.routes.js` -> audit log list
- `backend/src/modules/admin/catalog/catalog.routes.js` -> companies/models/variants/categories/parts/prices CRUD
- `backend/src/modules/admin/catalog/catalog.schemas.js` -> catalog validation

### Backend user modules

- `backend/src/modules/user/auth/auth.routes.js` -> user signup/signin/logout/refresh/forgot/reset/change password
- `backend/src/modules/user/auth/auth.schemas.js` -> auth validation
- `backend/src/modules/user/profile/profile.routes.js` -> get/update/delete profile
- `backend/src/modules/user/profile/profile.schemas.js` -> profile validation
- `backend/src/modules/user/vehicles/vehicles.routes.js` -> vehicle CRUD and company/model/variant lookup
- `backend/src/modules/user/vehicles/vehicles.schemas.js` -> vehicle validation
- `backend/src/modules/user/requests/requests.routes.js` -> create/list/get/cancel requests, technician ranking, direct booking
- `backend/src/modules/user/requests/requests.schemas.js` -> request validation
- `backend/src/modules/user/offers/offers.routes.js` -> accept/reject/list technician offers
- `backend/src/modules/user/jobs/jobs.routes.js` -> list/get user jobs
- `backend/src/modules/user/invoices/invoices.routes.js` -> list/get invoices and payment info
- `backend/src/modules/user/invoices/invoices.schemas.js` -> invoice validation
- `backend/src/modules/user/reviews/reviews.routes.js` -> create/list reviews and update technician rating
- `backend/src/modules/user/reviews/reviews.schemas.js` -> review validation
- `backend/src/modules/user/messages/messages.routes.js` -> request chat between user and technician
- `backend/src/modules/user/messages/messages.schemas.js` -> message validation
- `backend/src/modules/user/orders/orders.routes.js` -> create/pay/cancel/return/list parts orders
- `backend/src/modules/user/orders/orders.schemas.js` -> order validation
- `backend/src/modules/user/parts/parts.routes.js` -> browse parts catalog and inventory

### Backend technician modules

- `backend/src/modules/technician/technician.schemas.js` -> technician validation
- `backend/src/modules/technician/auth/auth.routes.js` -> technician signup/signin/logout/refresh
- `backend/src/modules/technician/profile/profile.routes.js` -> technician profile and capability CRUD
- `backend/src/modules/technician/availability/availability.routes.js` -> online/offline toggle
- `backend/src/modules/technician/discovery/discovery.routes.js` -> discover open requests
- `backend/src/modules/technician/offers/offers.routes.js` -> technician offers
- `backend/src/modules/technician/assignments/assignments.routes.js` -> accept/reject assigned booking
- `backend/src/modules/technician/jobs/jobs.routes.js` -> status update, suggest parts, create invoice, complete job
- `backend/src/modules/technician/messages/messages.routes.js` -> technician side chat
- `backend/src/modules/technician/location/location.routes.js` -> location updates to DB and Redis
- `backend/src/modules/technician/earnings/earnings.routes.js` -> earnings and dues information

### Backend vendor modules

- `backend/src/modules/vendor/vendor.helpers.js` -> vendor order and inventory helpers
- `backend/src/modules/vendor/vendor.schemas.js` -> vendor validation
- `backend/src/modules/vendor/auth/auth.routes.js` -> vendor auth
- `backend/src/modules/vendor/profile/profile.routes.js` -> vendor profile
- `backend/src/modules/vendor/warehouses/warehouses.routes.js` -> warehouse CRUD
- `backend/src/modules/vendor/inventory/inventory.routes.js` -> inventory CRUD and bulk update
- `backend/src/modules/vendor/reservations/reservations.routes.js` -> reservation visibility
- `backend/src/modules/vendor/orders/orders.routes.js` -> order processing, COD, return review
- `backend/src/modules/vendor/fulfillment/fulfillment.routes.js` -> shipping/fulfillment records and stock commit
- `backend/src/modules/vendor/analytics/analytics.routes.js` -> vendor dashboard analytics

### Empty or planned backend area

- `backend/src/modules/emergency` -> empty folder; planned feature area for public emergency requests, but not implemented

### Landing page files

- `landing_page/src/main.jsx` -> app bootstrapping
- `landing_page/src/App.jsx` -> route selection and theme toggle
- `landing_page/src/ErrorBoundary.jsx` -> crash boundary
- `landing_page/src/index.css` -> global styles
- `landing_page/src/pages/LandingPage.jsx` -> main marketing page and quick emergency modal
- `landing_page/src/pages/RoleSelectionPage.jsx` -> choose role app
- `landing_page/src/pages/FAQPage.jsx` -> FAQ content
- `landing_page/src/pages/TermsPage.jsx` -> terms page
- `landing_page/src/pages/PrivacyPage.jsx` -> privacy page
- image assets -> landing visuals only

### User dashboard files

- `user_dashboard/src/main.jsx` -> app boot
- `user_dashboard/src/App.jsx` -> routes, auth restore, protected layout, cart drawer, chat widget
- `user_dashboard/src/ErrorBoundary.jsx` -> error boundary
- `user_dashboard/src/index.css` -> global styles
- `user_dashboard/src/store/index.js` -> Redux store
- `user_dashboard/src/store/authSlice.js` -> auth state
- `user_dashboard/src/store/cartSlice.js` -> cart state + localStorage sync
- `user_dashboard/src/lib/api.js` -> user HTTP client
- `user_dashboard/src/lib/formValidation.js` -> form validation helpers
- `user_dashboard/src/lib/generateInvoicePDF.js` -> jsPDF invoice generation
- `user_dashboard/src/lib/useSocket.js` -> socket hook
- `user_dashboard/src/components/Breadcrumbs.jsx` -> breadcrumb UI
- `user_dashboard/src/components/CartDrawer.jsx` -> shopping cart side drawer
- `user_dashboard/src/components/ChatWidget.jsx` -> AI assistant widget
- `user_dashboard/src/components/DashboardBackButton.jsx` -> shared back button
- `user_dashboard/src/components/FileUploader.jsx` -> upload with progress and gallery
- `user_dashboard/src/components/LiveTracker.jsx` -> technician map tracking
- `user_dashboard/src/components/LocationPicker.jsx` -> map and geocoding picker
- `user_dashboard/src/components/MobileNav.jsx` -> mobile nav shell
- `user_dashboard/src/components/OrderLiveTracker.jsx` -> vendor delivery/return tracking
- `user_dashboard/src/components/RequestStepper.jsx` -> request progress steps
- `user_dashboard/src/components/Skeleton.jsx` -> loading placeholders
- `user_dashboard/src/components/Toast.jsx` -> toast UI
- `user_dashboard/src/components/toastContext.js` -> toast provider
- `user_dashboard/src/pages/UserSignInPage.jsx` -> user login page
- `user_dashboard/src/pages/UserSignUpPage.jsx` -> user signup page
- `user_dashboard/src/pages/UserForgotPasswordPage.jsx` -> forgot password page
- `user_dashboard/src/pages/UserResetPasswordPage.jsx` -> reset password page
- `user_dashboard/src/pages/UserChangePasswordPage.jsx` -> password change page
- `user_dashboard/src/pages/UserDashboardPage.jsx` -> user home dashboard
- `user_dashboard/src/pages/UserVehiclesPage.jsx` -> vehicle CRUD
- `user_dashboard/src/pages/UserNewRequestPage.jsx` -> create service request
- `user_dashboard/src/pages/UserRequestsPage.jsx` -> request list
- `user_dashboard/src/pages/UserRequestDetailPage.jsx` -> request detail, offers, ranking, booking, platform fee QR
- `user_dashboard/src/pages/UserJobsPage.jsx` -> jobs list
- `user_dashboard/src/pages/UserJobDetailPage.jsx` -> job detail, live tracking, invoice payment, parts add-to-cart, review
- `user_dashboard/src/pages/UserInvoicesPage.jsx` -> invoice list
- `user_dashboard/src/pages/UserInvoiceDetailPage.jsx` -> invoice detail, QR pay, PDF download
- `user_dashboard/src/pages/UserPartsPage.jsx` -> browse parts and add to cart
- `user_dashboard/src/pages/UserCheckoutPage.jsx` -> create orders from cart
- `user_dashboard/src/pages/UserOrdersPage.jsx` -> orders list
- `user_dashboard/src/pages/UserOrderDetailPage.jsx` -> order detail, fulfillment view, QR pay, cancel, return, live delivery tracking
- `user_dashboard/src/pages/UserMessagesPage.jsx` -> user-tech message thread
- `user_dashboard/src/pages/UserNotificationsPage.jsx` -> notification center
- `user_dashboard/src/pages/UserProfilePage.jsx` -> user profile
- `user_dashboard/src/pages/UserReviewsPage.jsx` -> reviews list

### Technician dashboard files

- `technician_dashboard/src/main.jsx` -> app boot
- `technician_dashboard/src/App.jsx` -> routes and auth restore
- `technician_dashboard/src/ErrorBoundary.jsx` -> error boundary
- `technician_dashboard/src/index.css` -> global styles
- `technician_dashboard/src/store/index.js` -> Redux store
- `technician_dashboard/src/store/authSlice.js` -> auth state
- `technician_dashboard/src/lib/api.js` -> technician API client
- `technician_dashboard/src/lib/formValidation.js` -> validation helpers
- `technician_dashboard/src/lib/generateInvoicePDF.js` -> PDF helper
- `technician_dashboard/src/lib/useSocket.js` -> socket hook
- `technician_dashboard/src/components/*` -> same idea as user dashboard, but technician-flavored
- `TechnicianDashboardPage.jsx` -> summary dashboard
- `TechnicianDiscoverPage.jsx` -> open request discovery and offer submission
- `TechnicianAssignmentsPage.jsx` -> assigned booking accept/reject
- `TechnicianOffersPage.jsx` -> offers history
- `TechnicianJobsPage.jsx` -> jobs list
- `TechnicianJobDetailPage.jsx` -> main execution page for location, status, parts, invoice, media
- `TechnicianMessagesPage.jsx` -> chat
- `TechnicianEarningsPage.jsx` -> earnings charts and commission payment flow
- `TechnicianProfilePage.jsx` -> profile and capabilities
- auth and notification pages -> same role-specific responsibilities

### Vendor dashboard files

- `vender_dashboard/src/main.jsx` -> app boot
- `vender_dashboard/src/App.jsx` -> routes and auth restore
- `vender_dashboard/src/ErrorBoundary.jsx` -> error boundary
- `vender_dashboard/src/index.css` -> global styles
- `vender_dashboard/src/store/index.js` -> Redux store
- `vender_dashboard/src/store/authSlice.js` -> auth state
- `vender_dashboard/src/lib/api.js` -> vendor API client
- `vender_dashboard/src/lib/formValidation.js` -> validation helpers
- `vender_dashboard/src/lib/useSocket.js` -> socket hook
- `vender_dashboard/src/components/*` -> shared UI pieces for vendor app
- `VendorDashboardPage.jsx` -> analytics home
- `VendorWarehousesPage.jsx` -> warehouse CRUD
- `VendorInventoryPage.jsx` -> stock management
- `VendorBulkImportPage.jsx` -> multi-row inventory batch import
- `VendorReservationsPage.jsx` -> reservation visibility
- `VendorOrdersPage.jsx` -> vendor order list
- `VendorOrderDetailPage.jsx` -> confirm/process/ship/collect COD/return review/live order tracking
- `VendorLedgerPage.jsx` -> payouts/commission dues
- `VendorAnalyticsPage.jsx` -> charts and business metrics
- `VendorProfilePage.jsx` -> vendor profile and bank/UPI details
- auth and notification pages -> role-specific access and account workflows

### Admin dashboard files

- `admin_dashboard/src/main.jsx` -> app boot
- `admin_dashboard/src/App.jsx` -> routes, auth restore, dashboard preload
- `admin_dashboard/src/ErrorBoundary.jsx` -> error boundary
- `admin_dashboard/src/index.css` -> global styles
- `admin_dashboard/src/store/index.js` -> Redux store
- `admin_dashboard/src/store/authSlice.js` -> auth state
- `admin_dashboard/src/lib/api.js` -> admin API client
- `admin_dashboard/src/lib/formValidation.js` -> admin-side validators
- `admin_dashboard/src/lib/generateInvoicePDF.js` -> PDF helper
- `admin_dashboard/src/lib/useSocket.js` -> admin socket client
- `admin_dashboard/src/components/AdminDateInput.jsx` -> date input utility
- `admin_dashboard/src/components/*` -> shared admin UI components
- `AdminDashboardPage.jsx` -> top-level system health
- `AdminUsersPage.jsx` and `AdminUserDetailPage.jsx` -> user oversight
- `AdminTechniciansPage.jsx` and `AdminTechnicianDetailPage.jsx` -> technician oversight
- `AdminVendorsPage.jsx` and `AdminVendorDetailPage.jsx` -> vendor oversight
- `AdminWarehousesPage.jsx` and `AdminWarehouseDetailPage.jsx` -> warehouse oversight
- `AdminRequestsPage.jsx` and `AdminRequestDetailPage.jsx` -> request oversight and intervention
- `AdminJobsPage.jsx` and `AdminJobDetailPage.jsx` -> job intervention
- `AdminOrdersPage.jsx` and `AdminOrderDetailPage.jsx` -> order intervention and refund
- `AdminInvoicesPage.jsx` and `AdminInvoiceDetailPage.jsx` -> invoice oversight
- `AdminPayoutsPage.jsx` -> payout control
- `AdminAnalyticsPage.jsx` -> analytics
- `AdminAuditLogsPage.jsx` -> audit trail
- `AdminCarCatalogPage.jsx` -> master automotive catalog CRUD
- admin auth pages -> login, forgot, reset, change password

### Runtime and non-source files

- `backend/uploads/*` -> runtime file uploads, not source
- `dist/assets/*` -> build output, not source
- `backend/generated/prisma/*` -> generated Prisma client from schema

## 9. Package.json deep explanation

## Root package

Purpose:

- coordinates all apps together
- uses `concurrently` to run multiple dev servers

Important dependency:

- `concurrently`

What it is:

- a tool that runs multiple terminal commands at once

Why used:

- this project needs backend + multiple dashboards running together

What breaks if removed:

- root `npm run dev` convenience workflow breaks

Also present at root:

- `ioredis`
- `razorpay`

These are mainly backend-oriented, but present at root due workspace layout/history.

## Backend dependencies

### `express`

What it is:

- Node.js web framework

Where used:

- `backend/src/server.js`
- all route files

Internal working:

- it receives HTTP requests
- matches them to route handlers
- runs middleware before handlers

If removed:

- backend API cannot run

### `@prisma/client` and `prisma`

What they are:

- Prisma ORM library and schema/migration tooling

Where used:

- `backend/src/lib/prisma.js`
- all route files that query database
- `backend/prisma/schema.prisma`

Internal working:

- you describe models in schema
- Prisma generates a JS client
- route files call methods like `findUnique`, `create`, `update`, `$transaction`

If removed:

- almost all database access breaks

### `@prisma/adapter-pg` and `pg`

What they are:

- PostgreSQL connection layer used by Prisma

Where used:

- `backend/src/lib/prisma.js`

If removed:

- Prisma cannot connect to PostgreSQL correctly

### `jsonwebtoken`

What it is:

- JWT token library

Where used:

- auth flows
- `backend/src/socket.js`
- auth middleware

### `bcrypt`

What it is:

- password hashing library

Where used:

- user, technician, vendor, admin auth routes

### `cors`

What it is:

- Cross-Origin Resource Sharing middleware

Why needed:

- frontend apps run on different ports from backend
- browser would block requests without correct CORS settings

### `cookie-parser`

What it is:

- cookie parsing middleware

Why needed:

- auth tokens are stored in cookies

### `helmet`

What it is:

- security header middleware

### `morgan`

What it is:

- request logger

### `zod`

What it is:

- schema validation library

Where used:

- `*.schemas.js` files
- `validate.js` middleware

### `socket.io`

What it is:

- real-time event framework

Where used:

- `backend/src/socket.js`
- all dashboards through `socket.io-client`

### `ioredis`

What it is:

- Redis client

Where used:

- `backend/src/lib/redis.js`
- geo helpers in `backend/src/utils/geo.js`

Why used:

- fast nearby technician lookup using geo commands

### `nodemailer`

What it is:

- email sending library

Where used:

- `backend/src/utils/emailService.js`

### `multer`

What it is:

- multipart form/file upload parser

### `cloudinary`

What it is:

- cloud media hosting SDK

### `node-cron`

What it is:

- scheduler for repeated background tasks

### `decimal.js`

What it is:

- precise decimal arithmetic library

Why needed:

- money should not rely on floating-point math

### `stripe`

What it is:

- card payment gateway

### `razorpay`

What it is:

- Indian payment gateway

### `@google/genai`

What it is:

- Gemini API client

Where used:

- `backend/src/modules/chat/chat.controller.js`

## Frontend dependencies used across dashboards

### `react` and `react-dom`

- UI library and DOM renderer

### `react-router-dom`

- client-side routing library used in every `App.jsx`

### `@reduxjs/toolkit` and `react-redux`

- global state management used for auth and cart

### `socket.io-client`

- frontend socket client used by trackers and refresh hooks

### `leaflet` and `react-leaflet`

- map libraries used by location pickers and trackers

### `jspdf` and `jspdf-autotable`

- PDF generation libraries used for invoice export

### `qrcode.react`

- QR renderer for UPI payment screens

### `react-markdown`

- renders markdown inside AI chat widget

### `recharts`

- chart library for earnings and analytics

### `lucide-react`

- icon package

### `tailwindcss` and Vite

- utility-first CSS and build tooling

## 10. Environment files deep explanation

Important warning:

- `backend/.env` currently contains real secret-looking values
- secrets should not normally be committed to git
- in a real production project, these should be rotated and moved to secure secret management

### Backend env variables

### `DATABASE_URL`

- PostgreSQL connection string used by Prisma

### `USER_SECRET`

- JWT signing secret used for auth token creation and verification

### `PORT`

- backend server port

### `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

- email server settings used by `emailService.js`

### `FRONTEND_URL_USER`, `FRONTEND_URL_TECH`, `FRONTEND_URL_VENDOR`, `FRONTEND_URL_ADMIN`

- dashboard URLs used in redirects and payment success/cancel URLs

### `CORS_ORIGIN`

- allowed frontend origin(s)

### `ADMIN_UPI_ID`, `ADMIN_UPI_NAME`

- admin payment receiver details for platform fee and dues collection

### `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

- Stripe API and webhook verification settings

### `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

- media upload settings

### `GEMINI_API_KEY`

- AI chat API access

### Frontend env variables

Common pattern:

- `VITE_API_BASE_URL=http://localhost:3000`

Meaning:

- frontend sends API requests to backend server

Landing page also uses role app URLs for redirecting to user, technician, vendor, and admin apps.

### Frontend -> backend -> database -> Redis env flow

1. frontend reads `VITE_API_BASE_URL`
2. frontend sends request to backend
3. backend reads `DATABASE_URL` to talk to PostgreSQL
4. backend optionally reads Redis config through Redis layer
5. backend reads payment/email/cloudinary keys for side effects
6. backend sends response to frontend

## 11. API lifecycle: request to response

This is the common pattern almost everywhere.

1. React button calls a handler like `handleSubmit`.
2. Handler calls a function from `src/lib/api.js`.
3. `apiRequest()` sends fetch request with `credentials: 'include'`.
4. Browser sends cookies automatically.
5. Backend middleware reads cookie and authenticates user.
6. Validation middleware checks request body using Zod.
7. Route file runs business logic.
8. Prisma reads/writes PostgreSQL.
9. Optional side effects happen: notifications, socket refresh, email, payout ledger, Redis update.
10. JSON response is returned.
11. Frontend updates local state, Redux state, or reloads screen data.

### Important frontend API wrapper behavior

The user dashboard API wrapper automatically retries after refresh on `401`.

Real code:

```js
export async function apiRequest(path, options = {}) {
  const _retried = options._retried || false
  for (const baseUrl of API_BASE_CANDIDATES) {
    const response = await fetch(`${baseUrl}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    })

    if (response.status === 401 && !_retried) {
      await refreshSession()
      return apiRequest(path, { ...options, _retried: true })
    }
  }
}
```

Simple meaning:

- if access token expired
- app quietly tries refresh endpoint
- if refresh works, original request is retried

## 12. Important code snippets explained simply

### 12.1 Technician matching algorithm

File:

- `backend/src/utils/matchingAlgorithm.js`

Real code:

```js
export function calculateTechnicianScore(technician, distanceKm, options = {}) {
    let score = 0;

    const radius = technician.service_radius || 50;
    if (distanceKm !== null && distanceKm !== undefined) {
        const distanceRatio = Math.max(0, 1 - (distanceKm / radius));
        score += distanceRatio * 35;
    } else {
        score += 17.5;
    }

    if (requestPartIds.length === 0) {
        score += 15;
    } else if (technicianPartIds.size > 0) {
        const matchedParts = requestPartIds.filter((partId) => technicianPartIds.has(partId)).length;
        const skillRatio = matchedParts / requestPartIds.length;
        score += skillRatio * 25;
    }

    const currentRating = parseFloat(technician.rating);
    if (!isNaN(currentRating) && currentRating > 0 && technician.total_reviews > 0) {
        const ratingRatio = currentRating / 5.0;
        score += ratingRatio * 25;
    } else {
        score += 18;
    }
}
```

Simple explanation:

- distance contributes up to 35 points
- skill overlap contributes up to 25 points
- rating contributes up to 25 points
- experience contributes up to 15 points
- new technicians still get baseline help instead of being invisible

### 12.2 Socket token extraction

File:

- `backend/src/socket.js`

Real code:

```js
function getSocketToken(socket) {
  if (socket.handshake.auth?.token) {
    return socket.handshake.auth.token;
  }

  const authorizationHeader = socket.handshake.headers?.authorization;
  if (authorizationHeader?.startsWith("Bearer ")) {
    return authorizationHeader.replace("Bearer ", "");
  }

  const cookies = parseCookieHeader(socket.handshake.headers?.cookie);
  return cookies.accessToken || cookies.authcookie || null;
}
```

Simple meaning:

- sockets can authenticate using explicit token, bearer header, or cookie

### 12.3 Inventory reservation logic

File:

- `backend/src/modules/user/orders/orders.routes.js`

Real code:

```js
const reserved = await tx.inventory.updateMany({
  where: {
    warehouse_id: resolvedWarehouseId,
    part_id: item.part_id,
    quantity_available: { gte: item.quantity },
    quantity_reserved: { lte: POSTGRES_INT_MAX - item.quantity },
  },
  data: {
    quantity_reserved: { increment: item.quantity },
  },
});
```

Simple meaning:

- reserve stock only if enough stock still exists
- reduces overselling risk during concurrent checkouts

### 12.4 Platform fee QR generation

File:

- `backend/src/modules/payments/payments.routes.js`

Real code:

```js
paymentRouter.get("/platform-fee/qr", userAuth, asyncWrapper(async (req, res) => {
  const txnRef = `PF-${req.userId.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`;
  const note = "Platform Fee - Quick Auto Assist";
  res.json(buildUpiPayload({
    upiId: ADMIN_UPI_ID,
    upiName: ADMIN_UPI_NAME,
    amount: PLATFORM_FEE_AMOUNT,
    reference: txnRef,
    note,
  }));
}))
```

Simple meaning:

- backend builds a UPI payment payload
- frontend renders it as QR

## 13. Button -> function -> API -> backend -> database -> UI flow

## 13.1 Landing page role selection

Frontend files:

- `landing_page/src/pages/LandingPage.jsx`
- `landing_page/src/pages/RoleSelectionPage.jsx`

What user clicks:

- role cards or buttons like user, technician, vendor, admin

API called:

- none

Result:

- browser navigates to correct dashboard URL

## 13.2 Landing page quick emergency request

Frontend file:

- `landing_page/src/pages/LandingPage.jsx`

What user clicks:

- emergency quick request modal submit

Frontend behavior:

- posts guest quick request data to `${API_BASE}/emergency-request`

Backend status:

- intended but not actually implemented

Impact:

- this flow is currently incomplete/broken

## 13.3 User creates service request

Frontend file:

- `user_dashboard/src/pages/UserNewRequestPage.jsx`

Button:

- submit request button

Frontend function:

- form submit handler validates fields and calls `createServiceRequest(payload)`

Client API:

- `POST /requests`

Backend route:

- `backend/src/modules/user/requests/requests.routes.js`

Controller logic:

- validates request body
- verifies selected vehicle belongs to user
- creates `ServiceRequest`
- may attach files and requested parts

Database operations:

- read `UserVehicle`
- insert `ServiceRequest`
- insert `ServiceRequestPart` if parts exist
- connect uploads if file IDs were passed

UI update:

- user sees the created request and can move into technician discovery

## 13.4 User gets ranked technicians for a request

Frontend file:

- `user_dashboard/src/pages/UserRequestDetailPage.jsx`

Button:

- load/find technicians

Client API:

- `GET /requests/:requestId/technicians`

Backend route:

- `backend/src/modules/user/requests/requests.routes.js`

Controller logic:

- loads request and vehicle details
- tries Redis geo search
- falls back to DB/Haversine when needed
- checks car support compatibility
- calculates match score
- sorts technicians descending

Database operations:

- reads `ServiceRequest`
- reads `TechnicianProfile`
- reads `TechnicianCarSupport`
- reads `TechnicianPartSkill`

Response:

- ranked technicians plus source flag (`redis` or `db`)

UI update:

- ranked technician cards appear

## 13.5 User directly books a technician

Frontend file:

- `user_dashboard/src/pages/UserRequestDetailPage.jsx`

Button:

- book technician

Client API:

- `POST /requests/:requestId/book`

Backend route:

- `backend/src/modules/user/requests/requests.routes.js`

Controller logic:

- checks request ownership and status
- finds technician profile
- transaction creates or updates offer
- creates `Job`
- updates request state
- emits notifications and socket refreshes

Database operations:

- `TechnicianOffer` create/update
- `Job` create
- `ServiceRequest` update

UI update:

- request becomes waiting-for-confirmation
- technician sees pending assignment

## 13.6 User cancels booking before technician confirms

Frontend file:

- `user_dashboard/src/pages/UserRequestDetailPage.jsx`

Button:

- cancel pending booking

Client API:

- `PATCH /requests/:requestId/cancel-booking`

Backend route:

- `backend/src/modules/user/requests/requests.routes.js`

Controller logic:

- deletes temporary job
- rejects related offer
- reopens request if valid
- notifies technician
- emits refresh events

Database operations:

- `Job` delete
- `TechnicianOffer` update
- `ServiceRequest` update

## 13.7 Technician sends an offer from discover page

Frontend file:

- `technician_dashboard/src/pages/TechnicianDiscoverPage.jsx`

Button:

- send offer

Backend route:

- `backend/src/modules/technician/offers/offers.routes.js`

Database:

- `TechnicianOffer` insert

UI update:

- offer modal closes and user can later see the offer

## 13.8 User accepts technician offer

Frontend file:

- `user_dashboard/src/pages/UserRequestDetailPage.jsx`

Button:

- accept offer

Backend route:

- `backend/src/modules/user/offers/offers.routes.js`

Controller logic:

- accepts one offer
- rejects the others
- creates a job
- updates request state

Database:

- `TechnicianOffer` update
- `Job` create
- `ServiceRequest` update

## 13.9 Technician accepts assigned booking

Frontend file:

- `technician_dashboard/src/pages/TechnicianAssignmentsPage.jsx`

Button:

- accept assignment

Backend route:

- `backend/src/modules/technician/assignments/assignments.routes.js`

Database:

- job/request/offer status fields update

## 13.10 Technician updates live location

Frontend file:

- `technician_dashboard/src/pages/TechnicianJobDetailPage.jsx`

Function:

- geolocation reads coordinates
- app updates backend and socket stream

Backend route:

- `backend/src/modules/technician/location/location.routes.js`

Socket file:

- `backend/src/socket.js`

Database/Redis:

- technician coordinates updated in DB
- Redis geo index may also update

UI update:

- user live tracker map updates in real time

## 13.11 Technician changes job status

Frontend file:

- `technician_dashboard/src/pages/TechnicianJobDetailPage.jsx`

Buttons:

- start job
- mark in progress
- mark completed

Backend route:

- `backend/src/modules/technician/jobs/jobs.routes.js`

Database:

- `Job` update
- possibly `ServiceRequest` update

UI update:

- badges, stepper, and job panels refresh on both sides

## 13.12 Technician suggests parts

Frontend file:

- `technician_dashboard/src/pages/TechnicianJobDetailPage.jsx`

Button:

- suggest parts

Backend route:

- technician jobs routes

Database:

- `ServiceRequestPart` create/update

UI update:

- user job detail now shows suggested parts

## 13.13 User adds suggested part to cart

Frontend file:

- `user_dashboard/src/pages/UserJobDetailPage.jsx`

Important frontend logic:

- gets part details
- filters in-stock inventories
- picks cheapest option
- dispatches `addToCart`
- opens cart drawer

Database write:

- none at this moment

UI update:

- cart opens immediately because cart is Redux + localStorage

## 13.14 User creates parts order from checkout

Frontend file:

- `user_dashboard/src/pages/UserCheckoutPage.jsx`

Button:

- place order

Client API:

- `POST /orders`

Backend route:

- `backend/src/modules/user/orders/orders.routes.js`

Controller logic:

- validates delivery snapshot
- checks stock
- computes subtotal, tax, total
- creates order and order items
- reserves inventory
- creates reservation rows
- notifies vendor

Database:

- `Order` create
- `OrderItem` create
- `Inventory.quantity_reserved` increment
- `InventoryReservation` create

UI update:

- cart items are removed
- orders page reflects new order(s)

## 13.15 User pays order via UPI confirmation

Frontend files:

- `user_dashboard/src/pages/UserCheckoutPage.jsx`
- `user_dashboard/src/pages/UserOrderDetailPage.jsx`

Backend route:

- `GET /orders/:orderId/qr-data`

Logic:

- backend builds UPI deep link from vendor UPI ID
- frontend renders QR
- user pays externally
- user confirms transaction ID
- backend marks order as paid

Database:

- `Order.payment_status`
- `Order.transaction_id`
- payout ledger side effects

## 13.16 Vendor confirms and processes order

Frontend file:

- `vender_dashboard/src/pages/VendorOrderDetailPage.jsx`

Buttons:

- confirm order
- mark processing
- cancel

Backend route:

- `backend/src/modules/vendor/orders/orders.routes.js`

Database:

- `Order.order_status` update

## 13.17 Vendor creates fulfillment and delivery tracking

Frontend file:

- `vender_dashboard/src/pages/VendorOrderDetailPage.jsx`

Backend route:

- `backend/src/modules/vendor/fulfillment/fulfillment.routes.js`

Database:

- `Fulfillment` create/update
- inventory reservation commit helpers

UI update:

- user sees shipment details and live tracking

## 13.18 User requests return

Frontend file:

- `user_dashboard/src/pages/UserOrderDetailPage.jsx`

Button:

- request return

Backend route:

- `backend/src/modules/user/orders/orders.routes.js`

Controller logic:

- ensures order is delivered
- checks return window
- stores reason and timestamps
- notifies vendor

Database:

- `Order.return_status`
- `Order.return_reason`
- related return timestamps

## 13.19 Technician creates invoice

Frontend file:

- `technician_dashboard/src/pages/TechnicianJobDetailPage.jsx`

Button:

- create invoice

Backend route:

- `backend/src/modules/technician/jobs/jobs.routes.js`

Database:

- `Invoice` create
- `InvoiceItem` create

## 13.20 User pays invoice by UPI

Frontend files:

- `user_dashboard/src/pages/UserJobDetailPage.jsx`
- `user_dashboard/src/pages/UserInvoiceDetailPage.jsx`

Buttons:

- confirm payment

Backend route:

- invoice payment endpoints and payment helper routes

Database:

- `Invoice.payment_status`
- `Invoice.transaction_id`
- payout ledger records

## 13.21 User submits review after job

Frontend file:

- `user_dashboard/src/pages/UserJobDetailPage.jsx`

Button:

- submit review

Backend route:

- `backend/src/modules/user/reviews/reviews.routes.js`

Database:

- `Review` create
- `TechnicianProfile.rating` recalculate
- `TechnicianProfile.total_reviews` recalculate

## 13.22 Vendor bulk imports inventory

Frontend file:

- `vender_dashboard/src/pages/VendorBulkImportPage.jsx`

Button:

- submit batch import

Backend route:

- vendor inventory routes

Database:

- `Inventory` insert/update per part and warehouse

## 13.23 Admin catalog CRUD

Frontend file:

- `admin_dashboard/src/pages/AdminCarCatalogPage.jsx`

Buttons:

- add, edit, delete company/model/variant/category/part/price

Backend route:

- `backend/src/modules/admin/catalog/catalog.routes.js`

Database:

- catalog tables and `AuditLog`

## 13.24 Admin force assign technician

Frontend file:

- `admin_dashboard/src/pages/AdminRequestDetailPage.jsx`

Backend route:

- admin request routes

Database:

- request, offer, and job state updates

## 13.25 Admin marks payout as paid

Frontend file:

- `admin_dashboard/src/pages/AdminPayoutsPage.jsx`

Button:

- mark as paid

Backend route:

- `backend/src/modules/admin/payouts/payouts.routes.js`

Database:

- `Payout.status`
- `Payout.paid_at`
- `Payout.transaction_id`

## 14. End-to-end user journey

### Step 1: User signs in

- frontend login page sends credentials
- backend verifies password with bcrypt
- JWT cookie is set
- frontend restores session with profile call

### Step 2: User registers a vehicle

- vehicle record links user to exact car variant

### Step 3: User raises service request

- request stores issue type, description, location, and optional files

### Step 4: Technician matching happens

- request detail asks backend for ranked technicians
- Redis geo or DB fallback finds nearby candidates
- matching algorithm scores them

### Step 5: A technician is chosen

Two paths exist:

- user accepts technician offer
- user directly books a technician

### Step 6: Technician travels and works

- technician updates live location
- user tracks on map
- technician marks progress
- technician may suggest parts

### Step 7: User buys needed parts

- suggested parts can be added to cart
- checkout creates one order per warehouse
- stock is reserved
- vendor processes fulfillment

### Step 8: Technician completes job and creates invoice

- invoice is generated from actual work and parts/labor

### Step 9: Payment happens

- invoice payment goes through Stripe, Razorpay, UPI, or cash/manual confirmation depending on route
- order payment goes through vendor or platform flow
- payout ledger is created

### Step 10: Review and long-tail lifecycle

- user submits review
- technician rating recalculates
- user may later request order return if within allowed window

## 15. Features deep dive

### Feature: Multi-role authentication

Purpose:

- different dashboards for different actor types

Internal working:

- base `User` identity + role
- each dashboard uses its own auth routes and refresh endpoint

### Feature: Vehicle-aware service requests

Purpose:

- connect problem to exact car variant

Why useful:

- better technician fit
- better part price relevance

### Feature: Technician discovery and ranking

Purpose:

- help user find the best technician faster

Internal working:

- distance + car support + part skills + rating + reviews

Edge cases:

- no Redis available
- missing vehicle company
- technician has no reviews yet

### Feature: Direct booking and offer acceptance

Purpose:

- supports both marketplace-style and direct-selection behavior

### Feature: Live tracking

Purpose:

- show movement of technician or vendor delivery

Internal working:

- socket rooms
- publish/view access checks
- map component updates state in real time

### Feature: Parts marketplace

Purpose:

- lets users buy needed parts from vendors and warehouses

### Feature: Inventory reservations

Purpose:

- prevent overselling

### Feature: Vendor fulfillment and return handling

Purpose:

- move order through shipping and return lifecycle

### Feature: Invoice and payments

Purpose:

- turn completed work into bill and revenue split

### Feature: Payout ledger

Purpose:

- represent who should receive money and who owes commission

### Feature: AI chat assistant

Purpose:

- give helpful answers in the user dashboard

### Feature: Admin catalog management

Purpose:

- central source of truth for companies, models, variants, parts, and prices

## 16. Algorithms explained for interviews

### 16.1 Technician ranking algorithm

Problem:

- choose the most suitable technician, not just the nearest one

Inputs:

- distance
- request part IDs
- technician part skills
- rating
- total reviews
- service radius

Logic:

- distance worth 35
- skill worth 25
- rating worth 25
- experience worth 15

Time complexity:

- roughly O(n * p) where `n` is candidate technicians and `p` is part matching work

Interview answer:

- "We score each candidate using weighted distance, skill match, rating, and review count, then sort descending. We also keep neutral baselines for new technicians and incomplete data so the system stays fair."

### 16.2 Inventory reservation algorithm

Problem:

- prevent overselling under concurrent orders

Logic:

- validate stock
- inside transaction, increment reserved quantity only when stock condition still holds
- create reservation record

### 16.3 Return-window algorithm

Problem:

- allow returns only in a limited period

Logic:

- compare delivery/completion date to current time
- allow only inside configured window

### 16.4 Auto-refresh retry algorithm

Problem:

- access token expires while user is still using app

Logic:

- on `401`, attempt refresh once
- retry original request

## 17. Technology under the hood

### React

How it works internally:

- React keeps a virtual representation of UI
- when state changes, React re-renders component functions
- then React updates only changed DOM parts

Why used here:

- many interactive screens
- repeated state changes
- route-based dashboards

### JavaScript event loop

Simple meaning:

- JavaScript handles asynchronous work with callbacks, promises, and task queues instead of blocking everything

Project examples:

- fetch API calls
- socket events
- geolocation callbacks

### PostgreSQL

Why used:

- strong relational support, transactions, and consistency

### Prisma

Why used:

- schema-driven database access and safer team development

### Redis

Why used:

- fast in-memory geo lookups

### Socket.IO

Why used:

- easier real-time event system than building raw WebSocket behavior manually

### QR and UPI system

How it works:

- backend creates UPI payment string
- frontend renders QR
- external payment app scans it
- system records confirmation

## 18. Common bugs, failure cases, and edge cases

### Bug risk: landing emergency flow is not implemented

Symptom:

- frontend tries quick emergency request
- backend has no working endpoint

### Bug risk: payout status naming inconsistency

Observed issue:

- some logic treats `completed` and `settled` differently

### Bug risk: committed secrets

Impact:

- security exposure risk

### Bug risk: light test coverage

Observation:

- repo contains helper scripts and docs, but not a deep automated regression suite

### Edge case: Redis unavailable

Handling:

- ranking falls back to DB/Haversine logic

### Edge case: token expired

Handling:

- frontend retries after refresh

### Edge case: low or zero stock

Handling:

- backend throws stock error before reservation/order creation

### Edge case: technician has no reviews yet

Handling:

- matching algorithm gives baseline score instead of zero

### Edge case: missing delivery address

Handling:

- order creation requires either address or map pin

### Edge case: unauthorized socket access

Handling:

- socket helper checks role and ownership before allowing track/chat

## 19. Interview preparation

### Beginner questions

Q: What does `App.jsx` do in these dashboards?  
A: It defines route structure, session restore behavior, protected pages, and shared shell components.

Q: What is Prisma?  
A: It is an ORM. ORM means a tool that lets JavaScript code read and write database tables using objects and methods instead of raw SQL every time.

Q: Why is Redux used?  
A: For global state like logged-in user and cart that many components need.

Q: What is Socket.IO used for here?  
A: Live tracking, notifications, chat, and instant dashboard refresh.

### Intermediate questions

Q: How does the app avoid overselling inventory?  
A: It uses inventory reservations and increments `quantity_reserved` inside a transaction after checking availability.

Q: How does technician matching work?  
A: It combines distance, part skill overlap, rating, and review count into a weighted score, then sorts descending.

Q: Why are there separate dashboards instead of one giant app?  
A: Each role has very different screens, permissions, and workflows. Splitting apps reduces complexity and cross-role mistakes.

Q: Why keep vehicle company/model/variant as separate tables?  
A: It normalizes the data and keeps one clean source of truth.

### Advanced questions

Q: Why is Stripe webhook raw-body handling placed early?  
A: Because Stripe signature verification depends on exact raw payload bytes.

Q: Why keep Redis optional instead of required?  
A: It improves resilience. Core business flows still work when Redis is unavailable.

Q: Why create payout ledger records instead of only updating invoice/order tables?  
A: Because payment completion and payout settlement are different financial events.

Q: What concurrency risk exists in order creation?  
A: Multiple buyers may try to reserve the same stock. The transaction and guarded update reduce that risk.

### "Why this tech?" questions

Q: Why PostgreSQL?  
A: Strong relational support, transactions, and consistency for many linked entities.

Q: Why Prisma?  
A: Safer and faster team development with schema-based DB access.

Q: Why Socket.IO instead of polling?  
A: Polling is noisier and less real-time. Sockets are better for tracking and instant refresh.

### "What if we remove X?" questions

Q: What if Redis is removed?  
A: Nearby technician search still works through fallback logic, but performance becomes weaker.

Q: What if catalog system is removed?  
A: Vehicle selection, part lookup, and price mapping become inconsistent.

Q: What if auto-refresh logic is removed?  
A: Users would see more failed requests whenever tokens expire.

Q: What if inventory reservations are removed?  
A: Overselling risk becomes much higher.

## 20. Practical interview summary

You can say:

"This project is a multi-role roadside assistance and automotive parts platform. It has separate React dashboards for users, technicians, vendors, and admins, plus a shared Express backend. The backend uses Prisma with PostgreSQL for core relational data, optional Redis for fast nearby technician lookup, and Socket.IO for live tracking and dashboard refresh. Users create vehicle-linked service requests, technicians are ranked using a weighted matching algorithm, jobs move through tracked status transitions, vendors fulfill parts orders with inventory reservations to prevent overselling, and payments create payout ledger records so technician/vendor earnings and admin commissions can be handled clearly."

## 21. Best file-by-file study order

1. `backend/prisma/schema.prisma`
2. `backend/src/server.js`
3. `backend/src/socket.js`
4. `backend/src/modules/user/requests/requests.routes.js`
5. `backend/src/modules/technician/jobs/jobs.routes.js`
6. `backend/src/modules/user/orders/orders.routes.js`
7. `backend/src/modules/payments/payments.routes.js`
8. `user_dashboard/src/lib/api.js`
9. `user_dashboard/src/pages/UserRequestDetailPage.jsx`
10. `technician_dashboard/src/pages/TechnicianJobDetailPage.jsx`
11. `vender_dashboard/src/pages/VendorOrderDetailPage.jsx`
12. `admin_dashboard/src/pages/AdminDashboardPage.jsx`
13. `admin_dashboard/src/pages/AdminCarCatalogPage.jsx`

## 22. Final understanding checklist

After studying this guide, you should be able to answer:

- how login and refresh cookies work
- how a request becomes a job
- how a technician is ranked
- how live tracking is authorized
- how a part suggestion becomes a cart item
- how inventory reservation prevents overselling
- how an invoice is generated and paid
- how vendor order flow differs from technician job flow
- how admin can intervene
- why Prisma, Redis, Socket.IO, and QR payments were chosen

## 23. Most important findings from this audit

1. The project architecture is strong and thoughtfully separated by role.
2. The request -> technician -> job -> invoice path is the core service flow.
3. The order -> reservation -> fulfillment -> return path is the core commerce flow.
4. Redis is a performance enhancement, not a hard dependency.
5. Payment and payout logic is rich but also one of the highest-risk areas.
6. The landing page emergency quick request flow is incomplete because backend support is missing.
7. Payout status naming appears inconsistent in places and should be normalized.
8. Secrets committed in `backend/.env` should be rotated.
9. Automated regression coverage is lighter than the complexity of the platform suggests.

## 24. Closing summary in very simple words

This project is really two big systems joined together:

- a roadside service system
- a parts ordering and logistics system

The technical backbone is:

- React on the frontend
- Express on the backend
- Prisma + PostgreSQL for data
- Redis for fast nearby search
- Socket.IO for live updates
- UPI/Stripe/Razorpay flows for money

If you can explain the request flow, order flow, payment flow, and why the database models are structured this way, you will already sound strong in an interview.
