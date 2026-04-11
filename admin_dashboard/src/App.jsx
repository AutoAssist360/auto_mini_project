import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { setAuthUser, setDashboardSnapshot, clearAuth } from './store/authSlice'
import { refreshSession, getDashboard } from './lib/api'
import AdminWorkflowDock from './components/AdminWorkflowDock'

function lazyPage(factory) {
  const load = factory
  const Component = lazy(load)
  return Object.assign(Component, { preload: load })
}

function scheduleIdle(callback) {
  if (typeof window === 'undefined') return () => {}

  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(callback, { timeout: 1200 })
    return () => window.cancelIdleCallback(id)
  }

  const id = window.setTimeout(callback, 300)
  return () => window.clearTimeout(id)
}

const AdminLoginPage = lazyPage(() => import('./pages/AdminLoginPage'))
const AdminForgotPasswordPage = lazyPage(() => import('./pages/AdminForgotPasswordPage'))
const AdminResetPasswordPage = lazyPage(() => import('./pages/AdminResetPasswordPage'))
const AdminDashboardPage = lazyPage(() => import('./pages/AdminDashboardPage'))
const AdminUsersPage = lazyPage(() => import('./pages/AdminUsersPage'))
const AdminUserDetailPage = lazyPage(() => import('./pages/AdminUserDetailPage'))
const AdminTechniciansPage = lazyPage(() => import('./pages/AdminTechniciansPage'))
const AdminTechnicianDetailPage = lazyPage(() => import('./pages/AdminTechnicianDetailPage'))
const AdminVendorsPage = lazyPage(() => import('./pages/AdminVendorsPage'))
const AdminVendorDetailPage = lazyPage(() => import('./pages/AdminVendorDetailPage'))
const AdminWarehousesPage = lazyPage(() => import('./pages/AdminWarehousesPage'))
const AdminWarehouseDetailPage = lazyPage(() => import('./pages/AdminWarehouseDetailPage'))
const AdminRequestsPage = lazyPage(() => import('./pages/AdminRequestsPage'))
const AdminRequestDetailPage = lazyPage(() => import('./pages/AdminRequestDetailPage'))
const AdminJobsPage = lazyPage(() => import('./pages/AdminJobsPage'))
const AdminJobDetailPage = lazyPage(() => import('./pages/AdminJobDetailPage'))
const AdminOrdersPage = lazyPage(() => import('./pages/AdminOrdersPage'))
const AdminOrderDetailPage = lazyPage(() => import('./pages/AdminOrderDetailPage'))
const AdminInvoicesPage = lazyPage(() => import('./pages/AdminInvoicesPage'))
const AdminInvoiceDetailPage = lazyPage(() => import('./pages/AdminInvoiceDetailPage'))
const AdminAnalyticsPage = lazyPage(() => import('./pages/AdminAnalyticsPage'))
const AdminAuditLogsPage = lazyPage(() => import('./pages/AdminAuditLogsPage'))
const AdminChangePasswordPage = lazyPage(() => import('./pages/AdminChangePasswordPage'))
const AdminCarCatalogPage = lazyPage(() => import('./pages/AdminCarCatalogPage'))
const AdminNotificationsPage = lazyPage(() => import('./pages/AdminNotificationsPage'))
const AdminPayoutsPage = lazyPage(() => import('./pages/AdminPayoutsPage'))

import { PageSkeleton } from './components/Skeleton'
import { ToastProvider } from './components/Toast'

function PageLoader() {
  return <PageSkeleton />
}

function RequireAuth({ children }) {
  const { isAuthenticated, isInitializing } = useSelector((state) => state.auth)
  if (isInitializing) return null
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />
  return children
}

function Auth({ children }) {
  return <RequireAuth>{children}</RequireAuth>
}

