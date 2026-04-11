# Frontend Comprehensive Audit Report

**Project:** Quick Auto Assist — Vehicle Roadside Assistance Platform  
**Date:** 2025  
**Scope:** All 5 micro-frontend apps (Landing Page, User Dashboard, Technician Dashboard, Vendor Dashboard, Admin Dashboard)

---

## Executive Summary

The platform has a functional foundation with consistent UI design (Tailwind + dark mode), proper route guarding, and basic CRUD operations across all dashboards. However, it is **far from production-ready**. Critical gaps include:

| Category | Status |
|---|---|
| Maps / Geolocation | **MISSING everywhere** — all location inputs are plain text lat/lng fields |
| Real-time Messaging | **HTTP polling only** (8–10s intervals) — no WebSocket/SSE |
| File/Image Uploads | **MISSING everywhere** — no photos, avatars, documents |
| Charts/Graphs | **MISSING everywhere** — all analytics are plain number cards/tables |
| Payment Integration | **MISSING** — manual transaction ID text entry only |
| OTP / Email Verification | **MISSING** on all auth pages |
| Social Login | **MISSING** on all auth pages |
| Forgot Password | **MISSING** on all auth pages |
| PDF Generation | **MISSING** — no invoice/report downloads |
| Push Notifications | **MISSING** — no real-time alerts of any kind |
| Accessibility (a11y) | **MINIMAL** — no ARIA roles, skip-nav, focus management |

---

## 1. Landing Page (port 5173)

### Routes
| Route | Component | Status |
|---|---|---|
| `/` | LandingPage | ✅ |
| `/auth/role` | RoleSelectionPage | ✅ |
| `*` | Redirect to `/` | ✅ |

### What Works
- Hero section with "Get Help Now" CTA
- How It Works 4-step flow
- Service option cards (Roadside, Towing, Repair, Emergency)
- About section (anchor `#about`), Contact section (anchor `#contact`)
- Role selection page with 4 role cards (Customer, Technician, Vendor, Admin)
- Dark mode toggle with localStorage persistence
- Cross-app navigation via environment variables (VITE_USER_APP_URL, etc.)

### MISSING / Gaps

| Item | Severity | Details |
|---|---|---|
| Emergency Request not wired | **CRITICAL** | Modal form exists but explicitly says "Next step: wire this form to emergency backend endpoint" — form submission does nothing |
| No FAQ section | Medium | Not present on landing page |
| No testimonials/social proof | Medium | No customer reviews or trust signals |
| No pricing/service rates | Low | No cost transparency before signup |
| No separate About/Contact pages | Low | Only anchor sections within the single page |
| Contact form not functional | **HIGH** | Contact section is display-only — no form submission |
| No SEO meta tags | Medium | No `<title>`, `<meta description>`, OG tags management |
| No loading states for cross-app navigation | Low | Plain `<a href>` tags to external apps |
| Admin card shows register link suppressed | ✅ Correct | Admin has login-only (no public registration) |

---

## 2. User Dashboard (port 5174)

### Routes (14 pages)
| Route | Component | Status |
|---|---|---|
| `/auth/user/signin` | UserSignInPage | ✅ |
| `/auth/user/signup` | UserSignUpPage | ✅ |
| `/dashboard` | UserDashboardPage | ✅ |
| `/requests` | UserRequestsPage | ✅ |
| `/requests/new` | UserNewRequestPage | ✅ |
| `/requests/:requestId` | UserRequestDetailPage | ✅ |
| `/requests/:requestId/messages` | UserMessagesPage | ✅ |
| `/jobs` | UserJobsPage | ✅ |
| `/jobs/:jobId` | UserJobDetailPage | ✅ |
| `/orders` | UserOrdersPage | ✅ |
| `/orders/:orderId` | UserOrderDetailPage | ✅ |
| `/invoices/:invoiceId` | UserInvoiceDetailPage | ✅ |
| `/reviews` | UserReviewsPage | ✅ |
| `/profile` | UserProfilePage | ✅ |
| `/vehicles` | UserVehiclesPage | ✅ |

