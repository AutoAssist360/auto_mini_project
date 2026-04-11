# Quick Auto Assist - End-to-End Test Cases & Flow Verification

This document covers **every major flow**, **edge case**, and **how each is handled** in the system.

---

## Table of Contents
1. [Complete Flow Overview](#1-complete-flow-overview)
2. [Authentication Test Cases](#2-authentication-test-cases)
3. [User Request Flow Test Cases](#3-user-request-flow-test-cases)
4. [Technician Discovery & Offers](#4-technician-discovery--offers)
5. [Job Lifecycle Test Cases](#5-job-lifecycle-test-cases)
6. [Parts Ordering & Vendor Flow](#6-parts-ordering--vendor-flow)
7. [Invoice & Payment Flow](#7-invoice--payment-flow)
8. [Communication Test Cases](#8-communication-test-cases)
9. [Admin Operations Test Cases](#9-admin-operations-test-cases)
10. [Edge Cases & Error Handling](#10-edge-cases--error-handling)

---

## 1. Complete Flow Overview

```
User creates breakdown request
        ↓
Request status → "created" → "pending_offers"
        ↓
Technicians discovered (sorted by: skills → rating → distance)
        ↓
Technician submits offer (repair mode, cost, ETA)
        ↓
User accepts offer → Offer status "accepted"
        ↓
Job created → status "assigned"
        ↓
Technician accepts assignment → starts job → "in_progress"
        ↓
(Optional) Technician suggests parts needed
        ↓
(Optional) User orders parts from vendor
        ↓
(Optional) Vendor confirms → processes → ships → delivered
        ↓
Technician completes job → "completed"
        ↓
Admin verifies job → "verified"
        ↓
Technician creates invoice (with line items + tax)
        ↓
User pays invoice → payment_status "completed"
        ↓
User leaves review → end of flow
```

---

## 2. Authentication Test Cases

### TC-2.1: User Signup
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | POST /auth/signup with valid data | 201, account created | Zod validation + bcrypt hashing + unique email/phone check |
| 2 | Signup with existing email | 409 "email already exists" | `prisma.user.findFirst({ OR: [{ email }, { phone_number }] })` |
| 3 | Signup with weak password (<8 chars) | 400 validation error | Zod `.min(8)` schema on password |

### TC-2.2: User Signin
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Valid email + password | 200, httpOnly cookie set | `bcrypt.compare()` + `setAuthCookies()` with accessToken + refreshToken |
| 2 | Wrong password | 401 "Invalid email or password" | Generic message prevents email enumeration |
| 3 | Deleted account login | 403 "Account has been deleted" | Checks `user.deleted_at` before allowing login |
| 4 | Suspended account | 403 "Account has been suspended" | Checks `user.is_active` flag |

### TC-2.3: Session Persistence & Auto-Refresh
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Access token expired, refresh valid | Auto-refreshes silently, retries request | Frontend `apiRequest()` catches 401, calls `/auth/refresh`, retries with `_retried` flag |
| 2 | Both tokens expired | Redirect to login | `clearAuth()` dispatched, `<RequireAuth>` redirects |
| 3 | Close browser, reopen | Session restored from cookies | `checkSession()` in `App.jsx useEffect` calls `getMyProfile()` on mount |

### TC-2.4: Forgot/Reset Password
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | POST /auth/forgot-password with valid email | Always returns success (anti-enumeration) | `generateResetToken()` → email with reset URL |
| 2 | Non-existent email | Same success message | Prevents email enumeration attacks |
| 3 | Valid reset token + new password | Password updated, asked to re-login | `verifyResetToken()` → `bcrypt.hash()` → update |
| 4 | Expired/invalid reset token | 400 error | JWT expiry check in `verifyResetToken()` |

### TC-2.5: Change Password (All Roles)
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Correct current + new password | Updated, cookies cleared (force re-login) | Backend: `POST /auth/change-password`, `/tech/auth/change-password`, `/vendor/auth/change-password` |
| 2 | Wrong current password | 401 "Current password is incorrect" | `bcrypt.compare()` validates current password first |

### TC-2.6: Technician Signup (Extended)
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Signup with location, type, radius | User + TechnicianProfile created atomically | `prisma.$transaction` creates both User and TechnicianProfile |
| 2 | Duplicate phone number | 409 error | Same findFirst check as user signup |

### TC-2.7: Vendor Signup
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Valid vendor signup | 201, role=vendor | Creates User with role "vendor" |

---

## 3. User Request Flow Test Cases

### TC-3.1: Create Service Request
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | POST /requests with vehicle, issue, location | Request created with status "created" | Validates vehicle ownership, creates ServiceRequest |
| 2 | With GPS coordinates (lat/lng) | Location stored for distance-based discovery | latitude/longitude fields on ServiceRequest |
| 3 | Without a vehicle | 400 validation error | Zod requires `vehicle_id` |

### TC-3.2: User Views Requests
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | GET /requests | Paginated list, only user's own | `where: { user_id: req.userId }` filter |
| 2 | Filter by status | Filtered results | Optional `status` query param |

### TC-3.3: Request Cancellation
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Cancel before any offer accepted | Status → "cancelled" | Direct status update |
| 2 | Cancel after job started | Should not be allowed | Status transition validation prevents this |

---

## 4. Technician Discovery & Offers

### TC-4.1: Smart Discovery (Distance + Skills + Rating)
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | GET /tech/discover/open-requests?lat=X&lng=Y&radius=50 | Requests within radius, sorted by distance | `calculateDistance()` using Haversine formula in `geo.js` utility |
| 2 | Online-only technicians | Only is_online=true returned | `where: { is_online: true }` filter |
| 3 | Verified-only technicians | Only is_verified=true shown | Additional filter on discovery |
| 4 | Within service_radius | Only if distance < tech's service_radius | Geo calculation filters by service_radius |

### TC-4.2: Technician Submits Offer
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | POST /tech/offers with repair_mode, cost, time | Offer created with status "pending" | Zod-validated, creates TechnicianOffer |
| 2 | Offer on non-existent request | 404 error | Validates request exists |
| 3 | Duplicate offer (same tech, same request) | Prevented | Unique constraint on (technician_id, request_id) |
| 4 | repair_mode: "onsite" | Tech comes to user's location | Stored on offer, shown in job |
| 5 | repair_mode: "tow_to_garage" | Towing service arranged | Stored on offer — **this IS the towing edge case** |

### TC-4.3: User Reviews Offers
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | GET /requests/:id/offers | All pending offers for request | Includes technician profile + user details |
| 2 | Offers sorted by cost/rating | User can compare | Frontend renders all offers with details |

### TC-4.4: User Accepts/Rejects Offer
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | POST /offers/:id/accept | Offer→"accepted", Request→"offer_accepted", Job created | `$transaction`: accept offer, reject all others, create Job, update request status |
| 2 | All other pending offers | Auto-rejected | Transaction rejects all other offers for same request |
| 3 | POST /offers/:id/reject | Offer→"rejected" | Single offer rejected, others remain pending |
| 4 | Accept already accepted offer | 400 error | Status transition check |

---

## 5. Job Lifecycle Test Cases

### TC-5.1: Job Created from Accepted Offer
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Offer accepted | Job created with status "assigned" | `prisma.job.create()` in the accept-offer transaction |
| 2 | Job links to: request, offer, technician | All foreign keys set | job.request_id, job.offer_id, job.technician_id |

### TC-5.2: Technician Accepts Assignment
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | POST /tech/assignments/:jobId/accept | Assignment accepted | Checks tech doesn't have another active job (prevents multiple active jobs) |
| 2 | Tech already has active job | 400 error | `prisma.job.findFirst({ status: "in_progress" })` check |

### TC-5.3: Technician Rejects Assignment
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | POST /tech/assignments/:jobId/reject | Job soft-deleted, offer reverted, request status reverted | `$transaction`: soft-delete job, set offer→"rejected", set request→"pending_offers" |
| 2 | User can then accept another offer | Request is back to pending_offers | Status correctly reverted |

### TC-5.4: Job Status Transitions (Technician)
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | assigned → in_progress | `started_at` timestamp set, request→"in_progress" | `ALLOWED_TRANSITIONS` map + `$transaction` syncing both |
| 2 | in_progress → completed | `completed_at` timestamp set, request→"completed" | Same transition map + transaction |
| 3 | assigned → completed (skip) | 400 error | Not in ALLOWED_TRANSITIONS |
| 4 | completed → in_progress (reverse) | 400 error | Transition map only allows forward |

### TC-5.5: Job Status Transitions (Admin)
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | completed → verified | Job verified, request→"completed" | `ADMIN_JOB_TRANSITIONS` + audit log |
| 2 | in_progress → completed (force-complete) | Admin can force-complete stuck jobs | Admin transition map allows this |
| 3 | assigned/in_progress → cancelled | Job cancelled with reason, audit logged | `$transaction` + `logAudit()` |
| 4 | verified → anything | 400 error | No transitions from "verified" |

### TC-5.6: Suggest Parts During Job
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | POST /tech/jobs/:id/suggest-parts | Parts added to ServiceRequestPart | Validates all part_ids exist, `createMany` with `skipDuplicates` |
| 2 | Job not in_progress | 400 error | Status check before allowing |
| 3 | Duplicate part suggestion | Silently skipped | `skipDuplicates: true` |

---

## 6. Parts Ordering & Vendor Flow

### TC-6.1: User Orders Parts
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | POST /orders with warehouse_id + items | Order created with status "pending" | Creates Order + OrderItems, generates order_number |
| 2 | Parts from suggested list | Linked via request_id | Optional request_id on Order |

### TC-6.2: Vendor Confirms Order
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | PATCH /vendor/orders/:id/confirm | pending → confirmed | `assertOrderTransition()` validates transition |
| 2 | Already confirmed order | 400 error | Transition map: confirmed can't → confirmed |

### TC-6.3: Vendor Moves to Processing
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | PATCH /vendor/orders/:id/processing | confirmed → processing | **NEW** route using existing ORDER_TRANSITIONS map |
| 2 | Pending order → processing | 400 error | Must go pending → confirmed → processing |

### TC-6.4: Vendor Creates Fulfillment
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | POST /vendor/orders/:id/fulfillment | Fulfillment created, order auto-moves to "processing" | **NEW** endpoint, auto-transitions confirmed→processing |
| 2 | With tracking + carrier info | Stored on fulfillment | Optional fields in createFulfillmentSchema |
| 3 | Order not confirmed/processing | 400 error | Status check before creation |
| 4 | Multiple fulfillments per order | Allowed (split shipments) | Each fulfillment is independent |

### TC-6.5: Fulfillment Status Updates
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | pending → processing → shipped | Normal flow | `FULFILLMENT_TRANSITIONS` map |
| 2 | shipped → in_transit → delivered | Tracking flow | Auto-sets shipped_at, delivered_at timestamps |
| 3 | Any → failed | Marks shipment failed | All non-terminal states can → failed |
| 4 | All fulfillments delivered | Order auto-moves to "delivered" | Transaction checks remaining non-delivered fulfillments |
| 5 | First fulfillment shipped | Order auto-moves to "shipped" | If order not already shipped/delivered |

### TC-6.6: Vendor Cancels Order
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Cancel pending/confirmed/processing order | Order→"cancelled", reservations released, inventory restored | `$transaction`: cancel order + release all active reservations + increment inventory |
| 2 | Cancel shipped order | 400 error | Transition map: shipped can only → delivered |

### TC-6.7: Order Return
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Return delivered order | order→"returned", payment→"refunded", inventory restored | `$transaction`: update order, restore inventory for each item |
| 2 | Return non-delivered order | 400 error | Only delivered orders can be returned |
| 3 | Missing inventory record on return | Warning returned, partial restore | Tracks `missingInventory` array, returns warning |

### TC-6.8: Vendor Doesn't Have Part (Edge Case)
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Check inventory before ordering | User sees available quantities per warehouse | Inventory API shows quantity_available |
| 2 | Part out of stock | Cannot place order (frontend shows 0 available) | Inventory check + reservation system |
| 3 | Search multiple warehouses | User can browse warehouses by location | Warehouse list with city/state filters |

### TC-6.9: Reservation Expiry
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Reservation expires_at passes | Auto-expired, inventory released | **NEW** `reservationCleanup.js` runs every 5 minutes |
| 2 | Expired reservation | status→"expired", quantity restored to available | $transaction: update inventory + reservation status |
| 3 | Server restart | Cleanup runs immediately on boot | `startReservationCleanup()` in index.js |

---

## 7. Invoice & Payment Flow

### TC-7.1: Technician Creates Invoice
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | POST /tech/jobs/:id/invoice with items | Invoice created with calculated totals | Uses `Decimal.js` for precision: subtotal + (subtotal × tax_rate / 100) |
| 2 | Job not completed | 400 error | Status check: only completed jobs |
| 3 | Invoice already exists | 409 "already created" | `prisma.invoice.findUnique({ where: { job_id } })` |
| 4 | Multiple item types (labor, parts) | Each line item tracked | InvoiceItem with item_type, description, qty, unit_price, total_price |

### TC-7.2: User Views Invoices
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | GET /invoices | **NEW** paginated list of user's invoices | Filters via `job.request.user_id = req.userId` |
| 2 | Filter by payment_status | Filtered results | Optional query param |
| 3 | GET /invoices/:id | Detailed invoice with items | Includes all relations + ownership check |

### TC-7.3: User Pays Invoice
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | POST /invoices/:id/pay with method + transaction_id | payment_status → "completed", paid_at set | Updates invoice record |
| 2 | Already paid | 400 "already been paid" | Status check |
| 3 | Refunded invoice | 400 "Cannot pay refunded" | Separate check |
| 4 | Duplicate transaction_id | 409 "already used" | `prisma.invoice.findFirst({ where: { transaction_id } })` |
| 5 | Non-owner tries to pay | 403 "You do not have access" | Ownership via job → request → user_id chain |

---

## 8. Communication Test Cases

### TC-8.1: User-Technician Messaging
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | POST /requests/:id/messages | Message sent to request thread | Creates Message linked to request |
| 2 | GET /requests/:id/messages | All messages in conversation | Paginated, includes sender info |
| 3 | Non-participant sends message | 403 error | Validates sender is either the requesting user or assigned technician |

### TC-8.2: Technician Contact Info
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | User sees tech's phone number | Can call directly | TechnicianProfile includes phone_number from User model |
| 2 | User sees tech's location | Can estimate proximity | Location data on TechnicianProfile |

---

## 9. Admin Operations Test Cases

### TC-9.1: Dashboard & Analytics
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | GET /admin/dashboard | Aggregated stats (users, techs, requests, revenue) | Dashboard controller with grouped counts |
| 2 | GET /admin/analytics/* | Time-series data for charts | Granularity (day/week/month) with dateFilter |

### TC-9.2: User Management
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Suspend user | is_active → false | PATCH /admin/users/:id + audit log |
| 2 | Unsuspend user | is_active → true | Same endpoint, toggle |

### TC-9.3: Technician Management
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Verify technician | is_verified → true | PATCH /admin/technicians/:id/verify + audit log |
| 2 | Suspend technician | is_active → false | PATCH endpoint + audit log |

### TC-9.4: Vendor Management
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Suspend vendor | is_active → false, all warehouses deactivated | PATCH endpoint + cascading warehouse update + audit log |

### TC-9.5: Admin Force-Assign Technician
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | POST /admin/requests/:id/force-assign | Creates offer + job, bypasses normal flow | Admin can intervene for stuck requests |

### TC-9.6: Admin Job Management
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Verify completed job | Job→"verified", audit logged | **NEW** PATCH /admin/jobs/:id/status |
| 2 | Force-complete in-progress job | Job→"completed", request synced | Admin transition map + transaction |
| 3 | Cancel any non-terminal job | Job→"cancelled", reason logged | Required reason + audit log |

### TC-9.7: Audit Logging
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Any admin action | Audit log entry created | `logAudit()` helper with entity_type, action, old_value, new_value |
| 2 | GET /admin/audit-logs | Filterable audit trail | Supports entity_type, action, performer, date range filters |

---

## 10. Edge Cases & Error Handling

### TC-10.1: Rate Limiting
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Too many auth requests | 429 "Too many requests" | `authLimiter` middleware (stricter for auth endpoints) |
| 2 | Too many API requests | 429 throttled | `apiLimiter` middleware (general API rate limiting) |

### TC-10.2: Invalid UUID Parameters
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Request with invalid UUID | 400 "Invalid UUID format" | `validateUUIDParams` middleware on all routes |

### TC-10.3: Cross-Role Access Prevention
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | User accessing /tech/* routes | 403 Forbidden | `roleGuard("technician")` middleware |
| 2 | Tech accessing /admin/* routes | 403 Forbidden | `roleGuard("admin")` middleware |
| 3 | Vendor accessing user invoices | 403 Forbidden | Ownership validation via join chain |

### TC-10.4: Data Ownership Validation
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | User A viewing User B's request | 404 (not found) | `where: { user_id: req.userId }` on all queries |
| 2 | Tech A viewing Tech B's job | 403 "Not authorized" | Explicit technician_id check |
| 3 | Vendor A viewing Vendor B's order | 404 (not found) | Warehouse ownership chain validation |

### TC-10.5: Concurrent Operations
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Two users accept same offer simultaneously | Only one succeeds | Prisma unique constraint + status check in transaction |
| 2 | Concurrent inventory updates | Atomic operations | `prisma.$transaction` for all inventory changes |
| 3 | Double payment | 400 "already been paid" | Status check before update |

### TC-10.6: Soft Deletion
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Deleted record accessed | 404 error | All queries check `deleted_at: null` |
| 2 | Deleted user login | 403 "Account has been deleted" | `deleted_at` check in auth flow |

### TC-10.7: Error Boundaries (Frontend)
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Component throws runtime error | Error boundary catches, shows message | `<ErrorBoundary>` wrapper in all dashboards |
| 2 | API returns 500 | User sees friendly error message | Error handling in async functions with ApiError class |

### TC-10.8: Towing Service Edge Case
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Tech offers repair_mode: "tow_to_garage" | Towing service selected | `repair_mode` enum on offer: "onsite" or "tow_to_garage" |
| 2 | User accepts towing offer | Job has tow mode | Job.offer.repair_mode = "tow_to_garage" visible in all views |
| 3 | Service location type tracked | "roadside" vs "at_location" | `service_location_type` field on ServiceRequest |

### TC-10.9: Technician Goes Offline Mid-Job
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Tech toggles offline during job | Job continues (online status independent) | Job status is separate from tech availability |
| 2 | Admin can see job still assigned | Admin dashboard shows all jobs | Admin job list shows all status jobs |
| 3 | Admin can force-complete | Admin transitions job to completed | **NEW** admin PATCH /admin/jobs/:id/status |

### TC-10.10: Partial Shipment
| Step | Action | Expected | How Solved |
|------|--------|----------|------------|
| 1 | Vendor creates multiple fulfillments | Each tracked independently | Multiple Fulfillment records per Order |
| 2 | One fulfillment delivered, others pending | Order stays "shipped" | Only all-delivered triggers order→"delivered" |
| 3 | One fulfillment fails | Failure logged, others continue | Each fulfillment has independent status |

---

## Summary of Fixes Applied

| # | Gap | Fix | Files Modified |
|---|-----|-----|---------------|
| 1 | No fulfillment creation endpoint | Added POST /vendor/orders/:id/fulfillment | `vendor/fulfillment/fulfillment.routes.js`, `vendor.schemas.js` |
| 2 | No order processing transition | Added PATCH /vendor/orders/:id/processing | `vendor/orders/orders.routes.js` |
| 3 | No user invoice list endpoint | Added GET /invoices with pagination + filter | `user/invoices/invoices.routes.js` |
| 4 | Admin can't manage job status | Added PATCH /admin/jobs/:id/status (verify/complete/cancel) | `admin/jobs/jobs.routes.js` |
| 5 | Reservation expiry never runs | Added cleanup cron (every 5 min) | New: `utils/reservationCleanup.js`, `index.js` |
| 6 | No tech/vendor change-password | Added POST /tech/auth/change-password, /vendor/auth/change-password | `tech/auth/auth.routes.js`, `vendor/auth/auth.routes.js`, schemas |
| 7 | Frontend: vendor missing actions | Added Processing + Create Fulfillment buttons | `VendorOrderDetailPage.jsx`, `vendor/api.js` |
| 8 | Frontend: no invoice list page | Created UserInvoicesPage + route | New: `UserInvoicesPage.jsx`, `user/App.jsx`, `user/api.js` |
| 9 | Frontend: admin can't manage jobs | Added verify/force-complete/cancel buttons | `AdminJobDetailPage.jsx`, `admin/api.js` |
| 10 | Frontend: tech/vendor missing auth APIs | Added forgotPassword, resetPassword, changePassword | `tech/api.js`, `vendor/api.js` |

---

## Status Transition Maps (Complete Reference)

### ServiceRequest Status
```
created → pending_offers → offer_accepted → in_progress → completed
                                                        → cancelled (from any non-terminal)
```

### Offer Status
```
pending → accepted | rejected | expired
```

### Job Status
```
assigned → in_progress → completed → verified (admin only)
                       → cancelled (admin: from assigned or in_progress)
```

### Order Status
```
pending → confirmed → processing → shipped → delivered → returned
       ↘ cancelled ↗ cancelled  ↗ cancelled
```

### Fulfillment Status
```
pending → processing → shipped → in_transit → delivered
                              ↘ delivered (direct)
Any non-terminal → failed
```

### Payment Status
```
pending → completed | failed | refunded
```

### Reservation Status
```
active → expired (auto via cleanup) | converted | cancelled
```