function App() {
  const dispatch = useDispatch()
  const { isInitializing, isAuthenticated } = useSelector((state) => state.auth)

  const [theme, setTheme] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const urlTheme = params.get('theme')
    if (urlTheme && (urlTheme === 'light' || urlTheme === 'dark')) {
      return urlTheme
    }

    const stored = localStorage.getItem('qa-theme')
    if (stored) return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('qa-theme', theme)
  }, [theme])

  // ── Session check on mount ───────────────────────────────
  // The httpOnly cookies are sent automatically. If the refresh cookie
  // is still valid we restore the session; otherwise admin must log in.
  useEffect(() => {
    const checkSession = async () => {
      try {
        await refreshSession()
        // Session valid — pre-fetch dashboard snapshot
        try {
          const dashData = await getDashboard()
          dispatch(setDashboardSnapshot(dashData || null))
        } catch {
          // dashboard fetch optional — session is still valid
        }
        dispatch(setAuthUser({ role: 'admin' }))
      } catch {
        dispatch(clearAuth())
      }
    }
    checkSession()
  }, [dispatch])

  useEffect(() => {
    if (!isAuthenticated) return undefined

    return scheduleIdle(() => {
      [
        AdminDashboardPage,
        AdminRequestsPage,
        AdminJobsPage,
        AdminOrdersPage,
        AdminTechniciansPage,
        AdminUsersPage,
        AdminVendorsPage,
        AdminPayoutsPage,
        AdminAnalyticsPage,
      ].forEach((page) => page.preload?.())
    })
  }, [isAuthenticated])

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  // Show a minimal loading screen while verifying the session cookie
  if (isInitializing) {
    return <PageSkeleton />
  }

  const tp = { theme, onToggleTheme: toggleTheme }

  return (
    <ToastProvider>
    <Suspense fallback={<PageLoader />}>
    {isAuthenticated && <AdminWorkflowDock />}
    <Routes>
      <Route path="/" element={<Navigate to="/admin/login" replace />} />
      <Route path="/admin/login" element={<AdminLoginPage {...tp} />} />
      <Route path="/admin/forgot-password" element={<AdminForgotPasswordPage {...tp} />} />
      <Route path="/admin/reset-password" element={<AdminResetPasswordPage {...tp} />} />

      <Route path="/admin/dashboard"              element={<Auth><AdminDashboardPage {...tp} /></Auth>} />

      <Route path="/admin/users"                   element={<Auth><AdminUsersPage /></Auth>} />
      <Route path="/admin/users/:userId"           element={<Auth><AdminUserDetailPage /></Auth>} />

      <Route path="/admin/technicians"             element={<Auth><AdminTechniciansPage /></Auth>} />
      <Route path="/admin/technicians/:techId"     element={<Auth><AdminTechnicianDetailPage /></Auth>} />

      <Route path="/admin/vendors"                 element={<Auth><AdminVendorsPage /></Auth>} />
      <Route path="/admin/vendors/:vendorId"       element={<Auth><AdminVendorDetailPage /></Auth>} />

      <Route path="/admin/warehouses"              element={<Auth><AdminWarehousesPage /></Auth>} />
      <Route path="/admin/warehouses/:warehouseId" element={<Auth><AdminWarehouseDetailPage /></Auth>} />

      <Route path="/admin/requests"                element={<Auth><AdminRequestsPage /></Auth>} />
      <Route path="/admin/requests/:requestId"     element={<Auth><AdminRequestDetailPage /></Auth>} />

      <Route path="/admin/jobs"                    element={<Auth><AdminJobsPage /></Auth>} />
      <Route path="/admin/jobs/:jobId"             element={<Auth><AdminJobDetailPage /></Auth>} />

      <Route path="/admin/orders"                  element={<Auth><AdminOrdersPage /></Auth>} />
      <Route path="/admin/orders/:orderId"         element={<Auth><AdminOrderDetailPage /></Auth>} />

      <Route path="/admin/invoices"                element={<Auth><AdminInvoicesPage /></Auth>} />
      <Route path="/admin/invoices/:invoiceId"     element={<Auth><AdminInvoiceDetailPage /></Auth>} />

      <Route path="/admin/analytics"               element={<Auth><AdminAnalyticsPage /></Auth>} />
      <Route path="/admin/audit-logs"              element={<Auth><AdminAuditLogsPage /></Auth>} />
      <Route path="/admin/change-password"           element={<Auth><AdminChangePasswordPage {...tp} /></Auth>} />
      <Route path="/admin/car-catalog"               element={<Auth><AdminCarCatalogPage {...tp} /></Auth>} />
      <Route path="/admin/notifications"             element={<Auth><AdminNotificationsPage {...tp} /></Auth>} />
      <Route path="/admin/payouts"                   element={<Auth><AdminPayoutsPage {...tp} /></Auth>} />

      <Route path="*" element={<Navigate to="/admin/login" replace />} />
    </Routes>
    </Suspense>
    </ToastProvider>
  )
}

export default App