### Authentication
| Feature | Status | Details |
|---|---|---|
| Email/Password login | ✅ | Works with httpOnly cookie auth |
| Session persistence | ✅ | Auto-checks session on mount via `getMyProfile()` |
| Auto token refresh | ✅ | API layer auto-calls `POST /auth/refresh` |
| OTP verification | **MISSING** | No OTP at signup or login |
| Email verification | **MISSING** | No email confirmation flow |
| Social login (Google/Facebook) | **MISSING** | Not implemented |
| Forgot password | **MISSING** | No password reset flow |
| Password change (in profile) | **MISSING** | Profile only edits name and phone |
| Password strength indicator | **MISSING** | Only min 8 chars validation |

### Dashboard Page
| Feature | Status | Details |
|---|---|---|
| Welcome message with user name | ✅ | |
| Navigation cards to all sections | ✅ | 7 cards with icons and descriptions |
| Summary stats (active requests, jobs, etc.) | **MISSING** | Dashboard is just nav cards — no stats/counters |
| Notification bell / unread count | **MISSING** | No notification system |

### New Request Page
| Feature | Status | Details |
|---|---|---|
| Vehicle selection dropdown | ✅ | Fetches user's vehicles |
| Issue type selection | ✅ | Dropdown with options |
| Issue description textarea | ✅ | |
| Towing required checkbox | ✅ | |
| Service location type | ✅ | Dropdown |
| **Map for location picking** | **MISSING** | Only raw latitude/longitude NUMBER inputs |
| **"Use my current location" button** | **MISSING** | No Geolocation API usage |
| **Photo/image upload for issue** | **MISSING** | No file upload at all |
| Address autocomplete | **MISSING** | No Google Places or similar |
| Priority/urgency selector | **MISSING** | |

### Request Detail Page
| Feature | Status | Details |
|---|---|---|
| Request info display | ✅ | Status badge, issue type, description |
| Offers list with accept/reject | ✅ | |
| Link to messages | ✅ | |
| **Map showing request location** | **MISSING** | GPS coords shown as plain text only |
| **Map showing technician locations on offers** | **MISSING** | |
| Cancel request button | **MISSING** | No user-initiated cancellation |
| ETA display | **MISSING** | |

### Messages Page
| Feature | Status | Details |
|---|---|---|
| Message list display | ✅ | Sender name, text, timestamp |
| Send message form | ✅ | |
| Auto-scroll to latest | ✅ | `scrollIntoView` on new messages |
| **Real-time delivery** | **MISSING** | HTTP polling at 10-second intervals, not WebSocket |
| Read receipts | Partial | Basic `✓` for `is_read && isMine` — no double-check/blue-tick |
| Typing indicators | **MISSING** | |
| File/image sharing | **MISSING** | |
| Emoji picker | **MISSING** | |
| Message search | **MISSING** | |
| Unread count badge | **MISSING** | |
| Message deletion | **MISSING** | |

### Job Detail Page
| Feature | Status | Details |
|---|---|---|
| Job info, request info, technician info | ✅ | |
| Offer details display | ✅ | |
| Invoice table | ✅ | |
| Parts list | ✅ | |
| Star rating review (1-5 + comment) | ✅ | |
| Link to messages and invoice | ✅ | |
| **Live map tracking technician** | **MISSING** | |
| **ETA display** | **MISSING** | |
| **Step-by-step progress tracker** | **MISSING** | No visual stepper/timeline |

### Invoice Detail Page
| Feature | Status | Details |
|---|---|---|
| Invoice details display | ✅ | |
| Items table | ✅ | |
| Payment form (method + transaction ID) | ✅ | Manual entry |
| Manual invoice ID lookup | ✅ | |
| **PDF download** | **MISSING** | |
| **Print functionality** | **MISSING** | |
| **Payment gateway integration** | **MISSING** | Only manual transaction ID input |

### Profile Page
| Feature | Status | Details |
|---|---|---|
| Display user info | ✅ | user_id, email, role, is_active, created_at |
| Edit full_name | ✅ | |
| Edit phone_number | ✅ | |
| **Avatar/photo upload** | **MISSING** | |
| **Password change** | **MISSING** | |
| **Document upload** | **MISSING** | |
| **Address management** | **MISSING** | |
| **Delete account** | **MISSING** | |

