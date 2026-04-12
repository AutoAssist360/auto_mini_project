const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

function normalizeBaseUrl(url) {
  return (url || 'http://localhost:3000').replace(/\/+$/, '')
}

function getBaseCandidates() {
  const normalized = normalizeBaseUrl(RAW_API_BASE_URL)
  const candidates = [normalized]

  if (normalized.endsWith('/api')) {
    candidates.push(normalized.slice(0, -4))
  } else {
    candidates.push(`${normalized}/api`)
  }

  return [...new Set(candidates)]
}

const API_BASE_CANDIDATES = getBaseCandidates()

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

export class ApiError extends Error {
  constructor(message, status, data) {
    super(formatApiErrorMessage(message, data))
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

/* ------------------------------------------------------------------ */
/*  Core request — cookie-only auth (no Bearer headers)                */
/* ------------------------------------------------------------------ */
export async function apiRequest(path, options = {}) {
  let lastError
  const _retried = options._retried || false
  const { _retried: _, ...fetchOptions } = options

  for (let index = 0; index < API_BASE_CANDIDATES.length; index += 1) {
    const baseUrl = API_BASE_CANDIDATES[index]

    const response = await fetch(`${baseUrl}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(fetchOptions.headers || {}),
      },
      ...fetchOptions,
    })

    const isJson = (response.headers.get('content-type') || '').includes('application/json')
    const data = isJson ? await response.json() : null

    if (response.ok) {
      return data
    }

    const message = data?.message || 'Request failed'
    const isLikelyWrongBase =
      response.status === 404 && /route not found/i.test(message)

    if (isLikelyWrongBase) {
      lastError = new ApiError(message, response.status, {
        ...(data || {}),
        requestUrl: `${baseUrl}${path}`,
      })
      continue
    }

    // Auto-refresh on expired access token (retry once)
    if (response.status === 401 && !_retried) {
      try {
        await refreshSession()
        return apiRequest(path, { ...fetchOptions, _retried: true })
      } catch {
        // refresh failed — fall through to throw original error
      }
    }

    throw new ApiError(message, response.status, data)
  }

  throw lastError || new ApiError('Request failed', 500, null)
}

/* ------------------------------------------------------------------ */
/*  Token refresh (shared promise prevents concurrent refresh calls)   */
/* ------------------------------------------------------------------ */
let refreshPromise = null

export async function refreshSession() {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    for (const baseUrl of API_BASE_CANDIDATES) {
      try {
        const res = await fetch(`${baseUrl}/tech/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
        if (res.ok) return true
      } catch {
        // try next base URL candidate
      }
    }
    throw new Error('Session expired')
  })().finally(() => { refreshPromise = null })

  return refreshPromise
}

/* ================================================================== */
/*  AUTH                                                               */
/* ================================================================== */

