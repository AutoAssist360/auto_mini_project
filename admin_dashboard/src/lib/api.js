/* ------------------------------------------------------------------ */
/*  Admin Dashboard — API layer (cookie-only auth)                    */
/* ------------------------------------------------------------------ */

const RAW_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

function normalizeBaseUrl(url) {
  return (url || 'http://localhost:3000').replace(/\/+$/, '')
}
function getBaseCandidates() {
  const n = normalizeBaseUrl(RAW_API_BASE_URL)
  const c = [n]
  if (n.endsWith('/api')) c.push(n.slice(0, -4))
  else c.push(`${n}/api`)
  return [...new Set(c)]
}
const API_BASE_CANDIDATES = getBaseCandidates()
const ADMIN_SOCKET_TOKEN_KEY = 'qa-admin-socket-token'

function getValidationDetails(data) {
  return Array.isArray(data?.errors)
    ? data.errors
      .map((issue) => issue?.message)
      .filter(Boolean)
    : []
}

function formatApiErrorMessage(message, data, fallback = 'Request failed') {
  const validationDetails = [...new Set(getValidationDetails(data))]
  if (validationDetails.length > 0) {
    return validationDetails.join(' ')
  }

  return message || fallback
}

/* ---------- error class ---------- */
export class ApiError extends Error {
  constructor(message, status, data) {
    super(formatApiErrorMessage(message, data))
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

export function getApiErrorMessage(error, fallback = 'Request failed') {
  if (!(error instanceof ApiError)) return fallback

  return error.message || fallback
}

function persistAdminSocketToken(token) {
  if (typeof window === 'undefined') return
  if (token) localStorage.setItem(ADMIN_SOCKET_TOKEN_KEY, token)
  else localStorage.removeItem(ADMIN_SOCKET_TOKEN_KEY)
}

export function getAdminSocketToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ADMIN_SOCKET_TOKEN_KEY)
}

/* ---------- core request — cookie-only (no Bearer headers) ---------- */
async function apiRequest(path, options = {}) {
  let lastError
  const _retried = options._retried || false
  const { _retried: _, ...fetchOptions } = options

  for (let i = 0; i < API_BASE_CANDIDATES.length; i++) {
    const base = API_BASE_CANDIDATES[i]

    const res = await fetch(`${base}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(fetchOptions.headers || {}),
      },
      ...fetchOptions,
    })

    const json = (res.headers.get('content-type') || '').includes('application/json')
    const data = json ? await res.json() : null

    if (res.ok) return data

    const msg = data?.message || 'Request failed'
    const wrongBase =
      res.status === 404 && /route not found/i.test(msg)

    if (wrongBase) {
      lastError = new ApiError(msg, res.status, data)
      continue
    }

    // Auto-refresh on expired access token (retry once)
    if (res.status === 401 && !_retried) {
      try {
        await refreshSession()
        return apiRequest(path, { ...fetchOptions, _retried: true })
      } catch {
        // refresh failed — fall through to throw original error
      }
    }

    throw new ApiError(msg, res.status, data)
  }
  throw lastError || new ApiError('Request failed', 500, null)
}

/* ---------- Token refresh (shared promise) ---------- */
let refreshPromise = null

export async function refreshSession() {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    for (const base of API_BASE_CANDIDATES) {
      try {
        const res = await fetch(`${base}/admin/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
        if (res.ok) {
          const isJson = (res.headers.get('content-type') || '').includes('application/json')
          const data = isJson ? await res.json() : null
          persistAdminSocketToken(data?.accessToken || null)
          return true
        }
      } catch {
        // try next base URL candidate
      }
    }
    persistAdminSocketToken(null)
    throw new Error('Session expired')
  })().finally(() => { refreshPromise = null })

  return refreshPromise
}

/* ================================================================== */
/*  helper: build query string                                        */
/* ================================================================== */
function qs(params = {}) {
  const s = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') s.append(k, v)
  })
  const str = s.toString()
  return str ? `?${str}` : ''
}