### Vehicles Page
| Feature | Status | Details |
|---|---|---|
| Add/Edit/Delete vehicles | ✅ | Full CRUD |
| Variant searchable dropdown | ✅ | |
| Registration number field | ✅ | |
| VIN number field | ✅ | |
| **Vehicle image upload** | **MISSING** | |
| Vehicle color/year/mileage fields | **MISSING** | |

### Orders & Reviews Pages
| Feature | Status | Details |
|---|---|---|
| Orders list with status filter + pagination | ✅ | |
| Order detail with items and fulfillment | ✅ | |
| Reviews list with star display + pagination | ✅ | |
| Reviews link back to job | ✅ | |
| Edit/delete review | **MISSING** | Reviews are read-only once submitted |

---

## 3. Technician Dashboard (port 5175)

### Routes (10 pages)
| Route | Component | Status |
|---|---|---|
| `/auth/technician/signin` | TechnicianSignInPage | ✅ |
| `/auth/technician/signup` | TechnicianSignUpPage | ✅ |
| `/dashboard` | TechnicianDashboardPage | ✅ |
| `/profile` | TechnicianProfilePage | ✅ |
| `/offers` | TechnicianOffersPage | ✅ |
| `/assignments` | TechnicianAssignmentsPage | ✅ |
| `/jobs` | TechnicianJobsPage | ✅ |
| `/jobs/:jobId` | TechnicianJobDetailPage | ✅ |
| `/earnings` | TechnicianEarningsPage | ✅ |
| `/messages/:requestId` | TechnicianMessagesPage | ✅ |

### Authentication
| Feature | Status | Details |
|---|---|---|
| Email/Password login | ✅ | Token-based (accessToken/refreshToken in Redux) |
| Token storage | ⚠️ | Stored in Redux — **lost on page refresh** unless persisted |
| OTP verification | **MISSING** | |
| Email verification | **MISSING** | |
| Social login | **MISSING** | |
| Forgot password | **MISSING** | |
| ID/license document upload at signup | **MISSING** | |

### Dashboard Page
| Feature | Status | Details |
|---|---|---|
| Stats cards (pending, active, earned, completed) | ✅ | Plain numbers |
| Online/Offline toggle | ✅ | |
| Verification status badge | ✅ | |
| Quick action links | ✅ | |
| **Charts/graphs** | **MISSING** | All stats are plain number cards |
| **Map view of nearby requests** | **MISSING** | |
| **Real-time notifications** | **MISSING** | No WebSocket, no push, no bell icon |
| **Earnings trend graph** | **MISSING** | |

### Offers Page
| Feature | Status | Details |
|---|---|---|
| List all submitted offers | ✅ | With status badges |
| New offer form | ✅ | repair_mode, estimated_cost, estimated_time, message |
| **Request discovery** | **MISSING** | Must manually enter request UUID — no browse/discover nearby requests |
| **Map showing available requests** | **MISSING** | |
| Offer edit/withdraw | **MISSING** | |

### Assignments Page
| Feature | Status | Details |
|---|---|---|
| List pending assignments | ✅ | |
| Accept/Reject buttons | ✅ | |
| Assignment details (issue, location, cost, time) | ✅ | |
| **Map view** | **MISSING** | GPS coords shown as text only |
| **Push notification on new assignment** | **MISSING** | |
| **Navigate/directions button** | **MISSING** | |

### Job Detail Page
| Feature | Status | Details |
|---|---|---|
| Full workflow: Assigned → In Progress → Completed | ✅ | Conditional buttons |
| Invoice creation with line items | ✅ | Type, description, qty, price, tax rate, live preview |
| Parts suggestion form | ✅ | Part ID + quantity |
| Chat link | ✅ | |
| **Photo upload for work done** | **MISSING** | |
| **Visual step-by-step workflow UI** | **MISSING** | Just conditional buttons, no stepper |
| **Live location sharing** | **MISSING** | |
| **Timer/duration tracking** | **MISSING** | |

