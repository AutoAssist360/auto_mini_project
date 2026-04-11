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

    // Auto-refresh on any 401 — covers both TOKEN_EXPIRED and missing-cookie cases
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

// ─── Token refresh (shared promise prevents concurrent refresh calls) ──
let refreshPromise = null

export async function refreshSession() {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    for (const baseUrl of API_BASE_CANDIDATES) {
      try {
        const res = await fetch(`${baseUrl}/auth/refresh`, {
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

export async function userSignIn(payload) {
  return apiRequest('/auth/signin', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function userSignUp(payload) {
  return apiRequest('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function sendOtp(email) {
  return apiRequest('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function getMyProfile() {
  return apiRequest('/profile', {
    method: 'GET',
  })
}

export async function userLogout() {
  return apiRequest('/auth/logout', {
    method: 'POST',
  })
}

export async function updateMyProfile(payload) {
  return apiRequest('/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteMyAccount() {
  return apiRequest('/profile', { method: 'DELETE' })
}

export async function getVehicleCompanies({ query = '' } = {}) {
  const params = new URLSearchParams()
  if (query?.trim()) {
    params.set('q', query.trim())
  }
  const qs = params.toString()
  return apiRequest(`/vehicles/companies${qs ? `?${qs}` : ''}`, { method: 'GET' })
}

export async function getModelsByCompany(companyId, { query = '' } = {}) {
  const params = new URLSearchParams()
  if (query?.trim()) {
    params.set('q', query.trim())
  }
  const qs = params.toString()
  return apiRequest(`/vehicles/companies/${companyId}/models${qs ? `?${qs}` : ''}`, { method: 'GET' })
}

export async function getVariantsByModel(modelId) {
  return apiRequest(`/vehicles/models/${modelId}/variants`, { method: 'GET' })
}

export async function getVehicleVariants({ query = '', limit = 50 } = {}) {
  const params = new URLSearchParams({
    limit: String(limit),
  })

  if (query?.trim()) {
    params.set('q', query.trim())
  }

  return apiRequest(`/vehicles/variants?${params.toString()}`, {
    method: 'GET',
  })
}

export async function getMyVehicles() {
  return apiRequest('/vehicles', {
    method: 'GET',
  })
}

export async function addVehicle(payload) {
  return apiRequest('/vehicles', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateVehicle(vehicleId, payload) {
  return apiRequest(`/vehicles/${vehicleId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteVehicle(vehicleId) {
  return apiRequest(`/vehicles/${vehicleId}`, {
    method: 'DELETE',
  })
}

export async function createServiceRequest(payload) {
  return apiRequest('/requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getServiceRequests({ page = 1, limit = 10, status } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })

  if (status) {
    params.set('status', status)
  }

  return apiRequest(`/requests?${params.toString()}`, {
    method: 'GET',
  })
}

export async function getServiceRequestById(requestId) {
  return apiRequest(`/requests/${requestId}`, {
    method: 'GET',
  })
}

export async function cancelServiceRequest(requestId) {
  return apiRequest(`/requests/${requestId}/cancel`, {
    method: 'PATCH',
  })
}

export async function cancelPendingTechnicianBooking(requestId) {
  return apiRequest(`/requests/${requestId}/cancel-booking`, {
    method: 'PATCH',
  })
}

export async function closePendingTechnicianBooking(requestId) {
  return apiRequest(`/requests/${requestId}/close-booking`, {
    method: 'PATCH',
  })
}

export async function getRankedTechnicians(requestId) {
  return apiRequest(`/requests/${requestId}/technicians`, {
    method: 'GET',
  })
}

export async function bookTechnician(requestId, technician_id) {
  return apiRequest(`/requests/${requestId}/book`, {
    method: 'POST',
    body: JSON.stringify({ technician_id }),
  })
}

export async function getRequestOffers(requestId) {
  return apiRequest(`/requests/${requestId}/offers`, {
    method: 'GET',
  })
}

export async function acceptOffer(offerId) {
  return apiRequest(`/offers/${offerId}/accept`, {
    method: 'PATCH',
  })
}

export async function rejectOffer(offerId) {
  return apiRequest(`/offers/${offerId}/reject`, {
    method: 'PATCH',
  })
}

export async function getOrders({ page = 1, limit = 10, status } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })

  if (status) {
    params.set('status', status)
  }

  return apiRequest(`/orders?${params.toString()}`, {
    method: 'GET',
  })
}

export async function createOrder(payload) {
  return apiRequest('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getOrderById(orderId) {
  return apiRequest(`/orders/${orderId}`, {
    method: 'GET',
  })
}

export async function cancelOrder(orderId) {
  return apiRequest(`/orders/${orderId}/cancel`, {
    method: 'PATCH',
  })
}


export async function payOrder(orderId, payload) {
  return apiRequest(`/orders/${orderId}/pay`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getOrderFulfillment(orderId) {
  return apiRequest(`/orders/${orderId}/fulfillment`, {
    method: 'GET',
  })
}

export async function requestOrderReturn(orderId, payload) {
  return apiRequest(`/orders/${orderId}/return-request`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getInvoices(page = 1, limit = 20, paymentStatus) {
  let qs = `?page=${page}&limit=${limit}`
  if (paymentStatus) qs += `&payment_status=${paymentStatus}`
  return apiRequest(`/invoices${qs}`, { method: 'GET' })
}

export async function getInvoiceById(invoiceId) {
  return apiRequest(`/invoices/${invoiceId}`, {
    method: 'GET',
  })
}

export async function payInvoice(invoiceId, payload) {
  return apiRequest(`/invoices/${invoiceId}/pay`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ─── Jobs ─────────────────────────────────────────────────────
export async function getJobs({ page = 1, limit = 10 } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  return apiRequest(`/jobs?${params.toString()}`, { method: 'GET' })
}

export async function getJobById(jobId) {
  return apiRequest(`/jobs/${jobId}`, { method: 'GET' })
}

// ─── Reviews ──────────────────────────────────────────────────
export async function getReviews({ page = 1, limit = 10 } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  return apiRequest(`/reviews?${params.toString()}`, { method: 'GET' })
}

export async function createReview(payload) {
  return apiRequest('/reviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ─── Messages ─────────────────────────────────────────────────
export async function getRequestMessages(requestId, { page = 1, limit = 50 } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  return apiRequest(`/requests/${requestId}/messages?${params.toString()}`, { method: 'GET' })
}

export async function sendRequestMessage(requestId, payload) {
  return apiRequest(`/requests/${requestId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

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

// ─── File Uploads ─────────────────────────────────────────────
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

export async function uploadFiles(files, entityType, entityId) {
  const formData = new FormData()
  for (const f of files) formData.append('files', f)
  if (entityType) formData.append('entity_type', entityType)
  if (entityId) formData.append('entity_id', entityId)

  for (const baseUrl of API_BASE_CANDIDATES) {
    try {
      const res = await fetch(`${baseUrl}/uploads/multiple`, {
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

// ─── Payments (Stripe) ───────────────────────────────────────
export async function createInvoiceCheckout(invoiceId) {
  return apiRequest(`/payments/invoice/${invoiceId}/checkout`, { method: 'POST' })
}

export async function createOrderCheckout(orderId) {
  return apiRequest(`/payments/order/${orderId}/checkout`, { method: 'POST' })
}

// ─── QR Payment ──────────────────────────────────────────────
export async function getInvoiceQrData(invoiceId) {
  return apiRequest(`/invoices/${invoiceId}/qr-data`, { method: 'GET' })
}

export async function getOrderQrData(orderId) {
  return apiRequest(`/orders/${orderId}/qr-data`, { method: 'GET' })
}

// ─── Parts Catalog ───────────────────────────────────────────
export async function getParts({ search = '', category_id, in_stock, page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (search?.trim()) params.set('search', search.trim())
  if (category_id) params.set('category_id', String(category_id))
  if (in_stock) params.set('in_stock', 'true')
  return apiRequest(`/parts?${params.toString()}`, { method: 'GET' })
}

export async function getPartCategories() {
  return apiRequest('/parts/categories', { method: 'GET' })
}

export async function getPartById(partId) {
  return apiRequest(`/parts/${partId}`, { method: 'GET' })
}

// ─── Shared entity files (visible to any authenticated user) ──
export async function getEntityFiles(entityType, entityId, { page = 1, limit = 50 } = {}) {
  const qs = `?page=${page}&limit=${limit}`
  return apiRequest(`/uploads/entity/${entityType}/${entityId}${qs}`, { method: 'GET' })
}

// ─── Catalog parts with inventory (for technician dashboard) ──
export async function getCatalogPartsWithInventory({ search = '', page = 1, limit = 100 } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (search?.trim()) params.set('search', search.trim())
  return apiRequest(`/parts?${params.toString()}`, { method: 'GET' })
}

// ─── Platform Fee QR ─────────────────────────────────────────
export async function getPlatformFeeQr() {
  return apiRequest('/payments/platform-fee/qr', { method: 'GET' })
}