export async function technicianSignIn(payload) {
  return apiRequest('/tech/auth/signin', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function technicianSignUp(payload) {
  return apiRequest('/tech/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function technicianSendOtp(email) {
  return apiRequest('/tech/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function technicianLogout() {
  return apiRequest('/tech/auth/logout', {
    method: 'POST',
  })
}

export async function technicianForgotPassword(email) {
  return apiRequest('/tech/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
}

export async function technicianResetPassword(token, new_password) {
  return apiRequest('/tech/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, new_password }) })
}

export async function technicianChangePassword(current_password, new_password) {
  return apiRequest('/tech/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) })
}

/* ================================================================== */
/*  PROFILE                                                            */
/* ================================================================== */

export async function getTechnicianProfile() {
  return apiRequest('/tech/profile', { method: 'GET' })
}

export async function updateTechnicianProfile(payload) {
  return apiRequest('/tech/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function addCertification(payload) {
  return apiRequest('/tech/profile/certifications', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteCertification(certId) {
  return apiRequest(`/tech/profile/certifications/${certId}`, {
    method: 'DELETE',
  })
}

/* ── Car Supports ──────────────────────────────────────────────── */

export async function addCarSupport(payload) {
  return apiRequest('/tech/profile/car-supports', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteCarSupport(supportId) {
  return apiRequest(`/tech/profile/car-supports/${supportId}`, {
    method: 'DELETE',
  })
}

/* ── Part Skills ───────────────────────────────────────────────── */

export async function addPartSkill(payload) {
  return apiRequest('/tech/profile/part-skills', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deletePartSkill(skillId) {
  return apiRequest(`/tech/profile/part-skills/${skillId}`, {
    method: 'DELETE',
  })
}

/* ── Resources ─────────────────────────────────────────────────── */

export async function addResource(payload) {
  return apiRequest('/tech/profile/resources', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteResource(resourceId) {
  return apiRequest(`/tech/profile/resources/${resourceId}`, {
    method: 'DELETE',
  })
}

/* ── Catalog Lookups (for dropdowns) ───────────────────────────── */

export async function getCatalogCompanies() {
  return apiRequest('/tech/profile/catalog/companies')
}

export async function getCatalogVariants(companyId) {
  const q = companyId ? `?company_id=${companyId}` : ''
  return apiRequest(`/tech/profile/catalog/variants${q}`)
}

export async function getCatalogParts() {
  return apiRequest('/tech/profile/catalog/parts')
}

export async function getCatalogPartsWithInventory() {
  return apiRequest('/tech/profile/catalog/parts-with-inventory')
}

/* ================================================================== */
/*  AVAILABILITY                                                       */
/* ================================================================== */

export async function updateAvailability(isOnline) {
  return apiRequest('/tech/availability', {
    method: 'PATCH',
    body: JSON.stringify({ is_online: isOnline }),
  })
}

/* ================================================================== */
/*  OFFERS                                                             */
/* ================================================================== */

export async function getOffers(page = 1, limit = 20) {
  return apiRequest(`/tech/offers?page=${page}&limit=${limit}`, { method: 'GET' })
}

export async function getOfferById(offerId) {
  return apiRequest(`/tech/offers/${offerId}`, { method: 'GET' })
}

export async function createOffer(payload) {
  return apiRequest('/tech/offers', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/* ================================================================== */
/*  PENDING OFFERS (pool for technician to browse)                     */
/* ================================================================== */

export async function getPendingOffers(page = 1, limit = 20) {
  return apiRequest(`/tech/offers/pending?page=${page}&limit=${limit}`, { method: 'GET' })
}

/* ================================================================== */
/*  ASSIGNMENTS                                                        */
/* ================================================================== */

export async function getPendingAssignments() {
  return apiRequest('/tech/assignments/pending', { method: 'GET' })
}

export async function acceptAssignment(jobId) {
  return apiRequest(`/tech/assignments/${jobId}/accept`, { method: 'POST' })
}

export async function rejectAssignment(jobId) {
  return apiRequest(`/tech/assignments/${jobId}/reject`, { method: 'POST' })
}

/* ================================================================== */
/*  JOBS                                                               */
/* ================================================================== */

export async function getJobs(page = 1, limit = 20, status = '') {
  let url = `/tech/jobs?page=${page}&limit=${limit}`
  if (status) url += `&status=${status}`
  return apiRequest(url, { method: 'GET' })
}

export async function getJobById(jobId) {
  return apiRequest(`/tech/jobs/${jobId}`, { method: 'GET' })
}

export async function updateJobStatus(jobId, status) {
  return apiRequest(`/tech/jobs/${jobId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function suggestParts(jobId, parts) {
  return apiRequest(`/tech/jobs/${jobId}/suggest-parts`, {
    method: 'POST',
    body: JSON.stringify({ parts }),
  })
}

export async function completeJob(jobId) {
  return apiRequest(`/tech/jobs/${jobId}/complete`, { method: 'POST' })
}

export async function createInvoice(jobId, payload) {
  return apiRequest(`/tech/jobs/${jobId}/invoice`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function generateInvoiceQr(invoiceId) {
  return apiRequest(`/payments/invoice/${invoiceId}/qr`, {
    method: 'POST',
  })
}

export async function markInvoiceCash(invoiceId) {
  return apiRequest(`/payments/invoice/${invoiceId}/cash`, {
    method: 'POST',
  })
}

/* ================================================================== */
/*  EARNINGS                                                           */
/* ================================================================== */

export async function getEarnings() {
  return apiRequest('/tech/earnings', { method: 'GET' })
}

export async function payDues() {
  return apiRequest('/payments/tech/pay-dues', { method: 'POST' })
}

export async function confirmTechnicianCommissionPayment(payload = {}) {
  return apiRequest('/payments/tech/pay-dues/confirm', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/* ================================================================== */
/*  LOCATION                                                           */
/* ================================================================== */

export async function updateLocation(latitude, longitude) {
  return apiRequest('/tech/location', {
    method: 'POST',
    body: JSON.stringify({ latitude, longitude }),
  })
}

/* ================================================================== */
/*  MESSAGES                                                           */
/* ================================================================== */

export async function getRequestMessages(requestId, page = 1, limit = 50) {
  return apiRequest(`/tech/requests/${requestId}/messages?page=${page}&limit=${limit}`, { method: 'GET' })
}

export async function sendRequestMessage(requestId, receiverId, message) {
  return apiRequest(`/tech/requests/${requestId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ receiver_id: receiverId, message }),
  })
}

/* ================================================================== */
/*  REQUEST DISCOVERY                                                  */
/* ================================================================== */

export async function getOpenRequests(page = 1, limit = 20) {
  return apiRequest(`/tech/discover?page=${page}&limit=${limit}`, { method: 'GET' })
}

export async function getOpenRequestDetail(requestId) {
  return apiRequest(`/tech/discover/${requestId}`, { method: 'GET' })
}

/* ================================================================== */
/*  NOTIFICATIONS                                                      */
/* ================================================================== */

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
/*  FILE UPLOADS                                                       */
/* ================================================================== */

export async function uploadFile(file, entityType, entityId) {
  const formData = new FormData()
  formData.append('file', file)
  if (entityType) formData.append('entity_type', entityType)
  if (entityId) formData.append('entity_id', entityId)

  for (const baseUrl of API_BASE_CANDIDATES) {
    try {
      const res = await fetch(`${baseUrl}/uploads/single`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      if (res.ok) return res.json()
      const data = await res.json().catch(() => null)
      if (res.status === 404 && /route not found/i.test(data?.message)) continue
      throw new ApiError(data?.message || 'Upload failed', res.status, data)
    } catch (e) {
      if (e instanceof ApiError) throw e
    }
  }
  throw new ApiError('Upload failed', 500, null)
}

export async function getMyFiles({ page = 1, limit = 20, entity_type, entity_id } = {}) {
  let qs = `?page=${page}&limit=${limit}`
  if (entity_type) qs += `&entity_type=${entity_type}`
  if (entity_id) qs += `&entity_id=${entity_id}`
  return apiRequest(`/uploads${qs}`, { method: 'GET' })
}

export async function deleteFile(fileId) {
  return apiRequest(`/uploads/${fileId}`, { method: 'DELETE' })
}

// ─── Shared entity files (visible to any authenticated user) ──
export async function getEntityFiles(entityType, entityId, { page = 1, limit = 50 } = {}) {
  const qs = `?page=${page}&limit=${limit}`
  return apiRequest(`/uploads/entity/${entityType}/${entityId}${qs}`, { method: 'GET' })
}

/* ================================================================== */
/*  REVIEWS                                                            */
/* ================================================================== */

export async function getMyReviews(page = 1, limit = 20) {
  return apiRequest(`/tech/reviews?page=${page}&limit=${limit}`, { method: 'GET' })
}