### Jobs Page
| Feature | Status | Details |
|---|---|---|
| Paginated job list | ✅ | |
| Status filter (All/Assigned/In Progress/Completed) | ✅ | |
| **Map view of jobs** | **MISSING** | |
| **Search by customer/description** | **MISSING** | |

### Earnings Page
| Feature | Status | Details |
|---|---|---|
| Summary cards (Total Earned, Pending, Paid, Jobs) | ✅ | Plain numbers |
| Job earnings breakdown list | ✅ | |
| **Charts/graphs (bar, line, pie)** | **MISSING** | |
| **Date range filtering** | **MISSING** | |
| **Export/download earnings report** | **MISSING** | |
| **Payout/withdrawal request** | **MISSING** | |

### Messages Page
| Feature | Status | Details |
|---|---|---|
| Chat display | ✅ | |
| Auto-detect receiver from history | ✅ | |
| **HTTP polling at 8s** | ⚠️ | Not WebSocket |
| Typing indicators | **MISSING** | |
| File sharing | **MISSING** | |
| Read receipts | **MISSING** | |

### Profile Page
| Feature | Status | Details |
|---|---|---|
| Account info display | ✅ | Name, email, phone, verified, rating |
| Edit business_name, type, location, radius | ✅ | |
| Certifications CRUD | ✅ | Add/delete with name, issuer, dates |
| **Map for setting location** | **MISSING** | Plain text lat/lng inputs |
| **Avatar/photo upload** | **MISSING** | |
| **Document upload (ID, license)** | **MISSING** | |
| **Password change** | **MISSING** | |

### Signup Page
| Feature | Status | Details |
|---|---|---|
| Full form fields | ✅ | name, email, phone, password, type, business, location, radius |
| Validation | ✅ | Email, phone (10 digits), password (8 chars) |
| **Map for location** | **MISSING** | Plain text lat/lng |
| **Document upload for verification** | **MISSING** | |
| **OTP/email verification** | **MISSING** | |

---

## 4. Vendor Dashboard (port 5176)

### Routes (8 pages)
| Route | Component | Status |
|---|---|---|
| `/auth/vendor/signin` | VendorSignInPage | ✅ |
| `/auth/vendor/signup` | VendorSignUpPage | ✅ |
| `/dashboard` | VendorDashboardPage | ✅ |
| `/warehouses` | VendorWarehousesPage | ✅ |
| `/warehouses/:warehouseId/inventory` | VendorInventoryPage | ✅ |
| `/orders` | VendorOrdersPage | ✅ |
| `/orders/:orderId` | VendorOrderDetailPage | ✅ |
| `/analytics` | VendorAnalyticsPage | ✅ |

### Authentication
| Feature | Status | Details |
|---|---|---|
| Email/Password login | ✅ | Token-based |
| Session verification via warehouse fetch | ✅ | Calls `getWarehouses(1,5)` after login |
| OTP verification | **MISSING** | |
| Social login | **MISSING** | |
| Forgot password | **MISSING** | |

### Dashboard Page
| Feature | Status | Details |
|---|---|---|
| Revenue, orders, avg order value stats | ✅ | From API analytics |
| Warehouse count | ✅ | |
| Inventory items + low stock alerts | ✅ | With amber highlight |
| Orders by status breakdown | ✅ | Badge-style chips |
| Quick links to warehouses, orders, analytics | ✅ | |
| **Charts/graphs** | **MISSING** | All plain numbers |
| **Revenue trend over time** | **MISSING** | |
| **Notifications** | **MISSING** | |

### Warehouses Page
| Feature | Status | Details |
|---|---|---|
| CRUD: Create, Read, Update, Deactivate | ✅ | Full implementation |
| Fields: name, address, city, state, postal, phone, lat/lng | ✅ | |
| Active/Inactive status badge | ✅ | |
| Item/Order count per warehouse | ✅ | |
| Link to inventory per warehouse | ✅ | |
| Pagination | ✅ | |
| **Map for warehouse location** | **MISSING** | Plain lat/lng number inputs |
| **Bulk operations** | **MISSING** | |
| **Search/filter warehouses** | **MISSING** | |