/* ================================================================== */
/*  1. AUTH                                                           */
/* ================================================================== */
export function adminSignIn(payload) {
  return apiRequest('/admin/auth/signin', {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then((data) => {
    persistAdminSocketToken(data?.accessToken || null)
    return data
  })
}
export function adminLogout() {
  return apiRequest('/admin/auth/logout', { method: 'POST' }).finally(() => {
    persistAdminSocketToken(null)
  })
}
export function adminForgotPassword(email) {
  return apiRequest('/admin/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}
export function adminResetPassword(token, new_password) {
  return apiRequest('/admin/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, new_password }),
  })
}
export function adminChangePassword(current_password, new_password) {
  return apiRequest('/admin/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password, new_password }),
  })
}
export function getProfile() {
  return apiRequest('/profile')
}
export function updateProfile(payload) {
  return apiRequest('/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

/* ================================================================== */
/*  2. DASHBOARD                                                      */
/* ================================================================== */
export function getDashboard() {
  return apiRequest('/admin/dashboard')
}

/* ================================================================== */
/*  3. USERS                                                          */
/* ================================================================== */
export function getUsers(params) {
  return apiRequest(`/admin/users${qs(params)}`)
}
export function getUserById(userId) {
  return apiRequest(`/admin/users/${userId}`)
}
export function blockUser(userId) {
  return apiRequest(`/admin/users/${userId}/block`, { method: 'PATCH' })
}
export function unblockUser(userId) {
  return apiRequest(`/admin/users/${userId}/unblock`, { method: 'PATCH' })
}
export function deleteUser(userId) {
  return apiRequest(`/admin/users/${userId}`, { method: 'DELETE' })
}

/* ================================================================== */
/*  4. TECHNICIANS                                                    */
/* ================================================================== */
export function getTechnicians(params) {
  return apiRequest(`/admin/technicians${qs(params)}`)
}
export function getTechnicianById(techId) {
  return apiRequest(`/admin/technicians/${techId}`)
}
export function verifyTechnician(techId) {
  return apiRequest(`/admin/technicians/${techId}/verify`, { method: 'PATCH' })
}
export function suspendTechnician(techId) {
  return apiRequest(`/admin/technicians/${techId}/suspend`, { method: 'PATCH' })
}
export function unsuspendTechnician(techId) {
  return apiRequest(`/admin/technicians/${techId}/unsuspend`, { method: 'PATCH' })
}
export function getTechnicianJobs(techId, params) {
  return apiRequest(`/admin/technicians/${techId}/jobs${qs(params)}`)
}

/* ================================================================== */
/*  5. VENDORS                                                        */
/* ================================================================== */
export function getVendors(params) {
  return apiRequest(`/admin/vendors${qs(params)}`)
}
export function getVendorById(vendorId) {
  return apiRequest(`/admin/vendors/${vendorId}`)
}
export function verifyVendor(vendorId) {
  return apiRequest(`/admin/vendors/${vendorId}/verify`, { method: 'PATCH' })
}
export function suspendVendor(vendorId) {
  return apiRequest(`/admin/vendors/${vendorId}/suspend`, { method: 'PATCH' })
}
export function unsuspendVendor(vendorId) {
  return apiRequest(`/admin/vendors/${vendorId}/unsuspend`, { method: 'PATCH' })
}
export function getVendorWarehouses(vendorId, params) {
  return apiRequest(`/admin/vendors/${vendorId}/warehouses${qs(params)}`)
}

/* ================================================================== */
/*  6. WAREHOUSES                                                     */
/* ================================================================== */
export function getWarehouses(params) {
  return apiRequest(`/admin/warehouses${qs(params)}`)
}
export function getWarehouseById(warehouseId) {
  return apiRequest(`/admin/warehouses/${warehouseId}`)
}
export function getWarehouseInventory(warehouseId, params) {
  return apiRequest(`/admin/warehouses/${warehouseId}/inventory${qs(params)}`)
}

/* ================================================================== */
/*  7. REQUESTS                                                       */
/* ================================================================== */
export function getRequests(params) {
  return apiRequest(`/admin/requests${qs(params)}`)
}
export function getRequestById(requestId) {
  return apiRequest(`/admin/requests/${requestId}`)
}
export function cancelRequest(requestId) {
  return apiRequest(`/admin/requests/${requestId}/cancel`, { method: 'PATCH' })
}
export function forceAssignTechnician(requestId, payload) {
  return apiRequest(`/admin/requests/${requestId}/force-assign`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/* ================================================================== */
/*  8. JOBS                                                           */
/* ================================================================== */
export function getJobs(params) {
  return apiRequest(`/admin/jobs${qs(params)}`)
}
export function getJobById(jobId) {
  return apiRequest(`/admin/jobs/${jobId}`)
}
export function updateJobStatus(jobId, status, reason) {
  return apiRequest(`/admin/jobs/${jobId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason: reason || undefined }),
  })
}

/* ================================================================== */
/*  9. ORDERS                                                         */
/* ================================================================== */
export function getOrders(params) {
  return apiRequest(`/admin/orders${qs(params)}`)
}
export function getOrderById(orderId) {
  return apiRequest(`/admin/orders/${orderId}`)
}
export function refundOrder(orderId, reason) {
  return apiRequest(`/admin/orders/${orderId}/refund`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

/* ================================================================== */
/*  10. INVOICES                                                      */
/* ================================================================== */
export function getInvoices(params) {
  return apiRequest(`/admin/invoices${qs(params)}`)
}
export function getInvoiceById(invoiceId) {
  return apiRequest(`/admin/invoices/${invoiceId}`)
}
export function markInvoicePaid(invoiceId) {
  return apiRequest(`/admin/invoices/${invoiceId}/mark-paid`, { method: 'PATCH' })
}
export function markOrderPaid(orderId) {
  return apiRequest(`/admin/orders/${orderId}/mark-paid`, { method: 'PATCH' })
}

/* ================================================================== */
/*  10b. PAYOUTS                                                      */
/* ================================================================== */
export function getPayoutSummary(params) {
  return apiRequest(`/admin/payouts/summary${qs(params)}`)
}
export function getPayoutHistory(params) {
  return apiRequest(`/admin/payouts/history${qs(params)}`)
}
export function markPayoutPaid(payoutId, data) {
  return apiRequest(`/admin/payouts/${payoutId}/mark-paid`, { 
     method: 'POST', 
     body: JSON.stringify(data)
  })
}

/* ================================================================== */
/*  11. ANALYTICS                                                     */
/* ================================================================== */
export function getRevenueAnalytics(params) {
  return apiRequest(`/admin/analytics/revenue${qs(params)}`)
}
export function getMatchingAnalytics(params) {
  return apiRequest(`/admin/analytics/matching${qs(params)}`)
}
export function getPerformanceAnalytics(params) {
  return apiRequest(`/admin/analytics/performance${qs(params)}`)
}

/* ================================================================== */
/*  12. AUDIT LOGS                                                    */
/* ================================================================== */
export function getAuditLogs(params) {
  return apiRequest(`/admin/audit-logs${qs(params)}`)
}

/* ================================================================== */
/*  13. CAR CATALOG                                                   */
/* ================================================================== */

// Companies
export function getCompanies(params) { return apiRequest(`/admin/catalog/companies${qs(params)}`) }
export function createCompany(data) { return apiRequest('/admin/catalog/companies', { method: 'POST', body: JSON.stringify(data) }) }
export function updateCompany(id, data) { return apiRequest(`/admin/catalog/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteCompany(id) { return apiRequest(`/admin/catalog/companies/${id}`, { method: 'DELETE' }) }

// Models
export function getModels(params) { return apiRequest(`/admin/catalog/models${qs(params)}`) }
export function createModel(data) { return apiRequest('/admin/catalog/models', { method: 'POST', body: JSON.stringify(data) }) }
export function updateModel(id, data) { return apiRequest(`/admin/catalog/models/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteModel(id) { return apiRequest(`/admin/catalog/models/${id}`, { method: 'DELETE' }) }

// Variants
export function getVariants(params) { return apiRequest(`/admin/catalog/variants${qs(params)}`) }
export function createVariant(data) { return apiRequest('/admin/catalog/variants', { method: 'POST', body: JSON.stringify(data) }) }
export function updateVariant(id, data) { return apiRequest(`/admin/catalog/variants/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteVariant(id) { return apiRequest(`/admin/catalog/variants/${id}`, { method: 'DELETE' }) }

// Part Categories
export function getCategories(params) { return apiRequest(`/admin/catalog/categories${qs(params)}`) }
export function createCategory(data) { return apiRequest('/admin/catalog/categories', { method: 'POST', body: JSON.stringify(data) }) }
export function updateCategory(id, data) { return apiRequest(`/admin/catalog/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteCategory(id) { return apiRequest(`/admin/catalog/categories/${id}`, { method: 'DELETE' }) }

// Parts
export function getParts(params) { return apiRequest(`/admin/catalog/parts${qs(params)}`) }
export function createPart(data) { return apiRequest('/admin/catalog/parts', { method: 'POST', body: JSON.stringify(data) }) }
export function updatePart(id, data) { return apiRequest(`/admin/catalog/parts/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deletePart(id) { return apiRequest(`/admin/catalog/parts/${id}`, { method: 'DELETE' }) }

// Part Prices
export function getPartPrices(params) { return apiRequest(`/admin/catalog/prices${qs(params)}`) }
export function createPartPrice(data) { return apiRequest('/admin/catalog/prices', { method: 'POST', body: JSON.stringify(data) }) }
export function updatePartPrice(id, data) { return apiRequest(`/admin/catalog/prices/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deletePartPrice(id) { return apiRequest(`/admin/catalog/prices/${id}`, { method: 'DELETE' }) }

// ─── Notifications ────────────────────────────────────────────
export async function getNotifications({ page = 1, limit = 20, unread } = {}) {
  let qs = `?page=${page}&limit=${limit}`
  if (unread) qs += '&unread=true'
  return apiRequest(`/notifications${qs}`, { method: 'GET' })
}

export async function getUnreadCount() {
  return apiRequest('/notifications/unread-count', { method: 'GET' })
}

export async function markNotificationRead(notificationId) {
  return apiRequest(`/notifications/${notificationId}/read`, { method: 'PATCH' })
}

export async function markAllNotificationsRead() {
  return apiRequest('/notifications/read-all', { method: 'PATCH' })
}

export async function deleteNotification(notificationId) {
  return apiRequest(`/notifications/${notificationId}`, { method: 'DELETE' })
}

/* ================================================================== */
/*  14. FEEDBACK                                                      */
/* ================================================================== */
export function getAllFeedback(params) {
  return apiRequest(`/admin/feedback${qs(params)}`)
}

export function updateFeedbackStatus(feedbackId, status) {
  return apiRequest(`/admin/feedback/${feedbackId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  })
}

export function replyToFeedback(feedbackId, replyText, status) {
  return apiRequest(`/admin/feedback/${feedbackId}/reply`, {
    method: 'PATCH',
    body: JSON.stringify({ replyText, status })
  })
}

