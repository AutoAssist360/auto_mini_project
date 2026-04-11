# 🔧 Complete Backend API Testing Guide — Postman

> **Base URL:** `http://localhost:3000`
> **Database:** Neon PostgreSQL (check `.env` for `DATABASE_URL`)
> **Start server:** `npm run dev` (from `/backend` directory)

---

## Table of Contents

1. [Project Architecture Overview](#1-project-architecture-overview)
2. [How Authentication Works](#2-how-authentication-works)
3. [Setting Up Postman](#3-setting-up-postman)
4. [How to Verify Data in Neon DB](#4-how-to-verify-data-in-neon-db)
5. [USER Module Routes](#5-user-module-routes)
   - [5.1 Auth Routes](#51-auth-routes-auth)
   - [5.2 Profile Routes](#52-profile-routes-profile)
   - [5.3 Vehicle Routes](#53-vehicle-routes-vehicles)
   - [5.4 Service Request Routes](#54-service-request-routes-requests)
   - [5.5 Offer Routes](#55-offer-routes-requestsidrequestoffers--offersidaction)
   - [5.6 Job Routes](#56-job-routes-jobs)
   - [5.7 Invoice Routes](#57-invoice-routes-invoices)
   - [5.8 Order Routes](#58-order-routes-orders)
   - [5.9 Review Routes](#59-review-routes-reviews)
   - [5.10 Message Routes](#510-message-routes-requestsidmessages)
6. [TECHNICIAN Module Routes](#6-technician-module-routes)
   - [6.1 Auth Routes](#61-tech-auth-routes-techauth)
   - [6.2 Profile Routes](#62-tech-profile-routes-techprofile)
   - [6.3 Availability Routes](#63-tech-availability-routes-techavailability)
   - [6.4 Offer Routes](#64-tech-offer-routes-techoffers)
   - [6.5 Assignment Routes](#65-tech-assignment-routes-techassignments)
   - [6.6 Job Routes](#66-tech-job-routes-techjobs)
   - [6.7 Earnings Routes](#67-tech-earnings-routes-techearnings)
   - [6.8 Location Routes](#68-tech-location-routes-techlocation)
   - [6.9 Message Routes](#69-tech-message-routes-techrequestsidmessages)
7. [ADMIN Module Routes](#7-admin-module-routes)
   - [7.1 Auth Routes](#71-admin-auth-routes-adminauth)
   - [7.2 Dashboard Routes](#72-admin-dashboard-routes-admindashboard)
   - [7.3 User Management Routes](#73-admin-user-management-routes-adminusers)
   - [7.4 Technician Management Routes](#74-admin-technician-management-routes-admintechnicians)
   - [7.5 Vendor Management Routes](#75-admin-vendor-management-routes-adminvendors)
   - [7.6 Warehouse Management Routes](#76-admin-warehouse-management-routes-adminwarehouses)
   - [7.7 Request Management Routes](#77-admin-request-management-routes-adminrequests)
   - [7.8 Job Management Routes](#78-admin-job-management-routes-adminjobs)
   - [7.9 Order Management Routes](#79-admin-order-management-routes-adminorders)
   - [7.10 Invoice Management Routes](#710-admin-invoice-management-routes-admininvoices)
   - [7.11 Analytics Routes](#711-admin-analytics-routes-adminanalytics)
   - [7.12 Audit Log Routes](#712-admin-audit-log-routes-adminaudit-logs)
8. [VENDOR Module Routes](#8-vendor-module-routes)
   - [8.1 Auth Routes](#81-vendor-auth-routes-vendorauth)
   - [8.2 Warehouse Routes](#82-vendor-warehouse-routes-vendorwarehouses)
   - [8.3 Inventory Routes](#83-vendor-inventory-routes-vendorwarehousesidinventory--vendorinventoryid)
   - [8.4 Reservation Routes](#84-vendor-reservation-routes-vendorwarehousesidreservations--vendorreservationsid)
   - [8.5 Order Routes](#85-vendor-order-routes-vendororders)
   - [8.6 Fulfillment Routes](#86-vendor-fulfillment-routes-vendorordersiddfulfillment--vendorfulfillmentidstatus)
   - [8.7 Analytics Routes](#87-vendor-analytics-routes-vendoranalytics)
9. [Complete End-to-End Testing Flow](#9-complete-end-to-end-testing-flow)
10. [Middleware Explained](#10-middleware-explained)
11. [Database Schema Summary](#11-database-schema-summary)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Project Architecture Overview

This is a **Car Breakdown Service Platform** backend built with:

| Technology | Purpose |
|---|---|
| **Express.js v5** | HTTP server & routing |
| **Prisma ORM** | Database queries (with `@prisma/adapter-pg` for Neon) |
| **PostgreSQL (Neon)** | Cloud database |
| **JWT** | Authentication (access + refresh tokens) |
| **bcrypt** | Password hashing |
| **Zod** | Request body validation |
| **express-rate-limit** | Rate limiting on auth endpoints |

### How the code flows (request → response):

```
Client Request
  → Express Middleware (CORS, JSON parser, cookie-parser, UUID param validation)
    → Route-level Middleware (rate limiter, userAuth, roleGuard, validate)
      → Route Handler (business logic + Prisma DB queries)
        → Response (JSON)
  → Error Handler (catches AppError, ZodError, or 500s)
```

### Four user roles:

| Role | Description |
|---|---|
| **user** | Car owners who request breakdown services, order parts |
| **technician** | Mechanics who offer services, complete jobs, create invoices |
| **admin** | Platform administrators managing users, requests, analytics |
| **vendor** | Parts suppliers who manage warehouses, inventory, fulfillment |

### Key file explanations:

- **`src/index.js`** — Entry point. Imports the Express app from `server.js` and starts listening on port 3000.
- **`src/server.js`** — Creates the Express app, configures middleware (CORS, JSON, cookies), mounts ALL routes, adds 404 handler and global error handler.
- **`config.js`** — Exports environment variables: `DATABASE_URL`, `USER_SECRET`, `REFRESH_SECRET`, `RESET_SECRET`, `PORT`.
- **`src/lib/prisma.js`** — Creates a single Prisma client instance using `@prisma/adapter-pg` (connects to Neon DB via `DATABASE_URL`).

### Middleware explained briefly:

- **`auth.js`** (`userAuth`) — Extracts JWT from cookie or `Authorization: Bearer <token>` header, verifies it, checks user exists and is active, then attaches `req.userId` and `req.userRole`.
- **`roleGuard.js`** — Checks `req.userRole` against allowed roles. Returns 403 if not authorized.
- **`validate.js`** — Parses `req.body` with a Zod schema. Returns 400 with field-level errors on failure.
- **`validateParams.js`** — Auto-validates any URL params ending with "Id" as UUID format.
- **`rateLimiter.js`** — `authLimiter`: 10 requests per 15 mins per IP (on `/auth`, `/tech/auth`, `/admin/auth`, `/vendor/auth`).
- **`errorHandler.js`** — Catches `AppError` (custom), `ZodError`, or unknown errors → returns JSON error response.

### Utility files:

- **`AppError.js`** — Custom error class: `new AppError("message", statusCode)`.
- **`asyncWrapper.js`** — Wraps async handlers so rejected promises are caught and forwarded to Express error handler.
- **`cookieHelper.js`** — `setAuthCookies()` sets `accessToken` (15 min) + `refreshToken` (7 days) as httpOnly cookies. `clearAuthCookies()` removes them.
- **`tokenHelper.js`** — `generateAccessToken()` (15 min), `generateRefreshToken()` (7 days), `generateResetToken()` (15 min), and their verify counterparts using JWT + secrets from config.
- **`paginate.js`** — `paginate(page, limit)` returns `{ skip, take }` for Prisma. `paginationQuery` is a Zod schema for `?page=1&limit=20`.

---

## 2. How Authentication Works

### Token Flow:

1. User signs up or signs in → server generates **access token** (15 min) + **refresh token** (7 days)
2. Both tokens are set as **httpOnly cookies** AND the access token is returned in the response body
3. For subsequent requests, the server checks:
   - `Cookie: accessToken=xxx` OR
   - `Cookie: authcookie=xxx` (legacy) OR
   - `Authorization: Bearer xxx` header
4. When access token expires → call `/auth/refresh` with the refresh token to get new tokens
5. Logout clears all cookies

### In Postman, you have two options:

**Option A — Use cookies (automatic):**
When you call signup/signin, Postman automatically stores the cookies. All subsequent requests will include them.

**Option B — Use Bearer token (manual):**
1. Copy the `accessToken` from the signup/signin response
2. Go to the **Authorization** tab of your request
3. Select **Bearer Token**
4. Paste the token

> ⚠️ **Access tokens expire in 15 minutes.** If you get `"Access token expired"`, call the refresh endpoint or sign in again.

---

## 3. Setting Up Postman

### Step 1: Start the backend server

```bash
cd mini_project/backend
npm install          # first time only
npm run dev          # starts on port 3000
```

### Step 2: Create a Postman environment

Create a new Postman Environment with these variables:

| Variable | Initial Value |
|---|---|
| `BASE_URL` | `http://localhost:3000` |
| `USER_TOKEN` | *(leave empty — fill after signup/signin)* |
| `TECH_TOKEN` | *(leave empty)* |
| `ADMIN_TOKEN` | *(leave empty)* |
| `VENDOR_TOKEN` | *(leave empty)* |

### Step 3: Set up automatic token capture

In each signup/signin request, go to the **Tests** tab and add:

```javascript
const res = pm.response.json();
if (res.accessToken) {
    pm.environment.set("USER_TOKEN", res.accessToken);
}
```

### Step 4: Use the token in requests

For all authenticated requests, go to **Authorization** tab → **Bearer Token** → `{{USER_TOKEN}}` (or `{{TECH_TOKEN}}`, `{{ADMIN_TOKEN}}`, `{{VENDOR_TOKEN}}`).

### Step 5: Set headers

All requests with a body need:
- **Content-Type:** `application/json`

---

## 4. How to Verify Data in Neon DB

After each API call, you should verify the data was created/updated in your Neon database:

### Using Neon Dashboard:
1. Go to your Neon project → **SQL Editor**
2. Run queries like:
   ```sql
   SELECT * FROM users ORDER BY created_at DESC LIMIT 5;
   SELECT * FROM user_vehicles WHERE user_id = '<uuid>';
   SELECT * FROM service_requests ORDER BY created_at DESC LIMIT 5;
   SELECT * FROM technician_profiles;
   SELECT * FROM warehouses;
   SELECT * FROM inventories;
   SELECT * FROM orders ORDER BY created_at DESC LIMIT 5;
   ```

### Using local pgAdmin/psql:
```sql
-- Connect using your DATABASE_URL from .env
-- Then run the same queries above
```

### What to check after each route test:
| After testing... | Check this table in Neon |
|---|---|
| User signup | `users` — new row with role='user' |
| Add vehicle | `user_vehicles` — new row linked to user_id |
| Create request | `service_requests` — new row with status='created' |
| Tech submit offer | `technician_offers` — new row; `service_requests.status` → 'pending_offers' |
| Accept offer | `technician_offers.status` → 'accepted'; `jobs` — new row; `service_requests.status` → 'offer_accepted' |
| Complete job | `jobs.status` → 'completed'; `service_requests.status` → 'completed' |
| Create invoice | `invoices` + `invoice_items` — new rows |
| Pay invoice | `invoices.payment_status` → 'completed' |
| Create order | `orders` + `order_items` — new rows; `inventories.quantity_reserved` increases |
| Create warehouse | `warehouses` — new row |
| Add inventory | `inventories` — new row |

---

## 5. USER Module Routes

These routes are for car owners (role = `user`). All routes (except auth) require authentication with a user account.

---

### 5.1 Auth Routes (`/auth`)

> **Rate Limited:** 10 requests per 15 minutes per IP

#### 5.1.1 `POST /auth/signup` — Register a new user

**Why this route exists:** Creates a new user account with role "user". This is the entry point for car owners to join the platform. Also handles reactivation of soft-deleted accounts.

**How the code works:**
1. Validates body with `signupSchema` (Zod)
2. Checks if email already exists (and is not soft-deleted)
3. Checks if phone number already exists
4. Hashes password with bcrypt (10 salt rounds)
5. If user was previously soft-deleted → reactivates with new data
6. Otherwise creates new user with role "user"
7. Generates JWT access + refresh tokens
8. Sets httpOnly cookies + returns accessToken in body

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/auth/signup
Headers: Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "email": "testuser@example.com",
  "password": "Test@1234",
  "full_name": "Test User",
  "phone_number": "9876543210"
}
```

**Expected Response (201):**
```json
{
  "message": "User created successfully",
  "accessToken": "eyJhbGciOiJI..."
}
```

**DB Verification:**
```sql
SELECT * FROM users WHERE email = 'testuser@example.com';
```

> 💡 **Save the `accessToken`** from the response — you'll need it for all subsequent user requests!

---

#### 5.1.2 `POST /auth/signin` — Login

**Why this route exists:** Authenticates an existing user and issues new JWT tokens. Essential for returning users to access protected routes.

**How the code works:**
1. Validates body with `signinSchema`
2. Finds user by email
3. Checks if user is soft-deleted (`deleted_at` not null) → 403
4. Checks if user is suspended (`is_active` false) → 403
5. Compares password with bcrypt
6. Generates new access + refresh tokens
7. Sets cookies + returns access token

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/auth/signin
```

**Body:**
```json
{
  "email": "testuser@example.com",
  "password": "Test@1234"
}
```

**Expected Response (200):**
```json
{
  "message": "Signed in successfully",
  "accessToken": "eyJhbGciOiJI..."
}
```

---

#### 5.1.3 `POST /auth/logout` — Logout

**Why this route exists:** Clears authentication cookies so the user's session ends. Important for security.

**How the code works:** Simply calls `clearAuthCookies(res)` which removes `accessToken`, `refreshToken`, and `authcookie` cookies.

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/auth/logout
```

**Body:** None needed

**Expected Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

---

#### 5.1.4 `POST /auth/refresh` — Refresh access token

**Why this route exists:** When the access token expires (after 15 minutes), the client uses the refresh token (valid 7 days) to get a new access token without re-entering credentials.

**How the code works:**
1. Reads refresh token from cookies or request body
2. Verifies token with `REFRESH_SECRET`
3. Checks user still exists, not deleted, not suspended
4. Issues brand new access + refresh tokens

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/auth/refresh
```

**Body (if cookies don't work):**
```json
{
  "refreshToken": "<paste_refresh_token_here>"
}
```

**Expected Response (200):**
```json
{
  "message": "Token refreshed successfully",
  "accessToken": "eyJhbGciOiJI..."
}
```

---

#### 5.1.5 `POST /auth/forgot-password` — Request password reset

**Why this route exists:** Initiates the password reset flow. In production, this would send an email with a reset link/token. In development, the token is returned directly.

**How the code works:**
1. Validates email format
2. Looks up user by email
3. If user doesn't exist → still returns success message (prevents email enumeration attack)
4. Generates a reset token (JWT, 15 min expiry)
5. Returns the reset token (dev only — production would email it)

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/auth/forgot-password
```

**Body:**
```json
{
  "email": "testuser@example.com"
}
```

**Expected Response (200):**
```json
{
  "message": "If an account with that email exists, a password reset link has been sent",
  "resetToken": "eyJhbGciOiJI..."
}
```

> 💡 **Save the `resetToken`** — you'll need it for the next step!

---

#### 5.1.6 `POST /auth/reset-password` — Reset password with token

**Why this route exists:** Completes the password reset flow. The user provides the reset token (from email/response) and their new password.

**How the code works:**
1. Verifies the reset token with `RESET_SECRET`
2. Finds the user from the decoded token
3. Hashes the new password
4. Updates the password in the database

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/auth/reset-password
```

**Body:**
```json
{
  "token": "<paste_reset_token_here>",
  "new_password": "NewPass@1234"
}
```

**Expected Response (200):**
```json
{
  "message": "Password reset successfully"
}
```

---

#### 5.1.7 `POST /auth/change-password` — Change password (authenticated)

**Why this route exists:** Allows a logged-in user to change their password. Requires knowing the current password. After changing, cookies are cleared forcing re-login.

**How the code works:**
1. Requires authentication (`userAuth` middleware)
2. Verifies current password matches
3. Hashes new password
4. Updates in database
5. Clears auth cookies (forces re-login)

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/auth/change-password
Authorization: Bearer {{USER_TOKEN}}
```

**Body:**
```json
{
  "current_password": "Test@1234",
  "new_password": "NewSecure@5678"
}
```

**Expected Response (200):**
```json
{
  "message": "Password changed successfully. Please sign in again."
}
```

---

### 5.2 Profile Routes (`/profile`)

> **Auth Required:** Yes (user or admin role)

#### 5.2.1 `GET /profile` — Get current user's profile

**Why this route exists:** Allows the logged-in user to see their own profile information. Used on the dashboard/profile page.

**How the code works:** Queries `users` table with `req.userId` (set by auth middleware). Returns selected fields only (no password).

**Postman Setup:**
```
Method: GET
URL: {{BASE_URL}}/profile
Authorization: Bearer {{USER_TOKEN}}
```

**Body:** None

**Expected Response (200):**
```json
{
  "user": {
    "user_id": "uuid...",
    "full_name": "Test User",
    "email": "testuser@example.com",
    "phone_number": "9876543210",
    "role": "user",
    "is_active": true,
    "created_at": "2026-02-26T..."
  }
}
```

---

#### 5.2.2 `PUT /profile` — Update profile

**Why this route exists:** Lets users update their name and phone number. Validates phone number uniqueness.

**How the code works:**
1. Validates body with `updateProfileSchema` (optional `full_name` and `phone_number`)
2. If phone_number provided → checks it's not already used by another user
3. Updates only the fields provided

**Postman Setup:**
```
Method: PUT
URL: {{BASE_URL}}/profile
Authorization: Bearer {{USER_TOKEN}}
```

**Body:**
```json
{
  "full_name": "Updated Name",
  "phone_number": "9876543211"
}
```

**Expected Response (200):**
```json
{
  "message": "Profile updated successfully",
  "user": { ... }
}
```

**DB Verification:**
```sql
SELECT full_name, phone_number FROM users WHERE email = 'testuser@example.com';
```

---

#### 5.2.3 `DELETE /profile` — Soft-delete account

**Why this route exists:** Allows users to delete their own account. Uses soft-delete (sets `deleted_at` timestamp + `is_active = false`) rather than permanent deletion.

**How the code works:** Sets `deleted_at = new Date()` and `is_active = false`, then clears auth cookies.

**Postman Setup:**
```
Method: DELETE
URL: {{BASE_URL}}/profile
Authorization: Bearer {{USER_TOKEN}}
```

**Body:** None

**Expected Response (200):**
```json
{
  "message": "Account deleted successfully"
}
```

**DB Verification:**
```sql
SELECT deleted_at, is_active FROM users WHERE email = 'testuser@example.com';
-- deleted_at should now have a timestamp, is_active should be false
```

---

### 5.3 Vehicle Routes (`/vehicles`)

> **Auth Required:** Yes (user or admin role)

#### 5.3.1 `POST /vehicles` — Add a vehicle

**Why this route exists:** Users must register their vehicles before creating service requests. Links a car variant (make/model/year) to the user.

**How the code works:**
1. Validates body with `addVehicleSchema`
2. Verifies the `variant_id` exists in `car_variants` table
3. Checks registration number and VIN aren't already in use
4. Creates entry in `user_vehicles` table

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/vehicles
Authorization: Bearer {{USER_TOKEN}}
```

**Body:**
```json
{
  "variant_id": 1,
  "registration_number": "MH12AB1234",
  "vin_number": "1HGBH41JXMN109186"
}
```

> ⚠️ You need a valid `variant_id` from the `car_variants` table. Check your DB:
> ```sql
> SELECT * FROM car_variants LIMIT 10;
> ```
> If empty, you'll need to seed the car data first (car_companies → car_models → car_variants).

**Expected Response (201):**
```json
{
  "message": "Vehicle added successfully",
  "vehicle": {
    "vehicle_id": "uuid...",
    "user_id": "uuid...",
    "variant_id": 1,
    "registration_number": "MH12AB1234",
    "vin_number": "1HGBH41JXMN109186",
    "variant": {
      "variant_name": "...",
      "model": { "model_name": "...", "company": { "company_name": "..." } }
    }
  }
}
```

**DB Verification:**
```sql
SELECT * FROM user_vehicles WHERE registration_number = 'MH12AB1234';
```

---

#### 5.3.2 `GET /vehicles` — List my vehicles

**Why this route exists:** Shows all vehicles registered by the current user. Used in the dashboard and when creating service requests (to select a vehicle).

**Postman Setup:**
```
Method: GET
URL: {{BASE_URL}}/vehicles
Authorization: Bearer {{USER_TOKEN}}
```

---

#### 5.3.3 `PUT /vehicles/:vehicleId` — Update a vehicle

**Why this route exists:** Allows users to update vehicle details (e.g., correcting registration number). Validates ownership.

**Postman Setup:**
```
Method: PUT
URL: {{BASE_URL}}/vehicles/<vehicle_id_uuid>
Authorization: Bearer {{USER_TOKEN}}
```

**Body:**
```json
{
  "registration_number": "MH12CD5678"
}
```

---

#### 5.3.4 `DELETE /vehicles/:vehicleId` — Delete a vehicle

**Why this route exists:** Permanently removes a vehicle from the user's account. Validates ownership before deletion.

**Postman Setup:**
```
Method: DELETE
URL: {{BASE_URL}}/vehicles/<vehicle_id_uuid>
Authorization: Bearer {{USER_TOKEN}}
```

---

### 5.4 Service Request Routes (`/requests`)

> **Auth Required:** Yes (user or admin role)

#### 5.4.1 `POST /requests` — Create a service request

**Why this route exists:** This is the core action — a user reports a car breakdown and requests service. Creates a new row in `service_requests` with status "created" and notifies the system that technicians can start sending offers.

**How the code works:**
1. Validates body with `createRequestSchema`
2. Verifies the vehicle exists and belongs to this user
3. Creates the service request with provided details
4. Returns the request with populated vehicle info

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/requests
Authorization: Bearer {{USER_TOKEN}}
```

**Body:**
```json
{
  "vehicle_id": "<vehicle_id_uuid>",
  "issue_description": "My car won't start. Battery seems dead.",
  "issue_type": "battery_issue",
  "breakdown_latitude": 19.0760,
  "breakdown_longitude": 72.8777,
  "service_location_type": "roadside",
  "requires_towing": false
}
```

**Valid `issue_type` values:** `mechanical_failure`, `electrical_issue`, `tire_related`, `battery_issue`, `engine_problem`, `brake_issue`, `other`

**Valid `service_location_type` values:** `roadside`, `home`, `office`

**Expected Response (201):**
```json
{
  "message": "Service request created successfully",
  "serviceRequest": {
    "request_id": "uuid...",
    "status": "created",
    ...
  }
}
```

**DB Verification:**
```sql
SELECT * FROM service_requests ORDER BY created_at DESC LIMIT 1;
-- status should be 'created'
```

---

#### 5.4.2 `GET /requests` — List my service requests

**Why this route exists:** Shows all service requests created by this user. Supports filtering by status and pagination.

**Postman Setup:**
```
Method: GET
URL: {{BASE_URL}}/requests?page=1&limit=10
Authorization: Bearer {{USER_TOKEN}}
```

**Optional query params:**
- `?status=created,pending_offers` (comma-separated filter)
- `?page=1&limit=20`

---

#### 5.4.3 `GET /requests/:requestId` — Get request details

**Why this route exists:** Shows full details of a specific service request including vehicle info, parts, media, offers, and job status.

**Postman Setup:**
```
Method: GET
URL: {{BASE_URL}}/requests/<request_id_uuid>
Authorization: Bearer {{USER_TOKEN}}
```

---

#### 5.4.4 `PATCH /requests/:requestId/cancel` — Cancel a request

**Why this route exists:** Allows users to cancel a request that hasn't been accepted yet. Only works for "created" or "pending_offers" status.

**How the code works:** Validates ownership, checks status is cancellable, updates to "cancelled".

**Postman Setup:**
```
Method: PATCH
URL: {{BASE_URL}}/requests/<request_id_uuid>/cancel
Authorization: Bearer {{USER_TOKEN}}
```

**Body:** None

**DB Verification:**
```sql
SELECT status FROM service_requests WHERE request_id = '<uuid>';
-- should be 'cancelled'
```

---

### 5.5 Offer Routes (`/requests/:id/offers` & `/offers/:id/action`)

> **Auth Required:** Yes (user or admin role)

#### 5.5.1 `GET /requests/:requestId/offers` — List offers on a request

**Why this route exists:** Shows all technician offers for a specific service request. Users use this to compare offers before accepting one.

**Postman Setup:**
```
Method: GET
URL: {{BASE_URL}}/requests/<request_id_uuid>/offers?page=1&limit=10
Authorization: Bearer {{USER_TOKEN}}
```

---

#### 5.5.2 `PATCH /offers/:offerId/accept` — Accept an offer

**Why this route exists:** This is a critical business action. Accepting an offer:
1. Creates a Job (assigned to the technician)
2. Updates the service request status to "offer_accepted"
3. Rejects all other pending offers on this request
All done atomically in a database transaction.

**How the code works:**
1. Finds the offer + validates ownership (via request → user_id)
2. Checks offer is still "pending"
3. Inside a transaction:
   - Re-checks no other offer was accepted (prevents race conditions)
   - Updates offer → "accepted"
   - Creates a new Job with status "assigned"
   - Updates service request → "offer_accepted"
   - Rejects all other pending offers

**Postman Setup:**
```
Method: PATCH
URL: {{BASE_URL}}/offers/<offer_id_uuid>/accept
Authorization: Bearer {{USER_TOKEN}}
```

**Body:** None

**DB Verification:**
```sql
SELECT * FROM technician_offers WHERE request_id = '<uuid>';
-- The accepted offer should have status='accepted', others='rejected'

SELECT * FROM jobs WHERE request_id = '<uuid>';
-- A new job should exist with status='assigned'

SELECT status FROM service_requests WHERE request_id = '<uuid>';
-- Should be 'offer_accepted'
```

---

#### 5.5.3 `PATCH /offers/:offerId/reject` — Reject an offer

**Why this route exists:** Allows users to decline a specific technician's offer.

**Postman Setup:**
```
Method: PATCH
URL: {{BASE_URL}}/offers/<offer_id_uuid>/reject
Authorization: Bearer {{USER_TOKEN}}
```

---

### 5.6 Job Routes (`/jobs`)

> **Auth Required:** Yes (user or admin role)

#### 5.6.1 `GET /jobs` — List my jobs

**Why this route exists:** Shows all jobs for the current user's service requests. Includes technician info, offer details, and invoice status.

**Postman Setup:**
```
Method: GET
URL: {{BASE_URL}}/jobs?page=1&limit=10
Authorization: Bearer {{USER_TOKEN}}
```

---

#### 5.6.2 `GET /jobs/:jobId` — Get job details

**Why this route exists:** Shows full details of a specific job including request info, vehicle, technician, parts, media, offer, and invoice.

**Postman Setup:**
```
Method: GET
URL: {{BASE_URL}}/jobs/<job_id_uuid>
Authorization: Bearer {{USER_TOKEN}}
```

---

### 5.7 Invoice Routes (`/invoices`)

> **Auth Required:** Yes (user or admin role)

#### 5.7.1 `GET /invoices/:invoiceId` — Get invoice details

**Why this route exists:** Shows a specific invoice with all line items. Validates the user owns the job this invoice is for.

**Postman Setup:**
```
Method: GET
URL: {{BASE_URL}}/invoices/<invoice_id_uuid>
Authorization: Bearer {{USER_TOKEN}}
```

---

#### 5.7.2 `POST /invoices/:invoiceId/pay` — Pay a service invoice

**Why this route exists:** Records a payment for a service invoice (linked to a completed job). Separate from order payments.

**How the code works:**
1. Validates ownership (invoice → job → request → user_id)
2. Checks invoice isn't already paid or refunded
3. Checks transaction_id uniqueness
4. Updates invoice: `payment_status → completed`, records payment method, transaction_id, and timestamp

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/invoices/<invoice_id_uuid>/pay
Authorization: Bearer {{USER_TOKEN}}
```

**Body:**
```json
{
  "payment_method": "upi",
  "transaction_id": "TXN_UNIQUE_12345"
}
```

**DB Verification:**
```sql
SELECT payment_status, paid_at, payment_method FROM invoices WHERE invoice_id = '<uuid>';
-- payment_status should be 'completed'
```

---

### 5.8 Order Routes (`/orders`)

> **Auth Required:** Yes (user or admin role)

#### 5.8.1 `GET /orders` — List my orders

**Why this route exists:** Shows all parts orders placed by the user. Supports filtering by order status.

**Postman Setup:**
```
Method: GET
URL: {{BASE_URL}}/orders?page=1&limit=10
Authorization: Bearer {{USER_TOKEN}}
```

**Optional query params:**
- `?status=pending,confirmed` (comma-separated)

---

#### 5.8.2 `GET /orders/:orderId` — Get order details

**Why this route exists:** Shows full order details including items, fulfillments, reservations, and linked service request.

**Postman Setup:**
```
Method: GET
URL: {{BASE_URL}}/orders/<order_id_uuid>
Authorization: Bearer {{USER_TOKEN}}
```

---

#### 5.8.3 `POST /orders` — Create a parts order

**Why this route exists:** Users can order car parts from vendor warehouses. This creates an order, calculates pricing with 18% GST, and reserves inventory atomically.

**How the code works:**
1. Validates body with `createOrderSchema`
2. Verifies warehouse exists and is active
3. If linked to a service request → validates user owns it
4. Inside a transaction:
   - Validates all parts exist in warehouse with sufficient stock
   - Creates order with calculated subtotal + tax (18%) + total
   - Creates order items
   - Reserves inventory (increments `quantity_reserved` on each inventory item)
   - Creates inventory reservation records with TTL

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/orders
Authorization: Bearer {{USER_TOKEN}}
```

**Body:**
```json
{
  "warehouse_id": "<warehouse_id_uuid>",
  "request_id": "<service_request_id_uuid>",
  "items": [
    { "part_id": 1, "quantity": 2 },
    { "part_id": 3, "quantity": 1 }
  ],
  "notes": "Urgent — needed for roadside fix"
}
```

> ⚠️ You need valid `warehouse_id` and `part_id` values. Check:
> ```sql
> SELECT * FROM warehouses WHERE is_active = true LIMIT 5;
> SELECT i.*, p.part_name FROM inventories i JOIN car_parts p ON i.part_id = p.part_id WHERE warehouse_id = '<uuid>';
> ```

**DB Verification:**
```sql
SELECT * FROM orders ORDER BY created_at DESC LIMIT 1;
SELECT * FROM order_items WHERE order_id = '<new_order_id>';
SELECT quantity_reserved FROM inventories WHERE warehouse_id = '<wh_id>' AND part_id = 1;
-- quantity_reserved should have increased
```

---

#### 5.8.4 `POST /orders/:orderId/pay` — Pay for an order

**Why this route exists:** Records payment for a parts order. Separate from service invoice payments. Advances order status from "pending" to "confirmed".

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/orders/<order_id_uuid>/pay
Authorization: Bearer {{USER_TOKEN}}
```

**Body:**
```json
{
  "payment_method": "card",
  "transaction_id": "ORD_TXN_UNIQUE_67890"
}
```

---

#### 5.8.5 `GET /orders/:orderId/fulfillment` — Track order fulfillment

**Why this route exists:** Shows the delivery/shipment status of an order.

**Postman Setup:**
```
Method: GET
URL: {{BASE_URL}}/orders/<order_id_uuid>/fulfillment
Authorization: Bearer {{USER_TOKEN}}
```

---

#### 5.8.6 `POST /orders/reserve-parts` — Reserve inventory without ordering

**Why this route exists:** Temporarily holds inventory for a part (with a TTL) without creating a full order. Useful when a technician needs to check availability before committing.

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/orders/reserve-parts
Authorization: Bearer {{USER_TOKEN}}
```

**Body:**
```json
{
  "inventory_id": "<inventory_id_uuid>",
  "quantity": 2,
  "request_id": "<service_request_id_uuid>",
  "ttl_minutes": 30
}
```

---

### 5.9 Review Routes (`/reviews`)

> **Auth Required:** Yes (user or admin role)

#### 5.9.1 `POST /reviews` — Submit a review

**Why this route exists:** After a job is completed, the user can rate and review the technician. Updates the technician's average rating.

**How the code works:**
1. Validates body with `createReviewSchema`
2. Verifies job exists and user owns it
3. Job must be "completed" or "verified"
4. Checks no existing review for this job
5. Inside a transaction:
   - Creates the review
   - Recalculates the technician's average rating and total_reviews

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/reviews
Authorization: Bearer {{USER_TOKEN}}
```

**Body:**
```json
{
  "job_id": "<job_id_uuid>",
  "rating": 5,
  "comment": "Excellent service! Fixed my car quickly."
}
```

**Rating:** 1-5 (integer)

**DB Verification:**
```sql
SELECT * FROM reviews WHERE job_id = '<uuid>';
SELECT rating, total_reviews FROM technician_profiles WHERE technician_id = '<uuid>';
```

---

#### 5.9.2 `GET /reviews` — List my reviews

**Postman Setup:**
```
Method: GET
URL: {{BASE_URL}}/reviews?page=1&limit=10
Authorization: Bearer {{USER_TOKEN}}
```

---

### 5.10 Message Routes (`/requests/:id/messages`)

> **Auth Required:** Yes (user or admin role)

#### 5.10.1 `GET /requests/:requestId/messages` — Get messages for a request

**Why this route exists:** Enables communication between users and technicians about a service request. Returns messages and marks unread ones as read.

**Postman Setup:**
```
Method: GET
URL: {{BASE_URL}}/requests/<request_id_uuid>/messages?page=1&limit=50
Authorization: Bearer {{USER_TOKEN}}
```

---

#### 5.10.2 `POST /requests/:requestId/messages` — Send a message

**Why this route exists:** Users can message technicians who have offered on their request. Validates the receiver is a technician involved in the request.

**How the code works:**
1. Validates body with `sendMessageSchema`
2. Verifies request exists and user owns it
3. Verifies receiver exists and has role "technician"
4. Verifies receiver has an active offer on this request
5. Creates the message

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/requests/<request_id_uuid>/messages
Authorization: Bearer {{USER_TOKEN}}
```

**Body:**
```json
{
  "receiver_id": "<technician_user_id_uuid>",
  "message": "Hi, how long will the repair take?"
}
```

---

## 6. TECHNICIAN Module Routes

These routes are for mechanics/technicians (role = `technician`). All routes (except auth) require authentication with a technician account.

---

### 6.1 Tech Auth Routes (`/tech/auth`)

> **Rate Limited:** 10 requests per 15 minutes per IP

#### 6.1.1 `POST /tech/auth/signup` — Register as technician

**Why this route exists:** Creates a new user with role "technician" AND creates a corresponding `TechnicianProfile` with business details, location, and service radius — all in a single transaction.

**How the code works:**
1. Validates body with `techSignupSchema` (includes all profile fields)
2. Checks email + phone uniqueness
3. Hashes password
4. In a transaction: creates User (role=technician) + TechnicianProfile
5. Returns JWT tokens

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/tech/auth/signup
```

**Body:**
```json
{
  "email": "mechanic@example.com",
  "password": "Mech@1234",
  "full_name": "John Mechanic",
  "phone_number": "8765432109",
  "business_name": "John's Auto Shop",
  "technician_type": "garage",
  "location": "Andheri West, Mumbai",
  "latitude": 19.1364,
  "longitude": 72.8296,
  "service_radius": 15
}
```

**Valid `technician_type`:** `individual`, `garage`

**DB Verification:**
```sql
SELECT * FROM users WHERE email = 'mechanic@example.com';
SELECT * FROM technician_profiles WHERE user_id = '<uuid_from_above>';
```

---

#### 6.1.2 `POST /tech/auth/signin` — Login as technician

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/tech/auth/signin
```

**Body:**
```json
{
  "email": "mechanic@example.com",
  "password": "Mech@1234"
}
```

---

#### 6.1.3 `POST /tech/auth/logout` — Logout

```
Method: POST
URL: {{BASE_URL}}/tech/auth/logout
```

---

#### 6.1.4 `POST /tech/auth/refresh` — Refresh tokens

```
Method: POST
URL: {{BASE_URL}}/tech/auth/refresh
```

---

### 6.2 Tech Profile Routes (`/tech/profile`)

> **Auth Required:** Yes (technician role)

#### 6.2.1 `GET /tech/profile` — Get technician profile

**Why this route exists:** Shows the full technician profile including user info, car supports, part skills, certifications, and resources.

**Postman Setup:**
```
Method: GET
URL: {{BASE_URL}}/tech/profile
Authorization: Bearer {{TECH_TOKEN}}
```

---

#### 6.2.2 `PUT /tech/profile` — Update profile

**Why this route exists:** Lets technicians update their business info, location, or service radius.

**Postman Setup:**
```
Method: PUT
URL: {{BASE_URL}}/tech/profile
Authorization: Bearer {{TECH_TOKEN}}
```

**Body:**
```json
{
  "business_name": "Super Auto Shop",
  "service_radius": 20,
  "latitude": 19.1400,
  "longitude": 72.8300
}
```

---

#### 6.2.3 `POST /tech/profile/certifications` — Add a certification

**Why this route exists:** Technicians can add professional certifications (e.g., ASE certified). Builds trust with users.

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/tech/profile/certifications
Authorization: Bearer {{TECH_TOKEN}}
```

**Body:**
```json
{
  "certification": "ASE Certified Master Technician",
  "issued_by": "National Institute for Automotive Service Excellence",
  "issue_date": "2025-01-15T00:00:00.000Z",
  "expiry_date": "2028-01-15T00:00:00.000Z"
}
```

---

#### 6.2.4 `DELETE /tech/profile/certifications/:certId` — Delete a certification

```
Method: DELETE
URL: {{BASE_URL}}/tech/profile/certifications/<certification_id_uuid>
Authorization: Bearer {{TECH_TOKEN}}
```

---

### 6.3 Tech Availability Routes (`/tech/availability`)

> **Auth Required:** Yes (technician role)

#### 6.3.1 `PATCH /tech/availability` — Toggle online/offline

**Why this route exists:** Technicians must be online to receive and submit offers. Cannot go offline while having an active job.

**Postman Setup:**
```
Method: PATCH
URL: {{BASE_URL}}/tech/availability
Authorization: Bearer {{TECH_TOKEN}}
```

**Body:**
```json
{
  "is_online": true
}
```

---

### 6.4 Tech Offer Routes (`/tech/offers`)

> **Auth Required:** Yes (technician role)

#### 6.4.1 `POST /tech/offers` — Submit an offer on a service request

**Why this route exists:** This is how technicians bid on service requests. They specify repair mode, cost estimate, time estimate, and optional message.

**How the code works:**
1. Verifies technician is verified and online
2. Verifies request exists and is accepting offers (status "created" or "pending_offers")
3. Prevents duplicate offers
4. Creates the offer in a transaction
5. Updates request status to "pending_offers" if it was "created"

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/tech/offers
Authorization: Bearer {{TECH_TOKEN}}
```

**Body:**
```json
{
  "request_id": "<service_request_id_uuid>",
  "repair_mode": "onsite",
  "estimated_cost": 2500.00,
  "estimated_time": 120,
  "message": "I can reach you in 30 minutes. I have experience with battery issues."
}
```

**Valid `repair_mode`:** `onsite`, `tow_to_garage`

> ⚠️ **Important:** The technician must be verified (`is_verified = true`) and online (`is_online = true`). If you just signed up, you need an admin to verify you first (see admin routes below), or manually update in DB:
> ```sql
> UPDATE technician_profiles SET is_verified = true WHERE user_id = '<uuid>';
> ```

**DB Verification:**
```sql
SELECT * FROM technician_offers WHERE request_id = '<uuid>';
SELECT status FROM service_requests WHERE request_id = '<uuid>';
-- status should now be 'pending_offers'
```

---

#### 6.4.2 `GET /tech/offers` — List my offers

```
Method: GET
URL: {{BASE_URL}}/tech/offers?page=1&limit=10
Authorization: Bearer {{TECH_TOKEN}}
```

---

#### 6.4.3 `GET /tech/offers/:offerId` — Get offer details

```
Method: GET
URL: {{BASE_URL}}/tech/offers/<offer_id_uuid>
Authorization: Bearer {{TECH_TOKEN}}
```

---

### 6.5 Tech Assignment Routes (`/tech/assignments`)

> **Auth Required:** Yes (technician role)

#### 6.5.1 `GET /tech/assignments/pending` — List pending assignments

**Why this route exists:** After a user accepts a technician's offer, a Job is created with status "assigned". This endpoint shows those jobs waiting for the technician to start.

**Postman Setup:**
```
Method: GET
URL: {{BASE_URL}}/tech/assignments/pending
Authorization: Bearer {{TECH_TOKEN}}
```

---

#### 6.5.2 `POST /tech/assignments/:jobId/accept` — Accept assignment

**Why this route exists:** Technician confirms they'll start working. Changes job status from "assigned" to "in_progress". Prevents multiple active jobs (only one at a time).

**How the code works:**
1. Verifies job exists and belongs to this technician
2. Job must be in "assigned" status
3. In a transaction:
   - Checks no other in_progress jobs
   - Updates job → "in_progress", sets `started_at`
   - Updates service request → "in_progress"

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/tech/assignments/<job_id_uuid>/accept
Authorization: Bearer {{TECH_TOKEN}}
```

---

#### 6.5.3 `POST /tech/assignments/:jobId/reject` — Reject assignment

**Why this route exists:** If a technician can't handle the job, they can reject it. This soft-deletes the job, reverts the offer, and updates the request status.

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/tech/assignments/<job_id_uuid>/reject
Authorization: Bearer {{TECH_TOKEN}}
```

---

### 6.6 Tech Job Routes (`/tech/jobs`)

> **Auth Required:** Yes (technician role)

#### 6.6.1 `GET /tech/jobs` — List my jobs

```
Method: GET
URL: {{BASE_URL}}/tech/jobs?page=1&limit=10&status=in_progress
Authorization: Bearer {{TECH_TOKEN}}
```

**Optional:** `?status=assigned` / `?status=in_progress` / `?status=completed`

---

#### 6.6.2 `GET /tech/jobs/:jobId` — Get job details

```
Method: GET
URL: {{BASE_URL}}/tech/jobs/<job_id_uuid>
Authorization: Bearer {{TECH_TOKEN}}
```

---

#### 6.6.3 `PATCH /tech/jobs/:jobId/status` — Update job status

**Why this route exists:** Allows status transitions: `assigned` → `in_progress` → `completed`. Also syncs the parent service request status.

**Postman Setup:**
```
Method: PATCH
URL: {{BASE_URL}}/tech/jobs/<job_id_uuid>/status
Authorization: Bearer {{TECH_TOKEN}}
```

**Body:**
```json
{
  "status": "in_progress"
}
```

Or to complete:
```json
{
  "status": "completed"
}
```

---

#### 6.6.4 `POST /tech/jobs/:jobId/suggest-parts` — Suggest parts needed

**Why this route exists:** During an in-progress job, the technician can suggest which parts are needed (added to the service request's parts list).

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/tech/jobs/<job_id_uuid>/suggest-parts
Authorization: Bearer {{TECH_TOKEN}}
```

**Body:**
```json
{
  "parts": [
    { "part_id": 1, "quantity": 1 },
    { "part_id": 2, "quantity": 2 }
  ]
}
```

> ⚠️ Check `car_parts` table for valid `part_id` values.

---

#### 6.6.5 `POST /tech/jobs/:jobId/complete` — Complete a job

**Why this route exists:** Alternative to `PATCH /status` — explicitly marks job as completed. Updates both job and service request.

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/tech/jobs/<job_id_uuid>/complete
Authorization: Bearer {{TECH_TOKEN}}
```

---

#### 6.6.6 `POST /tech/jobs/:jobId/invoice` — Create invoice for job

**Why this route exists:** After completing a job, the technician creates an invoice detailing labor, parts, towing, and other charges. Calculates totals using Decimal math.

**How the code works:**
1. Verifies job is "completed" status
2. Checks no invoice already exists for this job
3. Calculates: `unit_price × quantity` per item → sum to subtotal → apply tax rate → total
4. Creates Invoice + InvoiceItems

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/tech/jobs/<job_id_uuid>/invoice
Authorization: Bearer {{TECH_TOKEN}}
```

**Body:**
```json
{
  "items": [
    {
      "item_type": "labor",
      "description": "Battery replacement labor - 2 hours",
      "quantity": 2,
      "unit_price": 500
    },
    {
      "item_type": "part",
      "description": "Exide 65Ah Battery",
      "quantity": 1,
      "unit_price": 6500
    },
    {
      "item_type": "diagnostic",
      "description": "Electrical system diagnostic",
      "quantity": 1,
      "unit_price": 300
    }
  ],
  "tax_rate": 18
}
```

**Valid `item_type`:** `labor`, `part`, `towing`, `diagnostic`, `other`

**DB Verification:**
```sql
SELECT * FROM invoices WHERE job_id = '<uuid>';
SELECT * FROM invoice_items WHERE invoice_id = '<uuid>';
```

---

### 6.7 Tech Earnings Routes (`/tech/earnings`)

> **Auth Required:** Yes (technician role)

#### 6.7.1 `GET /tech/earnings` — View earnings summary

**Why this route exists:** Shows a summary of the technician's earnings from completed jobs with invoices. Breaks down into paid vs pending amounts.

**Postman Setup:**
```
Method: GET
URL: {{BASE_URL}}/tech/earnings
Authorization: Bearer {{TECH_TOKEN}}
```

---

### 6.8 Tech Location Routes (`/tech/location`)

> **Auth Required:** Yes (technician role)

#### 6.8.1 `POST /tech/location` — Update live location

**Why this route exists:** Updates the technician's real-time GPS coordinates. Used for proximity-based matching with service requests.

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/tech/location
Authorization: Bearer {{TECH_TOKEN}}
```

**Body:**
```json
{
  "latitude": 19.1370,
  "longitude": 72.8300
}
```

---

### 6.9 Tech Message Routes (`/tech/requests/:id/messages`)

> **Auth Required:** Yes (technician role)

#### 6.9.1 `GET /tech/requests/:requestId/messages` — Get messages

**Why this route exists:** Technicians can view messages for requests they have active offers on. Marks received messages as read.

**Postman Setup:**
```
Method: GET
URL: {{BASE_URL}}/tech/requests/<request_id_uuid>/messages
Authorization: Bearer {{TECH_TOKEN}}
```

---

#### 6.9.2 `POST /tech/requests/:requestId/messages` — Send message

**Why this route exists:** Technicians can message the user who created the service request. Must have an active offer.

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/tech/requests/<request_id_uuid>/messages
Authorization: Bearer {{TECH_TOKEN}}
```

**Body:**
```json
{
  "receiver_id": "<user_who_created_the_request_uuid>",
  "message": "I'm on my way. ETA 20 minutes."
}
```

---

## 7. ADMIN Module Routes

These routes are for platform administrators (role = `admin`). ALL routes require admin authentication.

> ⚠️ **There is no admin signup route!** Admin accounts must be created manually in the database:
> ```sql
> -- First, create a bcrypt hash of the password. Use Node.js:
> -- const bcrypt = require('bcrypt'); console.log(await bcrypt.hash('Admin@1234', 10));
> 
> INSERT INTO users (user_id, full_name, email, phone_number, password, role, is_active)
> VALUES (gen_random_uuid(), 'Platform Admin', 'admin@example.com', '9999999999', '<bcrypt_hash>', 'admin', true);
> ```

---

### 7.1 Admin Auth Routes (`/admin/auth`)

#### 7.1.1 `POST /admin/auth/signin` — Admin login

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/admin/auth/signin
```

**Body:**
```json
{
  "email": "admin@example.com",
  "password": "Admin@1234"
}
```

---

#### 7.1.2 `POST /admin/auth/logout` — Admin logout

```
Method: POST
URL: {{BASE_URL}}/admin/auth/logout
```

---

#### 7.1.3 `POST /admin/auth/refresh` — Refresh admin tokens

```
Method: POST
URL: {{BASE_URL}}/admin/auth/refresh
```

---

### 7.2 Admin Dashboard Routes (`/admin/dashboard`)

#### 7.2.1 `GET /admin/dashboard` — Platform overview

**Why this route exists:** Shows a high-level dashboard with counts of users, technicians, vendors, warehouses, and breakdowns by status for requests, jobs, orders, and invoices. Also shows 5 most recent requests.

**Postman Setup:**
```
Method: GET
URL: {{BASE_URL}}/admin/dashboard
Authorization: Bearer {{ADMIN_TOKEN}}
```

---

### 7.3 Admin User Management Routes (`/admin/users`)

#### 7.3.1 `GET /admin/users` — List all users

**Why this route exists:** Admin can view, search, and filter all platform users.

**Postman Setup:**
```
Method: GET
URL: {{BASE_URL}}/admin/users?page=1&limit=20
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Optional query params:**
- `?role=user` / `?role=technician` / `?role=vendor`
- `?is_active=true` / `?is_active=false`
- `?search=john` (searches name and email)
- `?from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.000Z`

---

#### 7.3.2 `GET /admin/users/:userId` — Get user details

```
Method: GET
URL: {{BASE_URL}}/admin/users/<user_id_uuid>
Authorization: Bearer {{ADMIN_TOKEN}}
```

---

#### 7.3.3 `PATCH /admin/users/:userId/block` — Block a user

**Why this route exists:** Admin can suspend a user account (sets `is_active = false`). Creates an audit log entry.

**Postman Setup:**
```
Method: PATCH
URL: {{BASE_URL}}/admin/users/<user_id_uuid>/block
Authorization: Bearer {{ADMIN_TOKEN}}
```

**DB Verification:**
```sql
SELECT is_active FROM users WHERE user_id = '<uuid>';
SELECT * FROM audit_logs WHERE entity_id = '<uuid>' AND action = 'BLOCK_USER';
```

---

#### 7.3.4 `PATCH /admin/users/:userId/unblock` — Unblock a user

```
Method: PATCH
URL: {{BASE_URL}}/admin/users/<user_id_uuid>/unblock
Authorization: Bearer {{ADMIN_TOKEN}}
```

---

#### 7.3.5 `DELETE /admin/users/:userId` — Soft-delete a user

**Why this route exists:** Admin can delete user accounts (soft-delete). Cannot delete other admins or self.

```
Method: DELETE
URL: {{BASE_URL}}/admin/users/<user_id_uuid>
Authorization: Bearer {{ADMIN_TOKEN}}
```

---

### 7.4 Admin Technician Management Routes (`/admin/technicians`)

#### 7.4.1 `GET /admin/technicians` — List all technicians

```
Method: GET
URL: {{BASE_URL}}/admin/technicians?page=1&limit=20
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Optional query params:**
- `?is_verified=true` / `?is_verified=false`
- `?is_online=true`
- `?technician_type=individual` / `?technician_type=garage`
- `?search=john`

---

#### 7.4.2 `GET /admin/technicians/:techId` — Get technician details

```
Method: GET
URL: {{BASE_URL}}/admin/technicians/<technician_id_uuid>
Authorization: Bearer {{ADMIN_TOKEN}}
```

---

#### 7.4.3 `PATCH /admin/technicians/:techId/verify` — Verify a technician

**Why this route exists:** Technicians must be verified by an admin before they can submit offers. This sets `is_verified = true`.

**Postman Setup:**
```
Method: PATCH
URL: {{BASE_URL}}/admin/technicians/<technician_id_uuid>/verify
Authorization: Bearer {{ADMIN_TOKEN}}
```

> 💡 **This is a critical step!** After a technician signs up, they can't submit offers until an admin verifies them.

**DB Verification:**
```sql
SELECT is_verified FROM technician_profiles WHERE technician_id = '<uuid>';
SELECT * FROM audit_logs WHERE entity_id = '<uuid>' AND action = 'VERIFY_TECHNICIAN';
```

---

#### 7.4.4 `PATCH /admin/technicians/:techId/suspend` — Suspend a technician

**Why this route exists:** Suspends the technician's user account and sets them offline + unverified. Creates audit log.

```
Method: PATCH
URL: {{BASE_URL}}/admin/technicians/<technician_id_uuid>/suspend
Authorization: Bearer {{ADMIN_TOKEN}}
```

---

#### 7.4.5 `PATCH /admin/technicians/:techId/unsuspend` — Unsuspend a technician

```
Method: PATCH
URL: {{BASE_URL}}/admin/technicians/<technician_id_uuid>/unsuspend
Authorization: Bearer {{ADMIN_TOKEN}}
```

---

#### 7.4.6 `GET /admin/technicians/:techId/jobs` — View technician's jobs

```
Method: GET
URL: {{BASE_URL}}/admin/technicians/<technician_id_uuid>/jobs?page=1&limit=20
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Optional:** `?status=completed`, `?from=...&to=...`

---

### 7.5 Admin Vendor Management Routes (`/admin/vendors`)

#### 7.5.1 `GET /admin/vendors` — List all vendors

```
Method: GET
URL: {{BASE_URL}}/admin/vendors?page=1&limit=20
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Optional:** `?is_active=true`, `?search=vendor`

---

#### 7.5.2 `GET /admin/vendors/:vendorId` — Get vendor details

```
Method: GET
URL: {{BASE_URL}}/admin/vendors/<vendor_user_id_uuid>
Authorization: Bearer {{ADMIN_TOKEN}}
```

---

#### 7.5.3 `PATCH /admin/vendors/:vendorId/suspend` — Suspend a vendor

**Why this route exists:** Suspends vendor account and deactivates ALL their warehouses. Creates audit log.

```
Method: PATCH
URL: {{BASE_URL}}/admin/vendors/<vendor_user_id_uuid>/suspend
Authorization: Bearer {{ADMIN_TOKEN}}
```

---

#### 7.5.4 `PATCH /admin/vendors/:vendorId/unsuspend` — Unsuspend a vendor

**Reactivates vendor account + all warehouses.**

```
Method: PATCH
URL: {{BASE_URL}}/admin/vendors/<vendor_user_id_uuid>/unsuspend
Authorization: Bearer {{ADMIN_TOKEN}}
```

---

#### 7.5.5 `GET /admin/vendors/:vendorId/warehouses` — List vendor's warehouses

```
Method: GET
URL: {{BASE_URL}}/admin/vendors/<vendor_user_id_uuid>/warehouses?page=1&limit=20
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Optional:** `?is_active=true`, `?city=Mumbai`, `?state=Maharashtra`

---

### 7.6 Admin Warehouse Management Routes (`/admin/warehouses`)

#### 7.6.1 `GET /admin/warehouses` — List all warehouses

```
Method: GET
URL: {{BASE_URL}}/admin/warehouses?page=1&limit=20
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Optional:** `?is_active=true`, `?city=Mumbai`, `?state=Maharashtra`

---

#### 7.6.2 `GET /admin/warehouses/:warehouseId` — Get warehouse details

```
Method: GET
URL: {{BASE_URL}}/admin/warehouses/<warehouse_id_uuid>
Authorization: Bearer {{ADMIN_TOKEN}}
```

---

#### 7.6.3 `GET /admin/warehouses/:warehouseId/inventory` — View warehouse inventory

```
Method: GET
URL: {{BASE_URL}}/admin/warehouses/<warehouse_id_uuid>/inventory?page=1&limit=20
Authorization: Bearer {{ADMIN_TOKEN}}
```

---

### 7.7 Admin Request Management Routes (`/admin/requests`)

#### 7.7.1 `GET /admin/requests` — List all service requests

```
Method: GET
URL: {{BASE_URL}}/admin/requests?page=1&limit=20
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Optional:**
- `?status=created` / `pending_offers` / `offer_accepted` / `in_progress` / `completed` / `cancelled`
- `?issue_type=battery_issue`
- `?from=...&to=...`

---

#### 7.7.2 `GET /admin/requests/:requestId` — Get full request details

```
Method: GET
URL: {{BASE_URL}}/admin/requests/<request_id_uuid>
Authorization: Bearer {{ADMIN_TOKEN}}
```

---

#### 7.7.3 `PATCH /admin/requests/:requestId/cancel` — Cancel a request

**Why this route exists:** Admin can force-cancel any request. Expires pending offers and soft-deletes active jobs. Creates audit log.

```
Method: PATCH
URL: {{BASE_URL}}/admin/requests/<request_id_uuid>/cancel
Authorization: Bearer {{ADMIN_TOKEN}}
```

---

#### 7.7.4 `POST /admin/requests/:requestId/force-assign` — Force-assign technician

**Why this route exists:** Admin can directly assign a technician to a request, bypassing the normal offer/accept flow. Creates an accepted offer + job in one go.

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/admin/requests/<request_id_uuid>/force-assign
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Body:**
```json
{
  "technician_id": "<technician_id_uuid>",
  "repair_mode": "onsite",
  "estimated_cost": 3000,
  "estimated_time": 90
}
```

---

### 7.8 Admin Job Management Routes (`/admin/jobs`)

#### 7.8.1 `GET /admin/jobs` — List all jobs

```
Method: GET
URL: {{BASE_URL}}/admin/jobs?page=1&limit=20
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Optional:** `?status=in_progress`, `?from=...&to=...`

---

#### 7.8.2 `GET /admin/jobs/:jobId` — Get job details

```
Method: GET
URL: {{BASE_URL}}/admin/jobs/<job_id_uuid>
Authorization: Bearer {{ADMIN_TOKEN}}
```

---

### 7.9 Admin Order Management Routes (`/admin/orders`)

#### 7.9.1 `GET /admin/orders` — List all orders

```
Method: GET
URL: {{BASE_URL}}/admin/orders?page=1&limit=20
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Optional:** `?order_status=pending`, `?payment_status=completed`, `?from=...&to=...`

---

#### 7.9.2 `GET /admin/orders/:orderId` — Get order details

```
Method: GET
URL: {{BASE_URL}}/admin/orders/<order_id_uuid>
Authorization: Bearer {{ADMIN_TOKEN}}
```

---

#### 7.9.3 `POST /admin/orders/:orderId/refund` — Refund an order

**Why this route exists:** Admin can refund a paid order. Marks order as refunded + cancelled, releases inventory reservations, creates audit log.

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/admin/orders/<order_id_uuid>/refund
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Body:**
```json
{
  "reason": "Customer complained about wrong part delivered"
}
```

---

### 7.10 Admin Invoice Management Routes (`/admin/invoices`)

#### 7.10.1 `GET /admin/invoices` — List all invoices

```
Method: GET
URL: {{BASE_URL}}/admin/invoices?page=1&limit=20
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Optional:** `?payment_status=pending`, `?from=...&to=...`

---

#### 7.10.2 `GET /admin/invoices/:invoiceId` — Get invoice details

```
Method: GET
URL: {{BASE_URL}}/admin/invoices/<invoice_id_uuid>
Authorization: Bearer {{ADMIN_TOKEN}}
```

---

#### 7.10.3 `PATCH /admin/invoices/:invoiceId/mark-paid` — Mark invoice as paid

**Why this route exists:** Admin override to mark an invoice as paid (e.g., cash payment). Creates audit log.

```
Method: PATCH
URL: {{BASE_URL}}/admin/invoices/<invoice_id_uuid>/mark-paid
Authorization: Bearer {{ADMIN_TOKEN}}
```

---

### 7.11 Admin Analytics Routes (`/admin/analytics`)

#### 7.11.1 `GET /admin/analytics/revenue` — Revenue analytics

**Why this route exists:** Shows total platform revenue from service invoices and parts orders.

```
Method: GET
URL: {{BASE_URL}}/admin/analytics/revenue
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Optional:** `?from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.000Z`

---

#### 7.11.2 `GET /admin/analytics/matching` — Request matching analytics

**Why this route exists:** Shows how effectively requests are matched to technicians — completion rate, cancellation rate, average offers per request.

```
Method: GET
URL: {{BASE_URL}}/admin/analytics/matching
Authorization: Bearer {{ADMIN_TOKEN}}
```

---

#### 7.11.3 `GET /admin/analytics/performance` — Technician performance

**Why this route exists:** Shows job completion rates, average job duration, and top 10 technicians by completed jobs.

```
Method: GET
URL: {{BASE_URL}}/admin/analytics/performance
Authorization: Bearer {{ADMIN_TOKEN}}
```

---

### 7.12 Admin Audit Log Routes (`/admin/audit-logs`)

#### 7.12.1 `GET /admin/audit-logs` — View audit logs

**Why this route exists:** Every admin action (block, verify, suspend, refund, etc.) is logged. This endpoint lets admins review the history.

```
Method: GET
URL: {{BASE_URL}}/admin/audit-logs?page=1&limit=20
Authorization: Bearer {{ADMIN_TOKEN}}
```

**Optional:**
- `?entity_type=User` / `TechnicianProfile` / `ServiceRequest` / `Order` / `Invoice`
- `?action=BLOCK_USER`
- `?performed_by=<admin_user_id>`
- `?from=...&to=...`

---

## 8. VENDOR Module Routes

These routes are for parts suppliers (role = `vendor`). All routes (except auth) require authentication with a vendor account.

---

### 8.1 Vendor Auth Routes (`/vendor/auth`)

#### 8.1.1 `POST /vendor/auth/signup` — Register as vendor

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/vendor/auth/signup
```

**Body:**
```json
{
  "email": "vendor@example.com",
  "password": "Vendor@1234",
  "full_name": "AutoParts Hub",
  "phone_number": "7654321098"
}
```

---

#### 8.1.2 `POST /vendor/auth/signin` — Vendor login

```
Method: POST
URL: {{BASE_URL}}/vendor/auth/signin
```

**Body:**
```json
{
  "email": "vendor@example.com",
  "password": "Vendor@1234"
}
```

---

#### 8.1.3 `POST /vendor/auth/logout` — Vendor logout

```
Method: POST
URL: {{BASE_URL}}/vendor/auth/logout
```

---

#### 8.1.4 `POST /vendor/auth/refresh` — Refresh vendor tokens

```
Method: POST
URL: {{BASE_URL}}/vendor/auth/refresh
```

---

### 8.2 Vendor Warehouse Routes (`/vendor/warehouses`)

> **Auth Required:** Yes (vendor role)

#### 8.2.1 `POST /vendor/warehouses` — Create a warehouse

**Why this route exists:** Vendors need at least one warehouse to manage inventory and fulfill orders.

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/vendor/warehouses
Authorization: Bearer {{VENDOR_TOKEN}}
```

**Body:**
```json
{
  "name": "Mumbai Central Warehouse",
  "address": "123 Main Street, Lower Parel",
  "city": "Mumbai",
  "state": "Maharashtra",
  "postal_code": "400013",
  "latitude": 18.9977,
  "longitude": 72.8310,
  "phone": "0221234567"
}
```

**DB Verification:**
```sql
SELECT * FROM warehouses ORDER BY created_at DESC LIMIT 1;
```

---

#### 8.2.2 `GET /vendor/warehouses` — List my warehouses

```
Method: GET
URL: {{BASE_URL}}/vendor/warehouses?page=1&limit=10
Authorization: Bearer {{VENDOR_TOKEN}}
```

**Optional:** `?is_active=true`

---

#### 8.2.3 `GET /vendor/warehouses/:warehouseId` — Get warehouse details

```
Method: GET
URL: {{BASE_URL}}/vendor/warehouses/<warehouse_id_uuid>
Authorization: Bearer {{VENDOR_TOKEN}}
```

---

#### 8.2.4 `PUT /vendor/warehouses/:warehouseId` — Update warehouse

```
Method: PUT
URL: {{BASE_URL}}/vendor/warehouses/<warehouse_id_uuid>
Authorization: Bearer {{VENDOR_TOKEN}}
```

**Body:**
```json
{
  "name": "Mumbai Central Warehouse - Updated",
  "phone": "0229876543"
}
```

---

#### 8.2.5 `DELETE /vendor/warehouses/:warehouseId` — Deactivate warehouse

**Note:** This is a soft-deactivate (`is_active = false`), not a permanent delete.

```
Method: DELETE
URL: {{BASE_URL}}/vendor/warehouses/<warehouse_id_uuid>
Authorization: Bearer {{VENDOR_TOKEN}}
```

---

### 8.3 Vendor Inventory Routes (`/vendor/warehouses/:id/inventory` & `/vendor/inventory/:id`)

> **Auth Required:** Yes (vendor role)

#### 8.3.1 `POST /vendor/warehouses/:warehouseId/inventory` — Add inventory item

**Why this route exists:** Adds a new car part to a warehouse's inventory with stock quantity and pricing.

**Postman Setup:**
```
Method: POST
URL: {{BASE_URL}}/vendor/warehouses/<warehouse_id_uuid>/inventory
Authorization: Bearer {{VENDOR_TOKEN}}
```

**Body:**
```json
{
  "part_id": 1,
  "quantity_available": 100,
  "unit_cost": 450.00,
  "reorder_level": 10
}
```

> ⚠️ You need valid `part_id` values. Check:
> ```sql
> SELECT * FROM car_parts LIMIT 10;
> ```
> If empty, you need to seed car parts data first.

**DB Verification:**
```sql
SELECT * FROM inventories WHERE warehouse_id = '<uuid>' AND part_id = 1;
```

---

#### 8.3.2 `GET /vendor/warehouses/:warehouseId/inventory` — List inventory

```
Method: GET
URL: {{BASE_URL}}/vendor/warehouses/<warehouse_id_uuid>/inventory?page=1&limit=20
Authorization: Bearer {{VENDOR_TOKEN}}
```

**Optional:** `?low_stock=true` (filters items at or below reorder level)

---

#### 8.3.3 `PUT /vendor/inventory/:inventoryId` — Update inventory item

**Why this route exists:** Update stock levels, unit cost, or reorder level. Prevents setting available below reserved quantity.

```
Method: PUT
URL: {{BASE_URL}}/vendor/inventory/<inventory_id_uuid>
Authorization: Bearer {{VENDOR_TOKEN}}
```

**Body:**
```json
{
  "quantity_available": 150,
  "unit_cost": 475.00,
  "reorder_level": 15
}
```

---

#### 8.3.4 `DELETE /vendor/inventory/:inventoryId` — Delete inventory item

**Note:** Cannot delete if there are active reservations.

```
Method: DELETE
URL: {{BASE_URL}}/vendor/inventory/<inventory_id_uuid>
Authorization: Bearer {{VENDOR_TOKEN}}
```

---

#### 8.3.5 `POST /vendor/warehouses/:warehouseId/inventory/bulk` — Bulk upsert inventory

**Why this route exists:** Allows vendors to add or update multiple inventory items at once. Uses upsert (create if missing, update if exists).

```
Method: POST
URL: {{BASE_URL}}/vendor/warehouses/<warehouse_id_uuid>/inventory/bulk
Authorization: Bearer {{VENDOR_TOKEN}}
```

**Body:**
```json
{
  "items": [
    { "part_id": 1, "quantity_available": 100, "unit_cost": 450.00, "reorder_level": 10 },
    { "part_id": 2, "quantity_available": 50, "unit_cost": 1200.00, "reorder_level": 5 },
    { "part_id": 3, "quantity_available": 200, "unit_cost": 75.00, "reorder_level": 20 }
  ]
}
```

---

### 8.4 Vendor Reservation Routes (`/vendor/warehouses/:id/reservations` & `/vendor/reservations/:id`)

> **Auth Required:** Yes (vendor role)

#### 8.4.1 `GET /vendor/warehouses/:warehouseId/reservations` — List reservations

**Why this route exists:** Shows all inventory reservations for a warehouse. Useful for tracking which stock is held for pending orders.

```
Method: GET
URL: {{BASE_URL}}/vendor/warehouses/<warehouse_id_uuid>/reservations?page=1&limit=20
Authorization: Bearer {{VENDOR_TOKEN}}
```

**Optional:** `?status=active` / `expired` / `converted` / `cancelled`

---

#### 8.4.2 `GET /vendor/reservations/:reservationId` — Get reservation details

```
Method: GET
URL: {{BASE_URL}}/vendor/reservations/<reservation_id_uuid>
Authorization: Bearer {{VENDOR_TOKEN}}
```

---

### 8.5 Vendor Order Routes (`/vendor/orders`)

> **Auth Required:** Yes (vendor role)

#### 8.5.1 `GET /vendor/orders` — List orders for my warehouses

```
Method: GET
URL: {{BASE_URL}}/vendor/orders?page=1&limit=20
Authorization: Bearer {{VENDOR_TOKEN}}
```

**Optional:** `?order_status=pending`, `?payment_status=completed`, `?from=...&to=...`

---

#### 8.5.2 `GET /vendor/orders/:orderId` — Get order details

```
Method: GET
URL: {{BASE_URL}}/vendor/orders/<order_id_uuid>
Authorization: Bearer {{VENDOR_TOKEN}}
```

---

#### 8.5.3 `PATCH /vendor/orders/:orderId/confirm` — Confirm an order

**Why this route exists:** After a user pays, the vendor confirms the order (transitions `pending` → `confirmed`).

```
Method: PATCH
URL: {{BASE_URL}}/vendor/orders/<order_id_uuid>/confirm
Authorization: Bearer {{VENDOR_TOKEN}}
```

---

#### 8.5.4 `PATCH /vendor/orders/:orderId/cancel` — Cancel an order

**Why this route exists:** Vendor can cancel an order. Releases inventory reservations and restores stock.

```
Method: PATCH
URL: {{BASE_URL}}/vendor/orders/<order_id_uuid>/cancel
Authorization: Bearer {{VENDOR_TOKEN}}
```

---

#### 8.5.5 `POST /vendor/orders/:orderId/return` — Process return

**Why this route exists:** Handles return of delivered orders. Restores inventory, refunds payment, updates order status.

```
Method: POST
URL: {{BASE_URL}}/vendor/orders/<order_id_uuid>/return
Authorization: Bearer {{VENDOR_TOKEN}}
```

**Body:**
```json
{
  "reason": "Customer received wrong part"
}
```

---

### 8.6 Vendor Fulfillment Routes (`/vendor/orders/:id/fulfillment` & `/vendor/fulfillment/:id/status`)

> **Auth Required:** Yes (vendor role)

#### 8.6.1 `GET /vendor/orders/:orderId/fulfillment` — Get fulfillment status

```
Method: GET
URL: {{BASE_URL}}/vendor/orders/<order_id_uuid>/fulfillment
Authorization: Bearer {{VENDOR_TOKEN}}
```

---

#### 8.6.2 `PATCH /vendor/fulfillment/:fulfillmentId/status` — Update fulfillment status

**Why this route exists:** Tracks the shipment lifecycle: pending → processing → shipped → in_transit → delivered. When all fulfillments are delivered, the order is marked delivered.

**Status transitions allowed:**
- `pending` → `processing`, `failed`
- `processing` → `shipped`, `failed`
- `shipped` → `in_transit`, `delivered`, `failed`
- `in_transit` → `delivered`, `failed`

**Postman Setup:**
```
Method: PATCH
URL: {{BASE_URL}}/vendor/fulfillment/<fulfillment_id_uuid>/status
Authorization: Bearer {{VENDOR_TOKEN}}
```

**Body (example — mark as shipped):**
```json
{
  "status": "shipped",
  "tracking_number": "TRACK123456",
  "carrier": "BlueDart",
  "estimated_delivery": "2026-03-01T12:00:00.000Z",
  "notes": "Dispatched from Mumbai warehouse"
}
```

---

### 8.7 Vendor Analytics Routes (`/vendor/analytics`)

> **Auth Required:** Yes (vendor role)

#### 8.7.1 `GET /vendor/analytics/revenue` — Revenue analytics

```
Method: GET
URL: {{BASE_URL}}/vendor/analytics/revenue
Authorization: Bearer {{VENDOR_TOKEN}}
```

**Optional:** `?from=...&to=...`

---

#### 8.7.2 `GET /vendor/analytics/orders` — Order analytics

```
Method: GET
URL: {{BASE_URL}}/vendor/analytics/orders
Authorization: Bearer {{VENDOR_TOKEN}}
```

---

#### 8.7.3 `GET /vendor/analytics/inventory` — Inventory analytics

```
Method: GET
URL: {{BASE_URL}}/vendor/analytics/inventory
Authorization: Bearer {{VENDOR_TOKEN}}
```

---

#### 8.7.4 `GET /vendor/warehouses/:warehouseId/low-stock` — Low stock items

```
Method: GET
URL: {{BASE_URL}}/vendor/warehouses/<warehouse_id_uuid>/low-stock?page=1&limit=20
Authorization: Bearer {{VENDOR_TOKEN}}
```

**Optional:** `?threshold=20` (custom threshold, defaults to each item's reorder_level)

---

## 9. Complete End-to-End Testing Flow

Follow this exact sequence to test the full platform lifecycle:

### Phase 1: Setup Accounts

| Step | Action | Method & URL |
|---|---|---|
| 1 | Create admin account | **Manual SQL** (see section 7) |
| 2 | Admin signs in | `POST /admin/auth/signin` |
| 3 | User signs up | `POST /auth/signup` |
| 4 | Technician signs up | `POST /tech/auth/signup` |
| 5 | Vendor signs up | `POST /vendor/auth/signup` |
| 6 | Admin verifies technician | `PATCH /admin/technicians/:techId/verify` |

### Phase 2: Vendor Sets Up Shop

| Step | Action | Method & URL |
|---|---|---|
| 7 | Vendor creates warehouse | `POST /vendor/warehouses` |
| 8 | Vendor adds inventory (need car parts data) | `POST /vendor/warehouses/:id/inventory` |

> ⚠️ Before step 8, ensure `car_parts` and `car_part_categories` tables have data. If empty, seed them:
> ```sql
> INSERT INTO car_part_categories (category_name) VALUES ('Engine'), ('Electrical'), ('Brakes'), ('Tires');
> INSERT INTO car_parts (part_name, category_id) VALUES ('Spark Plug', 1), ('Battery', 2), ('Brake Pad', 3), ('Tire 205/55R16', 4);
> ```

### Phase 3: User Creates Service Request

| Step | Action | Method & URL |
|---|---|---|
| 9 | User adds vehicle (need car variants data) | `POST /vehicles` |
| 10 | User creates service request | `POST /requests` |

> ⚠️ Before step 9, ensure `car_companies`, `car_models`, `car_variants` have data:
> ```sql
> INSERT INTO car_companies (company_name) VALUES ('Maruti Suzuki'), ('Hyundai'), ('Tata');
> INSERT INTO car_models (company_id, model_name) VALUES (1, 'Swift'), (2, 'i20'), (3, 'Nexon');
> INSERT INTO car_variants (model_id, variant_name, year, fuel_type, transmission) VALUES (1, 'VXi', 2024, 'petrol', 'manual'), (2, 'Sportz', 2024, 'petrol', 'automatic'), (3, 'XZ+', 2024, 'diesel', 'manual');
> ```

### Phase 4: Technician Responds

| Step | Action | Method & URL |
|---|---|---|
| 11 | Technician goes online | `PATCH /tech/availability` with `{"is_online": true}` |
| 12 | Technician submits offer | `POST /tech/offers` |
| 13 | User views offers | `GET /requests/:requestId/offers` |
| 14 | User accepts offer | `PATCH /offers/:offerId/accept` |

### Phase 5: Job Lifecycle

| Step | Action | Method & URL |
|---|---|---|
| 15 | Tech views pending assignments | `GET /tech/assignments/pending` |
| 16 | Tech accepts assignment | `POST /tech/assignments/:jobId/accept` |
| 17 | Tech suggests parts | `POST /tech/jobs/:jobId/suggest-parts` |
| 18 | Tech completes job | `POST /tech/jobs/:jobId/complete` |
| 19 | Tech creates invoice | `POST /tech/jobs/:jobId/invoice` |
| 20 | User pays invoice | `POST /invoices/:invoiceId/pay` |
| 21 | User leaves review | `POST /reviews` |

### Phase 6: Parts Ordering

| Step | Action | Method & URL |
|---|---|---|
| 22 | User creates order | `POST /orders` |
| 23 | User pays order | `POST /orders/:orderId/pay` |
| 24 | Vendor confirms order | `PATCH /vendor/orders/:orderId/confirm` |
| 25 | Vendor updates fulfillment | `PATCH /vendor/fulfillment/:id/status` (processing → shipped → delivered) |
| 26 | User tracks fulfillment | `GET /orders/:orderId/fulfillment` |

### Phase 7: Messaging

| Step | Action | Method & URL |
|---|---|---|
| 27 | User sends message to tech | `POST /requests/:requestId/messages` |
| 28 | Tech reads messages | `GET /tech/requests/:requestId/messages` |
| 29 | Tech replies | `POST /tech/requests/:requestId/messages` |

### Phase 8: Admin Oversight

| Step | Action | Method & URL |
|---|---|---|
| 30 | Admin views dashboard | `GET /admin/dashboard` |
| 31 | Admin checks analytics | `GET /admin/analytics/revenue`, `/matching`, `/performance` |
| 32 | Admin views audit logs | `GET /admin/audit-logs` |

---

## 10. Middleware Explained

### Request Flow Through Middleware:

```
1. CORS          → Allows cross-origin requests from frontend (localhost:5173)
2. express.json  → Parses JSON request body
3. cookieParser  → Parses cookies from request headers
4. validateUUID  → Auto-validates any URL params ending with "Id" are valid UUID format
5. authLimiter   → (only on auth routes) Rate limits: 10 req / 15 min
6. userAuth      → Extracts + verifies JWT, loads user from DB, sets req.userId & req.userRole
7. roleGuard     → Checks req.userRole is in allowed list (e.g., "user", "admin")
8. validate      → Parses req.body with Zod schema, returns 400 with errors if invalid
9. Route Handler → Your actual business logic
10. errorHandler → Catches thrown errors (AppError, ZodError, or unknown) and returns JSON
```

### How `userAuth` works in detail:

```javascript
// 1. Check cookie: req.cookies.accessToken or req.cookies.authcookie
// 2. Check header: Authorization: Bearer <token>
// 3. If no token found → 401 "Authentication token missing"
// 4. Verify token with jwt.verify(token, USER_SECRET)
//    - If expired → 401 "Access token expired" with code TOKEN_EXPIRED
//    - If invalid → 401 "Invalid authentication token"
// 5. Read userId from token payload
// 6. Query DB: prisma.user.findUnique({ where: { user_id: userId } })
//    - If not found → 401 "User not found"
//    - If deleted_at set → 403 "Account has been deleted"
//    - If is_active false → 403 "Account has been suspended"
// 7. Set req.userId = userId, req.userRole = role
// 8. Call next()
```

### How `validate(schema)` works:

```javascript
// 1. Parse req.body with Zod schema
// 2. If valid → req.body is replaced with parsed data (with defaults applied), call next()
// 3. If invalid → return 400 with array of field-level errors:
//    { "message": "Validation failed", "errors": [{ "field": "email", "message": "Invalid email format" }] }
```

---

## 11. Database Schema Summary

### Core Tables:

| Table | Purpose | Key Fields |
|---|---|---|
| `users` | All users (user, tech, admin, vendor) | user_id, email, phone_number, password, role, is_active, deleted_at |
| `car_companies` | Car manufacturers | company_id, company_name |
| `car_models` | Car models | model_id, company_id, model_name |
| `car_variants` | Specific variants (year/fuel/trans) | variant_id, model_id, variant_name, year, fuel_type, transmission |
| `car_part_categories` | Part categories | category_id, category_name |
| `car_parts` | Individual parts | part_id, part_name, category_id |
| `part_prices` | Part prices per variant | price_id, part_id, variant_id, price |
| `user_vehicles` | User's registered vehicles | vehicle_id, user_id, variant_id, registration_number, vin_number |

### Service Flow Tables:

| Table | Purpose |
|---|---|
| `service_requests` | Breakdown reports from users |
| `service_request_parts` | Parts linked to a request |
| `service_request_media` | Photos/videos of breakdown |
| `technician_profiles` | Extended technician info |
| `technician_car_supports` | Car makes/models tech supports |
| `technician_part_skills` | Parts tech can work with |
| `technician_certifications` | Professional certifications |
| `technician_resources` | Tools/equipment |
| `technician_offers` | Offers from techs on requests |
| `jobs` | Accepted offers → active work |
| `invoices` | Bills for completed jobs |
| `invoice_items` | Line items in invoices |
| `reviews` | User reviews of technicians |
| `platform_messages` | In-app messaging |
| `audit_logs` | Admin action history |

### Vendor/Warehouse Tables:

| Table | Purpose |
|---|---|
| `warehouses` | Physical locations managed by vendors |
| `inventories` | Stock of parts in warehouses |
| `inventory_reservations` | Temporary holds on stock |
| `orders` | Purchase orders for parts |
| `order_items` | Items within orders |
| `fulfillments` | Shipment tracking |

### Status Workflows:

**Service Request:** `created` → `pending_offers` → `offer_accepted` → `in_progress` → `completed` (or `cancelled`)

**Offer:** `pending` → `accepted` / `rejected` / `expired`

**Job:** `assigned` → `in_progress` → `completed` → `verified`

**Invoice Payment:** `pending` → `completed` / `failed` / `refunded`

**Order:** `pending` → `confirmed` → `processing` → `shipped` → `delivered` (or `cancelled` / `returned`)

**Fulfillment:** `pending` → `processing` → `shipped` → `in_transit` → `delivered` (or `failed`)

**Reservation:** `active` → `expired` / `converted` / `cancelled`

---

## 12. Troubleshooting

### Common Issues:

| Error | Cause | Fix |
|---|---|---|
| `"Authentication token missing"` | No token in cookies or header | Add `Authorization: Bearer <token>` header |
| `"Access token expired"` | Token older than 15 min | Call `/auth/refresh` or sign in again |
| `"Insufficient permissions"` | Wrong role for this route | Use the correct account type (user/tech/admin/vendor) |
| `"Validation failed"` | Request body doesn't match schema | Check the error details for which field failed |
| `"Invalid UUID format for parameter"` | URL param is not a valid UUID | Use the correct UUID from previous API responses |
| `"Too many attempts"` | Rate limiter triggered on auth routes | Wait 15 minutes or restart server |
| `"Car variant not found"` | `variant_id` doesn't exist | Seed `car_companies` → `car_models` → `car_variants` first |
| `"Car part not found"` | `part_id` doesn't exist | Seed `car_part_categories` → `car_parts` first |
| `"Warehouse not found or inactive"` | Invalid warehouse_id or deactivated | Check `warehouses` table |
| `"Your profile must be verified"` | Tech not verified by admin | Admin must `PATCH /admin/technicians/:techId/verify` |
| `"You must be online"` | Tech is offline | `PATCH /tech/availability` with `{"is_online": true}` |
| CORS errors in browser | Frontend origin doesn't match | Set `CORS_ORIGIN` in `.env` |
| Connection refused | Server not running | Run `npm run dev` in backend directory |
| Prisma error | Database connection issue | Check `DATABASE_URL` in `.env` matches Neon connection string |

### Useful SQL Queries for Debugging:

```sql
-- Check all tables have data
SELECT 'users' as t, count(*) FROM users
UNION ALL SELECT 'vehicles', count(*) FROM user_vehicles
UNION ALL SELECT 'requests', count(*) FROM service_requests
UNION ALL SELECT 'offers', count(*) FROM technician_offers
UNION ALL SELECT 'jobs', count(*) FROM jobs
UNION ALL SELECT 'invoices', count(*) FROM invoices
UNION ALL SELECT 'orders', count(*) FROM orders
UNION ALL SELECT 'warehouses', count(*) FROM warehouses
UNION ALL SELECT 'inventories', count(*) FROM inventories;

-- Check a specific user's full journey
SELECT sr.request_id, sr.status as req_status, 
       o.offer_id, o.status as offer_status,
       j.job_id, j.status as job_status,
       i.invoice_id, i.payment_status
FROM service_requests sr
LEFT JOIN technician_offers o ON sr.request_id = o.request_id
LEFT JOIN jobs j ON sr.request_id = j.request_id
LEFT JOIN invoices i ON j.job_id = i.job_id
WHERE sr.user_id = '<user_uuid>';
```

---

**Happy Testing! 🚀** Follow the end-to-end flow in Section 9 to test every feature systematically.