### Inventory Page
| Feature | Status | Details |
|---|---|---|
| CRUD: Add, Edit, Delete items | ✅ | |
| Fields: part_id, quantity, unit_cost, reorder_level | ✅ | |
| Low stock filter toggle | ✅ | With amber highlight |
| Low stock visual indicator per row | ✅ | |
| Reserved quantity display | ✅ | |
| Pagination (20 per page) | ✅ | |
| **Part name search** | **MISSING** | Must enter part_id number manually |
| **Bulk import (CSV/Excel)** | **MISSING** | |
| **Stock history/audit trail** | **MISSING** | |
| **Image per part** | **MISSING** | |

### Orders Page
| Feature | Status | Details |
|---|---|---|
| Full order list with status colors | ✅ | 7 status states with distinct colors |
| Status filter (8 options) | ✅ | All/pending/confirmed/processing/shipped/delivered/cancelled/returned |
| Customer name, warehouse, date, total | ✅ | |
| Payment status display | ✅ | |
| Item and fulfillment counts | ✅ | |
| Pagination | ✅ | |
| **Date range filter** | **MISSING** | |
| **Search by order number/customer** | **MISSING** | |
| **Bulk status update** | **MISSING** | |
| **Export orders** | **MISSING** | |

### Order Detail Page
| Feature | Status | Details |
|---|---|---|
| Order info (number, status, customer, warehouse, amounts) | ✅ | |
| Confirm/Cancel/Return actions | ✅ | Context-aware buttons |
| Return reason form | ✅ | |
| Items table (part, qty, price, total) | ✅ | |
| Fulfillments list with status management | ✅ | Full transition workflow |
| Fulfillment update form (status, tracking, carrier, ETA, notes) | ✅ | |
| Fulfillment state machine (pending→processing→shipped→in_transit→delivered) | ✅ | |
| Reservations display | ✅ | |
| **Shipping label generation** | **MISSING** | |
| **Print packing slip** | **MISSING** | |
| **Email customer notifications** | **MISSING** | |

### Analytics Page
| Feature | Status | Details |
|---|---|---|
| Revenue stats (total, orders, avg value) | ✅ | |
| Orders by status breakdown | ✅ | |
| Orders by payment breakdown | ✅ | |
| Inventory overview (items, available, reserved, value, low stock) | ✅ | |
| **Date range filtering** | ✅ | From/To date inputs |
| **Charts/graphs** | **MISSING** | All data is plain number cards and text lists |
| **Revenue trend line chart** | **MISSING** | |
| **Order volume bar chart** | **MISSING** | |
| **Export analytics report** | **MISSING** | |

### Signup Page
| Feature | Status | Details |
|---|---|---|
| Fields: name, email, phone, password, confirm | ✅ | |
| Validation (email, phone 10 digits, password 8 chars) | ✅ | |
| **Business name / company details** | **MISSING** | Only personal info |
| **GST/Tax ID field** | **MISSING** | |
| **Business document upload** | **MISSING** | |

---

## 5. Admin Dashboard (port 5177)

### Routes (20 pages)
| Route | Component | Status |
|---|---|---|
| `/admin/login` | AdminLoginPage | ✅ |
| `/admin/dashboard` | AdminDashboardPage | ✅ |
| `/admin/users` | AdminUsersPage | ✅ |
| `/admin/users/:userId` | AdminUserDetailPage | ✅ |
| `/admin/technicians` | AdminTechniciansPage | ✅ |
| `/admin/technicians/:techId` | AdminTechnicianDetailPage | ✅ |
| `/admin/vendors` | AdminVendorsPage | ✅ |
| `/admin/vendors/:vendorId` | AdminVendorDetailPage | ✅ |
| `/admin/warehouses` | AdminWarehousesPage | ✅ |
| `/admin/warehouses/:warehouseId` | AdminWarehouseDetailPage | ✅ |
| `/admin/requests` | AdminRequestsPage | ✅ |
| `/admin/requests/:requestId` | AdminRequestDetailPage | ✅ |
| `/admin/jobs` | AdminJobsPage | ✅ |
| `/admin/jobs/:jobId` | AdminJobDetailPage | ✅ |
| `/admin/orders` | AdminOrdersPage | ✅ |
| `/admin/orders/:orderId` | AdminOrderDetailPage | ✅ |
| `/admin/invoices` | AdminInvoicesPage | ✅ |
| `/admin/invoices/:invoiceId` | AdminInvoiceDetailPage | ✅ |
| `/admin/analytics` | AdminAnalyticsPage | ✅ |
| `/admin/audit-logs` | AdminAuditLogsPage | ✅ |

