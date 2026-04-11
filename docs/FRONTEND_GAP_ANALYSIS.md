# Frontend Gap Analysis — Quick Auto Assist

> Full audit of all 4 frontend dashboards (60 pages total) against the backend API.  
> Generated from reading every `App.jsx`, `api.js`, and page component across the workspace.

---

## Table of Contents

1. [User Dashboard (17 pages)](#1-user-dashboard)
2. [Technician Dashboard (13 pages)](#2-technician-dashboard)
3. [Vendor Dashboard (10 pages)](#3-vendor-dashboard)
4. [Admin Dashboard (20 pages)](#4-admin-dashboard)
5. [Cross-Cutting Gaps Summary](#5-cross-cutting-gaps-summary)
6. [Unused API Functions Per Dashboard](#6-unused-api-functions-per-dashboard)
7. [Missing Frontend Features (Backend Exists, No UI)](#7-missing-frontend-features)
8. [Recommendations](#8-recommendations)

---

## 1. User Dashboard

**App:** `user_dashboard/` — 17 pages  
**Auth prefix:** `/auth` — cookie `token` / `refreshToken`

| # | Route | Page | API Calls on Load | User Actions |
|---|-------|------|-------------------|--------------|
| 1 | `/auth/user/signin` | UserSignInPage | — | `userSignIn()` → `getMyProfile()` → Redux → `/dashboard` |
| 2 | `/auth/user/signup` | UserSignUpPage | — | `userSignUp()` → redirect to sign-in |
| 3 | `/auth/user/forgot-password` | UserForgotPasswordPage | — | `POST /auth/forgot-password` |
| 4 | `/auth/user/reset-password` | UserResetPasswordPage | — | `POST /auth/reset-password` → auto-redirect 3s |
| 5 | `/dashboard` | UserDashboardPage | None (Redux) | Nav cards to all sections · `userLogout()` |
| 6 | `/requests` | UserRequestsPage | `getServiceRequests({page,limit,status})` | Status filter · Pagination |
| 7 | `/requests/new` | UserNewRequestPage | `getMyVehicles()` | Form: vehicle, issue_type, description, LocationPicker, service_location_type, requires_towing → `createServiceRequest()` |
| 8 | `/requests/:requestId` | UserRequestDetailPage | `getServiceRequestById()` + `getRequestOffers()` | `acceptOffer()` · `rejectOffer()` · `cancelServiceRequest()` · Open Messages |
| 9 | `/orders` | UserOrdersPage | `getOrders({page,limit,status})` | Status filter · Pagination |
| 10 | `/orders/:orderId` | UserOrderDetailPage | `getOrderById()` + `getOrderFulfillment()` | Pay form → `payOrder()` |
| 11 | `/invoices/:invoiceId` | UserInvoiceDetailPage | `getInvoiceById()` | Pay form → `payInvoice()` · PDF download |
| 12 | `/jobs` | UserJobsPage | `getJobs({page,limit})` | Pagination |
| 13 | `/jobs/:jobId` | UserJobDetailPage | `getJobById()` | Review form (1-5 stars + comment) → `createReview()` · Messages link |
| 14 | `/reviews` | UserReviewsPage | `getReviews({page,limit})` | Pagination |
| 15 | `/requests/:requestId/messages` | UserMessagesPage | `getRequestMessages()` (10s poll) | `sendRequestMessage()` · Auto-scroll chat |
| 16 | `/profile` | UserProfilePage | `getMyProfile()` | Edit full_name/phone → `updateMyProfile()` |
| 17 | `/vehicles` | UserVehiclesPage | `getMyVehicles()` + `getVehicleVariants()` | Add/Edit/Delete vehicles with variant search |

### User Dashboard — Gaps Found

| Gap | Severity | Details |
|-----|----------|---------|
| **No account deletion UI** | 🔴 HIGH | Backend has `DELETE /profile` (soft-delete + deactivate + clear cookies). No frontend button exists anywhere. |
| **No parts reservation UI** | 🟡 MEDIUM | Backend has `POST /orders/reserve-parts` for inventory reservation. No frontend page or flow calls it. |
| **Dashboard loads no data** | 🟡 MEDIUM | UserDashboardPage shows nav cards only — no stats, no recent activity. Other dashboards (tech, vendor, admin) all fetch summary data on load. |

---

## 2. Technician Dashboard

**App:** `technician_dashboard/` — 13 pages  
**Auth prefix:** `/tech/auth` — cookie `tech_token` / `tech_refreshToken`

| # | Route | Page | API Calls on Load | User Actions |
|---|-------|------|-------------------|--------------|
| 1 | `/auth/technician/signin` | TechnicianSignInPage | — | `technicianSignIn()` → `getTechnicianProfile()` → role check → Redux |
| 2 | `/auth/technician/signup` | TechnicianSignUpPage | — | Form: name, email, phone, pw, business_name, technician_type, LocationPicker, service_radius → `technicianSignUp()` |
| 3 | `/auth/technician/forgot-password` | TechnicianForgotPasswordPage | — | `POST /tech/auth/forgot-password` |
| 4 | `/auth/technician/reset-password` | TechnicianResetPasswordPage | — | `POST /tech/auth/reset-password` → auto-redirect 3s |
| 5 | `/dashboard` | TechnicianDashboardPage | `getTechnicianProfile()` + `getPendingAssignments()` + `getJobs(1,1,'in_progress')` + `getEarnings()` | Online/Offline toggle → `updateAvailability()` · Quick links · `technicianLogout()` |
| 6 | `/profile` | TechnicianProfilePage | `getTechnicianProfile()` | Edit business_name, type, location, radius → `updateTechnicianProfile()` · `addCertification()` / `deleteCertification()` |
| 7 | `/offers` | TechnicianOffersPage | `getOffers(page, 20)` | Create offer form (manual request_id, repair_mode, cost, time, message) → `createOffer()` |
| 8 | `/discover` | TechnicianDiscoverPage | `getOpenRequests(page, 12)` | List + Map view (Leaflet) · Submit Offer modal → `createOffer()` |
| 9 | `/assignments` | TechnicianAssignmentsPage | `getPendingAssignments()` | `acceptAssignment(jobId)` · `rejectAssignment(jobId)` |
| 10 | `/jobs` | TechnicianJobsPage | `getJobs(page, 20, statusFilter)` | Status filter (All/Assigned/In Progress/Completed) |
| 11 | `/jobs/:jobId` | TechnicianJobDetailPage | `getJobById()` | Start Job → `updateJobStatus('in_progress')` · Suggest Parts → `suggestParts()` · Complete → `completeJob()` · Create Invoice form → `createInvoice()` · PDF download · Chat link |
| 12 | `/earnings` | TechnicianEarningsPage | `getEarnings()` | Recharts: Earned vs Pending bar, Invoice Status pie, Earnings by Issue Type bar |
| 13 | `/messages/:requestId` | TechnicianMessagesPage | `getRequestMessages(requestId, 1, 100)` (8s poll) | `sendRequestMessage()` · Auto-scroll |

### Technician Dashboard — Gaps Found

| Gap | Severity | Details |
|-----|----------|---------|
| **`updateLocation` never called** | 🔴 HIGH | `POST /tech/location` backend endpoint exists. `updateLocation()` defined in api.js. **No page calls it.** Real-time location tracking for technicians is completely missing. |
| **`getPendingOffers` never called** | 🟡 MEDIUM | `GET /tech/offers/pending` exists. api.js has `getPendingOffers()`. Offers page uses `getOffers` (all offers) instead — no filtered pending-only view. |
| **`getOfferById` never called** | 🟢 LOW | `GET /tech/offers/:id` exists. No offer detail page. Offers shown in list only. |
| **`getOpenRequestDetail` never called** | 🟢 LOW | `GET /tech/discover/:id` exists. Discover page shows all details inline in the card — no separate detail view. |
| **No account deletion** | 🟡 MEDIUM | Technician cannot delete their account from the UI. |

---

## 3. Vendor Dashboard

**App:** `vender_dashboard/` — 10 pages  
**Auth prefix:** `/vendor/auth` — cookie `vendor_token` / `vendor_refreshToken`

| # | Route | Page | API Calls on Load | User Actions |
|---|-------|------|-------------------|--------------|
| 1 | `/auth/vendor/signin` | VendorSignInPage | — | `vendorSignIn()` → `getWarehouses(1,5)` (session check only, no profile fetch) → Redux sets `{email, role:'vendor'}` |
| 2 | `/auth/vendor/signup` | VendorSignUpPage | — | Form: full_name, email, phone, pw → `vendorSignUp()` |
| 3 | `/auth/vendor/forgot-password` | VendorForgotPasswordPage | — | `POST /vendor/auth/forgot-password` |
| 4 | `/auth/vendor/reset-password` | VendorResetPasswordPage | — | `POST /vendor/auth/reset-password` → auto-redirect 3s |
| 5 | `/dashboard` | VendorDashboardPage | `getRevenueAnalytics()` + `getOrderAnalytics()` + `getInventoryAnalytics()` + `getWarehouses(1,1)` | Stat cards · Quick links · `vendorLogout()` |
| 6 | `/warehouses` | VendorWarehousesPage | `getWarehouses(page, 10)` | Create/Edit form (name, address, city, state, postal, phone, LocationPicker) → `createWarehouse()` / `updateWarehouse()` · Deactivate → `deleteWarehouse()` |
| 7 | `/warehouses/:warehouseId/inventory` | VendorInventoryPage | `getInventory(warehouseId, page, 20, lowStockOnly)` | Low stock filter · Add/Edit form (part_id, qty, unit_cost, reorder_level) → `addInventory()` / `updateInventory()` · `deleteInventory()` |
| 8 | `/orders` | VendorOrdersPage | `getOrders(page, 15, {order_status})` | 8 status filter buttons · Pagination |
| 9 | `/orders/:orderId` | VendorOrderDetailPage | `getOrderById()` + `getOrderFulfillments()` | `confirmOrder()` · `cancelOrder()` · `returnOrder(reason)` · Fulfillment status updates → `updateFulfillmentStatus()` (tracking, carrier, delivery, notes) |
| 10 | `/analytics` | VendorAnalyticsPage | `getRevenueAnalytics(from,to)` + `getOrderAnalytics(from,to)` + `getInventoryAnalytics()` | Date range filter · Recharts: revenue bar, order status pie, payment pie, inventory bar |

### Vendor Dashboard — Gaps Found

| Gap | Severity | Details |
|-----|----------|---------|
| **No vendor profile page** | 🔴 HIGH | Vendor cannot view or update their own name, phone, or account info. No profile management exists. Other dashboards (user, tech) have profile pages. |
| **No reservations page** | 🔴 HIGH | `getReservations()` and `getReservationById()` defined in api.js. Backend has `GET /vendor/warehouses/:id/reservations` and `GET /vendor/reservations/:id`. **No dedicated page or view.** Reservations only appear inline in order detail as a small section. |
| **`bulkUpsertInventory` never called** | 🟡 MEDIUM | `POST /vendor/warehouses/:id/inventory/bulk` exists. api.js has the function. **No bulk import/upload UI.** Inventory is managed one item at a time. |
| **`getWarehouseById` never called** | 🟢 LOW | `GET /vendor/warehouses/:id` exists. No standalone warehouse detail page — warehouses listed inline only. |
| **`getLowStockItems` never called** | 🟡 MEDIUM | `GET /vendor/warehouses/:id/low-stock` backend endpoint exists. api.js has the function. Inventory page uses `getInventory` with `lowStockOnly` flag instead — this dedicated low-stock endpoint with threshold support is unused. |
| **Weak session bootstrap** | 🟡 MEDIUM | Sign-in doesn't fetch vendor profile — just sets `{email, role:'vendor'}` in Redux. The user's name is never loaded into the app state (unlike user/tech dashboards). |
| **No account deletion** | 🟡 MEDIUM | Vendor cannot delete their account. |

---

## 4. Admin Dashboard

**App:** `admin_dashboard/` — 20 pages  
**Auth prefix:** `/admin/auth` — cookie `admin_token` / `admin_refreshToken`

| # | Route | Page | API Calls on Load | User Actions |
|---|-------|------|-------------------|--------------|
| 1 | `/admin/login` | AdminLoginPage | — | `adminSignIn()` → `getDashboard()` → Redux snapshot |
| 2 | `/admin/dashboard` | AdminDashboardPage | `getDashboard()` | Stats: users, techs, vendors, warehouses, requests, jobs, orders, invoices · Recent requests · 10 quick links · `adminLogout()` |
| 3 | `/admin/users` | AdminUsersPage | `getUsers({page,limit,search,role,is_active})` | Search + role/active filters · `blockUser()` · `unblockUser()` · `deleteUser()` |
| 4 | `/admin/users/:userId` | AdminUserDetailPage | `getUserById()` | User details · Vehicles · Tech profile link · `blockUser()` · `unblockUser()` · `deleteUser()` |
| 5 | `/admin/technicians` | AdminTechniciansPage | `getTechnicians({page,limit,search,is_verified,is_online,technician_type})` | Multi-filter table · `verifyTechnician()` · `suspendTechnician()` · `unsuspendTechnician()` |
| 6 | `/admin/technicians/:techId` | AdminTechnicianDetailPage | `getTechnicianById()` + `getTechnicianJobs({page,limit})` | Full profile + certs/carSupports/partSkills/resources · Jobs table · `verifyTechnician()` · `suspendTechnician()` · `unsuspendTechnician()` |
| 7 | `/admin/vendors` | AdminVendorsPage | `getVendors({page,limit,search,is_active})` | Search + active filter · `suspendVendor()` · `unsuspendVendor()` |
| 8 | `/admin/vendors/:vendorId` | AdminVendorDetailPage | `getVendorById()` + `getVendorWarehouses(vendorId,{page,limit})` | Vendor info + warehouses table · `suspendVendor()` · `unsuspendVendor()` |
| 9 | `/admin/warehouses` | AdminWarehousesPage | `getWarehouses({page,limit,search,city,state})` | Search + city/state filters |
| 10 | `/admin/warehouses/:warehouseId` | AdminWarehouseDetailPage | `getWarehouseById()` + `getWarehouseInventory({page,limit})` | Warehouse info + inventory table |
| 11 | `/admin/requests` | AdminRequestsPage | `getRequests({page,limit,status,issue_type})` | Status + issue type filters |
| 12 | `/admin/requests/:requestId` | AdminRequestDetailPage | `getRequestById()` | `cancelRequest()` · Force Assign form (technician_id, repair_mode, cost, time) → `forceAssignTechnician()` · Shows offers table, job, parts, media, messages |
| 13 | `/admin/jobs` | AdminJobsPage | `getJobs({page,limit,status})` | Status filter |
| 14 | `/admin/jobs/:jobId` | AdminJobDetailPage | `getJobById()` | View only — tech, request, offer, timeline, parts, invoice (links to detail pages) |
| 15 | `/admin/orders` | AdminOrdersPage | `getOrders({page,limit,order_status,payment_status})` | Order status + payment status filters |
| 16 | `/admin/orders/:orderId` | AdminOrderDetailPage | `getOrderById()` | `refundOrder(reason)` · Shows items, fulfillments, reservations |
| 17 | `/admin/invoices` | AdminInvoicesPage | `getInvoices({page,limit,payment_status})` | Payment status filter · `markInvoicePaid()` |
| 18 | `/admin/invoices/:invoiceId` | AdminInvoiceDetailPage | `getInvoiceById()` | `markInvoicePaid()` · PDF download · Shows job info, line items, dates |
| 19 | `/admin/analytics` | AdminAnalyticsPage | `getRevenueAnalytics()` + `getMatchingAnalytics()` + `getPerformanceAnalytics()` | Date range + granularity filter · Revenue bar chart · Request status pie · Top technicians bar + table |
| 20 | `/admin/audit-logs` | AdminAuditLogsPage | `getAuditLogs({page,limit,entity_type,action,performed_by,from,to})` | Entity type + action + performer + date range filters |

### Admin Dashboard — Gaps Found

| Gap | Severity | Details |
|-----|----------|---------|
| **`getAdminDashboard` is dead code** | 🟢 LOW | api.js defines both `getDashboard` and `getAdminDashboard` pointing to the same endpoint. Only `getDashboard` is used. `getAdminDashboard` is never imported anywhere. |
| **Job detail is read-only** | 🟢 LOW | Admin can view job details but cannot take any action on jobs (no status update, no cancel). This may be by design. |
| **No admin profile management** | 🟢 LOW | Admin cannot change their own password or profile. Admin accounts are created manually. Expected for admin-only access. |

---

## 5. Cross-Cutting Gaps Summary

### Architecture & Auth Patterns

| Issue | Dashboards Affected | Details |
|-------|---------------------|---------|
| **Inconsistent session bootstrap** | Vendor | User dashboard fetches `getMyProfile()` on sign-in. Tech fetches `getTechnicianProfile()`. Vendor only calls `getWarehouses(1,5)` and stores `{email, role}` — vendor's name is never in Redux. |
| **No WebSocket / real-time** | All | Messages use polling (user: 10s, tech: 8s). No WebSocket for instant messaging, live location, or push notifications. |
| **No global error toasts** | All | Errors are shown per-page via inline state. No centralized notification/toast system. |
| **No loading skeletons** | All | All pages show "Loading…" text. No skeleton/shimmer UI for better perceived performance. |

### Missing Cross-Dashboard Features

| Feature | Status |
|---------|--------|
| **Account deletion** | Backend `DELETE /profile` exists for users. No UI in any dashboard. Technicians and vendors have no delete endpoint at all. |
| **Email verification flow** | Auth routes include `POST /auth/verify-email` and `POST /auth/resend-verification`. No frontend page handles this. |
| **Password change (while logged in)** | No dashboard has an in-app password change form. Users must use forgot-password flow. |
| **Notification system** | No notifications UI in any dashboard. No in-app alerts for new offers, assignments, order updates, etc. |
| **Mobile responsiveness** | All pages use Tailwind responsive classes (sm:/lg:) but no dedicated mobile navigation (hamburger menu, bottom nav). |

---

## 6. Unused API Functions Per Dashboard

### User Dashboard (`user_dashboard/src/lib/api.js`)

| Function | Endpoint | Used? |
|----------|----------|-------|
| `userSignIn` | `POST /auth/signin` | ✅ |
| `userSignUp` | `POST /auth/signup` | ✅ |
| `userLogout` | `POST /auth/logout` | ✅ |
| `refreshSession` | `POST /auth/refresh` | ✅ (auto) |
| `getMyProfile` | `GET /profile` | ✅ |
| `updateMyProfile` | `PUT /profile` | ✅ |
| `getVehicleVariants` | `GET /vehicles/variants` | ✅ |
| `getMyVehicles` | `GET /vehicles` | ✅ |
| `addVehicle` | `POST /vehicles` | ✅ |
| `updateVehicle` | `PUT /vehicles/:id` | ✅ |
| `deleteVehicle` | `DELETE /vehicles/:id` | ✅ |
| `createServiceRequest` | `POST /requests` | ✅ |
| `getServiceRequests` | `GET /requests` | ✅ |
| `getServiceRequestById` | `GET /requests/:id` | ✅ |
| `cancelServiceRequest` | `PATCH /requests/:id/cancel` | ✅ |
| `getRequestOffers` | `GET /requests/:id/offers` | ✅ |
| `acceptOffer` | `PATCH /offers/:id/accept` | ✅ |
| `rejectOffer` | `PATCH /offers/:id/reject` | ✅ |
| `getOrders` | `GET /orders` | ✅ |
| `getOrderById` | `GET /orders/:id` | ✅ |
| `payOrder` | `POST /orders/:id/pay` | ✅ |
| `getOrderFulfillment` | `GET /orders/:id/fulfillment` | ✅ |
| `getInvoiceById` | `GET /invoices/:id` | ✅ |
| `payInvoice` | `POST /invoices/:id/pay` | ✅ |
| `getJobs` | `GET /jobs` | ✅ |
| `getJobById` | `GET /jobs/:id` | ✅ |
| `getReviews` | `GET /reviews` | ✅ |
| `createReview` | `POST /reviews` | ✅ |
| `getRequestMessages` | `GET /requests/:id/messages` | ✅ |
| `sendRequestMessage` | `POST /requests/:id/messages` | ✅ |

**Result: All api.js functions are used. ✅**  
**But: Backend has `DELETE /profile` and `POST /orders/reserve-parts` with no api.js wrapper or UI.**

---

### Technician Dashboard (`technician_dashboard/src/lib/api.js`)

| Function | Endpoint | Used? |
|----------|----------|-------|
| `technicianSignIn` | `POST /tech/auth/signin` | ✅ |
| `technicianSignUp` | `POST /tech/auth/signup` | ✅ |
| `technicianLogout` | `POST /tech/auth/logout` | ✅ |
| `refreshSession` | `POST /tech/auth/refresh` | ✅ (auto) |
| `getTechnicianProfile` | `GET /tech/profile` | ✅ |
| `updateTechnicianProfile` | `PUT /tech/profile` | ✅ |
| `addCertification` | `POST /tech/profile/certifications` | ✅ |
| `deleteCertification` | `DELETE /tech/profile/certifications/:id` | ✅ |
| `updateAvailability` | `PATCH /tech/availability` | ✅ |
| `getOffers` | `GET /tech/offers` | ✅ |
| `getOfferById` | `GET /tech/offers/:id` | ❌ **UNUSED** |
| `createOffer` | `POST /tech/offers` | ✅ |
| `getPendingOffers` | `GET /tech/offers/pending` | ❌ **UNUSED** |
| `getPendingAssignments` | `GET /tech/assignments/pending` | ✅ |
| `acceptAssignment` | `POST /tech/assignments/:id/accept` | ✅ |
| `rejectAssignment` | `POST /tech/assignments/:id/reject` | ✅ |
| `getJobs` | `GET /tech/jobs` | ✅ |
| `getJobById` | `GET /tech/jobs/:id` | ✅ |
| `updateJobStatus` | `PATCH /tech/jobs/:id/status` | ✅ |
| `suggestParts` | `POST /tech/jobs/:id/suggest-parts` | ✅ |
| `completeJob` | `POST /tech/jobs/:id/complete` | ✅ |
| `createInvoice` | `POST /tech/jobs/:id/invoice` | ✅ |
| `getEarnings` | `GET /tech/earnings` | ✅ |
| `updateLocation` | `POST /tech/location` | ❌ **UNUSED** |
| `getRequestMessages` | `GET /tech/requests/:id/messages` | ✅ |
| `sendRequestMessage` | `POST /tech/requests/:id/messages` | ✅ |
| `getOpenRequests` | `GET /tech/discover` | ✅ |
| `getOpenRequestDetail` | `GET /tech/discover/:id` | ❌ **UNUSED** |

**Result: 4 functions unused — `getOfferById`, `getPendingOffers`, `updateLocation`, `getOpenRequestDetail`**

---

### Vendor Dashboard (`vender_dashboard/src/lib/api.js`)

| Function | Endpoint | Used? |
|----------|----------|-------|
| `vendorSignIn` | `POST /vendor/auth/signin` | ✅ |
| `vendorSignUp` | `POST /vendor/auth/signup` | ✅ |
| `vendorLogout` | `POST /vendor/auth/logout` | ✅ |
| `refreshSession` | `POST /vendor/auth/refresh` | ✅ (auto) |
| `getWarehouses` | `GET /vendor/warehouses` | ✅ |
| `getWarehouseById` | `GET /vendor/warehouses/:id` | ❌ **UNUSED** |
| `createWarehouse` | `POST /vendor/warehouses` | ✅ |
| `updateWarehouse` | `PUT /vendor/warehouses/:id` | ✅ |
| `deleteWarehouse` | `DELETE /vendor/warehouses/:id` | ✅ |
| `getInventory` | `GET /vendor/warehouses/:id/inventory` | ✅ |
| `addInventory` | `POST /vendor/warehouses/:id/inventory` | ✅ |
| `updateInventory` | `PUT /vendor/inventory/:id` | ✅ |
| `deleteInventory` | `DELETE /vendor/inventory/:id` | ✅ |
| `bulkUpsertInventory` | `POST /vendor/warehouses/:id/inventory/bulk` | ❌ **UNUSED** |
| `getReservations` | `GET /vendor/warehouses/:id/reservations` | ❌ **UNUSED** |
| `getReservationById` | `GET /vendor/reservations/:id` | ❌ **UNUSED** |
| `getOrders` | `GET /vendor/orders` | ✅ |
| `getOrderById` | `GET /vendor/orders/:id` | ✅ |
| `confirmOrder` | `PATCH /vendor/orders/:id/confirm` | ✅ |
| `cancelOrder` | `PATCH /vendor/orders/:id/cancel` | ✅ |
| `returnOrder` | `POST /vendor/orders/:id/return` | ✅ |
| `getOrderFulfillments` | `GET /vendor/orders/:id/fulfillment` | ✅ |
| `updateFulfillmentStatus` | `PATCH /vendor/fulfillment/:id/status` | ✅ |
| `getRevenueAnalytics` | `GET /vendor/analytics/revenue` | ✅ |
| `getOrderAnalytics` | `GET /vendor/analytics/orders` | ✅ |
| `getInventoryAnalytics` | `GET /vendor/analytics/inventory` | ✅ |
| `getLowStockItems` | `GET /vendor/warehouses/:id/low-stock` | ❌ **UNUSED** |

**Result: 5 functions unused — `getWarehouseById`, `bulkUpsertInventory`, `getReservations`, `getReservationById`, `getLowStockItems`**

---

### Admin Dashboard (`admin_dashboard/src/lib/api.js`)

| Function | Endpoint | Used? |
|----------|----------|-------|
| `adminSignIn` | `POST /admin/auth/signin` | ✅ |
| `adminLogout` | `POST /admin/auth/logout` | ✅ |
| `refreshSession` | `POST /admin/auth/refresh` | ✅ (auto) |
| `getDashboard` | `GET /admin/dashboard` | ✅ |
| `getAdminDashboard` | `GET /admin/dashboard` | ❌ **DEAD CODE** (duplicate of getDashboard) |
| `getUsers` | `GET /admin/users` | ✅ |
| `getUserById` | `GET /admin/users/:id` | ✅ |
| `blockUser` | `PATCH /admin/users/:id/block` | ✅ |
| `unblockUser` | `PATCH /admin/users/:id/unblock` | ✅ |
| `deleteUser` | `DELETE /admin/users/:id` | ✅ |
| `getTechnicians` | `GET /admin/technicians` | ✅ |
| `getTechnicianById` | `GET /admin/technicians/:id` | ✅ |
| `verifyTechnician` | `PATCH /admin/technicians/:id/verify` | ✅ |
| `suspendTechnician` | `PATCH /admin/technicians/:id/suspend` | ✅ |
| `unsuspendTechnician` | `PATCH /admin/technicians/:id/unsuspend` | ✅ |
| `getTechnicianJobs` | `GET /admin/technicians/:id/jobs` | ✅ |
| `getVendors` | `GET /admin/vendors` | ✅ |
| `getVendorById` | `GET /admin/vendors/:id` | ✅ |
| `suspendVendor` | `PATCH /admin/vendors/:id/suspend` | ✅ |
| `unsuspendVendor` | `PATCH /admin/vendors/:id/unsuspend` | ✅ |
| `getVendorWarehouses` | `GET /admin/vendors/:id/warehouses` | ✅ |
| `getWarehouses` | `GET /admin/warehouses` | ✅ |
| `getWarehouseById` | `GET /admin/warehouses/:id` | ✅ |
| `getWarehouseInventory` | `GET /admin/warehouses/:id/inventory` | ✅ |
| `getRequests` | `GET /admin/requests` | ✅ |
| `getRequestById` | `GET /admin/requests/:id` | ✅ |
| `cancelRequest` | `PATCH /admin/requests/:id/cancel` | ✅ |
| `forceAssignTechnician` | `POST /admin/requests/:id/force-assign` | ✅ |
| `getJobs` | `GET /admin/jobs` | ✅ |
| `getJobById` | `GET /admin/jobs/:id` | ✅ |
| `getOrders` | `GET /admin/orders` | ✅ |
| `getOrderById` | `GET /admin/orders/:id` | ✅ |
| `refundOrder` | `POST /admin/orders/:id/refund` | ✅ |
| `getInvoices` | `GET /admin/invoices` | ✅ |
| `getInvoiceById` | `GET /admin/invoices/:id` | ✅ |
| `markInvoicePaid` | `PATCH /admin/invoices/:id/mark-paid` | ✅ |
| `getRevenueAnalytics` | `GET /admin/analytics/revenue` | ✅ |
| `getMatchingAnalytics` | `GET /admin/analytics/matching` | ✅ |
| `getPerformanceAnalytics` | `GET /admin/analytics/performance` | ✅ |
| `getAuditLogs` | `GET /admin/audit-logs` | ✅ |

**Result: 1 dead code function (`getAdminDashboard`). All others used. ✅**

---

## 7. Missing Frontend Features

### Backend endpoints with NO frontend wrapper or UI

| Backend Route | Method | Description | Which Frontend Should Have It |
|---------------|--------|-------------|-------------------------------|
| `DELETE /profile` | DELETE | Soft-delete user account | User Dashboard — account settings/deletion |
| `POST /orders/reserve-parts` | POST | Reserve inventory parts before order | User Dashboard — during order creation flow |
| `POST /auth/verify-email` | POST | Verify email with token | User Dashboard — post-signup email verification |
| `POST /auth/resend-verification` | POST | Resend verification email | User Dashboard — resend email page |

### Features with api.js function defined but no UI

| Dashboard | Function | What's Missing |
|-----------|----------|---------------|
| Technician | `updateLocation` | Live GPS location update — should auto-send on discover/jobs pages |
| Technician | `getPendingOffers` | Pending offers badge/tab on Offers page |
| Technician | `getOfferById` | Offer detail view (modal or page) |
| Vendor | `bulkUpsertInventory` | CSV/bulk import UI on inventory page |
| Vendor | `getReservations` / `getReservationById` | Dedicated reservations dashboard page |
| Vendor | `getLowStockItems` | Dedicated low-stock alerts page with threshold control |
| Vendor | `getWarehouseById` | Warehouse detail page (currently inline only) |

---

## 8. Recommendations

### Priority 1 — Critical Missing Features

1. **Vendor Profile Page** — Create `/profile` route in vendor_dashboard with name/phone/business info editing. Requires backend `GET/PUT /vendor/profile` endpoints (currently missing from backend too).

2. **Technician Live Location** — Implement `updateLocation()` call via browser Geolocation API on the discover/jobs pages. Background interval or movement-based tracking. This is essential for a roadside assistance platform.

3. **User Account Deletion** — Add "Delete Account" button on UserProfilePage calling `DELETE /profile`. Add api.js wrapper function.

4. **Vendor Reservations Page** — Create `/reservations` route showing active inventory reservations with status tracking.

### Priority 2 — UX Improvements

5. **User Dashboard Stats** — Fetch summary data on UserDashboardPage (active requests, pending orders, recent jobs) similar to tech/vendor/admin dashboards.

6. **Bulk Inventory Import** — Add CSV upload UI on VendorInventoryPage calling `bulkUpsertInventory()`.

7. **Pending Offers Badge** — Use `getPendingOffers()` on technician dashboard to show pending count badge.

8. **Low-Stock Alerts Widget** — Use `getLowStockItems()` on vendor dashboard for a prominent low-stock warning section with configurable threshold.

### Priority 3 — Technical Debt

9. **Remove `getAdminDashboard`** — Dead code in admin api.js. Use only `getDashboard`.

10. **Fix Vendor Session Bootstrap** — After `vendorSignIn()`, fetch vendor profile to populate full name in Redux state.

11. **Email Verification Flow** — Add post-signup verification page in user_dashboard.

12. **Consistent Polling → WebSocket** — Replace 8-10s message polling with WebSocket for real-time chat across all dashboards.

---

*Audit covers 60 pages across 4 apps, 133 backend route definitions, and all 4 api.js files.*