### Dashboard Page
| Feature | Status | Details |
|---|---|---|
| Top stats: Users, Technicians, Vendors, Warehouses | ✅ | With sub-badges (active, verified, online) |
| Service requests breakdown by status | ✅ | |
| Jobs/Orders/Invoices summary cards | ✅ | |
| Recent requests table | ✅ | |
| Quick links to all 10 admin sections | ✅ | |
| **Charts/graphs** | **MISSING** | All plain numbers/badges |
| **Real-time activity feed** | **MISSING** | |
| **System health/alerts** | **MISSING** | |

### Analytics Page
| Feature | Status | Details |
|---|---|---|
| Revenue analytics (service, order, total, count) | ✅ | |
| Revenue breakdown table by period | ✅ | |
| Request matching stats (total, completion rate, cancellation rate, avg offers) | ✅ | |
| By issue type breakdown table | ✅ | |
| Technician performance (jobs, completion rate, avg duration, avg rating) | ✅ | |
| Top 10 technicians leaderboard | ✅ | |
| Date range filter (from/to) | ✅ | |
| Granularity selector (day/week/month) | ✅ | |
| **Charts/graphs** | **MISSING** | All data rendered as plain tables and numbers |
| **Map visualization** | **MISSING** | No geographic heatmaps or request distribution |
| **Export to CSV/PDF** | **MISSING** | |
| **Comparison periods** | **MISSING** | |

### Request Detail Page
| Feature | Status | Details |
|---|---|---|
| Full request info (type, status, description, towing) | ✅ | |
| User and vehicle info | ✅ | |
| Requested parts list | ✅ | |
| Media links (if any) | ✅ | Links to media URLs |
| Offers table with technician links | ✅ | |
| Job info with link to detail | ✅ | |
| Recent messages (last 10, scrollable) | ✅ | |
| **Force cancel request** | ✅ | With confirmation |
| **Force assign technician** | ✅ | Form with tech ID, repair mode, cost, time |
| **Map showing request location** | **MISSING** | |
| **Technician search for force-assign** | **MISSING** | Must enter UUID manually |

---

## 6. Cross-Cutting Concerns

### Architecture
| Item | Status | Details |
|---|---|---|
| Separate Vite apps per role | ✅ | Good separation of concerns |
| Shared design system | Partial | Similar Tailwind classes but no shared component library |
| Environment-based cross-app routing | ✅ | Via VITE_*_APP_URL env vars |
| Route guards (RequireAuth) | ✅ | All dashboards protected |
| Dark mode | ✅ | Class-based toggle with localStorage per app |

### Auth Inconsistency
| App | Auth Method | Token Persistence |
|---|---|---|
| User Dashboard | httpOnly cookies | ✅ Survives refresh (cookies auto-sent) |
| Technician Dashboard | Redux state (accessToken/refreshToken) | ❌ Lost on refresh |
| Vendor Dashboard | Redux state (accessToken/refreshToken) | ❌ Lost on refresh |
| Admin Dashboard | Redux state (accessToken/refreshToken) | ❌ Lost on refresh |

> **CRITICAL**: Technician, Vendor, and Admin dashboards will log users out on every page refresh because tokens are only stored in Redux memory. Need localStorage/sessionStorage persistence or switch to httpOnly cookies.

### State Management
| Item | Status | Details |
|---|---|---|
| Redux for auth state | ✅ | All apps use `authSlice` |
| No Redux for domain data | ⚠️ | All data fetched via `useState` + `useEffect` — no caching |
| No React Query / SWR | ⚠️ | Every page re-fetches from scratch, no stale-while-revalidate |
| No optimistic updates | ⚠️ | All mutations wait for server response |

### Error Handling
| Item | Status | Details |
|---|---|---|
| API error display | ✅ | Custom `ApiError` class with message extraction |
| Global error boundary | **MISSING** | No `ErrorBoundary` component in any app |
| 401 handling / auto-redirect | Partial | User app has auto-refresh; others unclear |
| Network offline handling | **MISSING** | No offline detection or retry logic |

### Performance
| Item | Status | Details |
|---|---|---|
| Code splitting / lazy loading | **MISSING** | All pages imported eagerly at App.jsx |
| Image optimization | N/A | No images in the apps |
| Bundle analysis | **MISSING** | No bundle size optimization |
| Memoization | Minimal | Some `useCallback`, but no `React.memo` on components |

### Accessibility
| Item | Status | Details |
|---|---|---|
| Form labels | Partial | Most inputs have `<label>` with `htmlFor` |
| ARIA attributes | **MISSING** | No `role`, `aria-label`, `aria-live` |
| Keyboard navigation | **MISSING** | No focus management, no skip-nav links |
| Screen reader support | **MISSING** | No `sr-only` text, no announcements |
| Color contrast | Partial | Tailwind defaults are generally OK but not audited |
| Focus indicators | **MISSING** | Most inputs use `outline-none` which removes focus rings |

### Testing
| Item | Status | Details |
|---|---|---|
| Unit tests | **MISSING** | No test files in any frontend app |
| Integration tests | **MISSING** | |
| E2E tests | **MISSING** | Tests directory exists but appears empty |
| Component tests | **MISSING** | |

---

## 7. Priority Recommendations

### P0 — Must Fix Before Any Demo/Launch

1. **Token persistence for Technician/Vendor/Admin dashboards** — Tokens lost on refresh logs everyone out
2. **Wire the emergency request form** on landing page — Currently does nothing
3. **Add a map component** (Leaflet or Google Maps) for location picking in:
   - UserNewRequestPage (location selection)
   - TechnicianSignUpPage / ProfilePage (service area)
   - VendorWarehousesPage (warehouse location)
4. **Add "Use my current location"** button using the Geolocation API
5. **Add Global Error Boundary** to all 5 apps

### P1 — Required for Production

6. **Implement WebSocket or SSE** for messaging (replace HTTP polling)
7. **Add OTP/email verification** for signup flows
8. **Add forgot password** flow for all roles
9. **Integrate payment gateway** (Razorpay/Stripe) instead of manual transaction ID
10. **Add PDF invoice generation** and download
11. **Add file/image upload** capability (at minimum for issue photos, work-done photos, profile avatars)
12. **Add charts/graphs** using Chart.js or Recharts for all analytics pages
13. **Add lazy loading** with `React.lazy()` + `Suspense` for route-level code splitting
14. **Request discovery for technicians** — Technicians shouldn't need to manually enter request UUIDs

### P2 — Important for UX

15. **Add a proper request tracking stepper** (visual timeline) for request → offer → job → invoice flow
16. **Add real-time notifications** (new offers, assignment alerts, job status changes)
17. **Add technician live location** sharing/tracking for active jobs
18. **Add ETA display** for customer view during active jobs
19. **Add data caching** with React Query or SWR to avoid re-fetching on every navigation
20. **Add loading skeletons** instead of plain "Loading..." text
21. **Add confirmation dialogs** for destructive actions (currently only admin force-cancel has one)
22. **Add breadcrumb navigation** for deep pages
23. **Add search functionality** across orders, requests, jobs, and inventory

### P3 — Nice to Have

24. Social login (Google OAuth)
25. Testimonials and social proof on landing page
26. Bulk inventory import (CSV)
27. Export capabilities for all data tables
28. Dark mode toggle should be in a settings page, not on every page header
29. Shared component library across all 5 apps
30. PWA support with service worker for offline capability

---

## 8. Page Count Summary

| App | Pages | Auth Protected |
|---|---|---|
| Landing Page | 2 | 0 |
| User Dashboard | 15 (incl. signin/signup) | 13 |
| Technician Dashboard | 10 (incl. signin/signup) | 8 |
| Vendor Dashboard | 8 (incl. signin/signup) | 6 |
| Admin Dashboard | 20 (incl. login) | 19 |
| **Total** | **55** | **46** |

---

*End of Audit Report*
