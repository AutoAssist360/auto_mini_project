import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { setAuthUser, clearAuth } from './store/authSlice'
import { getVendorProfile } from './lib/api'
import GlobalNotificationBell from './components/GlobalNotificationBell'
import VendorWorkflowDock from './components/VendorWorkflowDock'

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

const VendorSignInPage = lazyPage(() => import('./pages/VendorSignInPage'))
const VendorSignUpPage = lazyPage(() => import('./pages/VendorSignUpPage'))
const VendorDashboardPage = lazyPage(() => import('./pages/VendorDashboardPage'))
const VendorWarehousesPage = lazyPage(() => import('./pages/VendorWarehousesPage'))
const VendorInventoryPage = lazyPage(() => import('./pages/VendorInventoryPage'))
const VendorOrdersPage = lazyPage(() => import('./pages/VendorOrdersPage'))
const VendorOrderDetailPage = lazyPage(() => import('./pages/VendorOrderDetailPage'))
const VendorAnalyticsPage = lazyPage(() => import('./pages/VendorAnalyticsPage'))
const VendorNotificationsPage = lazyPage(() => import('./pages/VendorNotificationsPage'))
const VendorForgotPasswordPage = lazyPage(() => import('./pages/VendorForgotPasswordPage'))
const VendorResetPasswordPage = lazyPage(() => import('./pages/VendorResetPasswordPage'))
const VendorChangePasswordPage = lazyPage(() => import('./pages/VendorChangePasswordPage'))
const VendorProfilePage = lazyPage(() => import('./pages/VendorProfilePage'))
const VendorReviewsPage = lazyPage(() => import('./pages/VendorReviewsPage'))
const VendorReservationsPage = lazyPage(() => import('./pages/VendorReservationsPage'))
const VendorBulkImportPage = lazyPage(() => import('./pages/VendorBulkImportPage'))
const VendorLedgerPage = lazyPage(() => import('./pages/VendorLedgerPage'))

import { PageSkeleton } from './components/Skeleton'
import { ToastProvider } from './components/Toast'

function PageLoader() {
  return <PageSkeleton />
}

function RequireAuth({ children }) {
  const { isAuthenticated, isInitializing } = useSelector((state) => state.auth)
  if (isInitializing) return null
  if (!isAuthenticated) {
    return <Navigate to="/auth/vendor/signin" replace />
  }
  return children
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

    const storedTheme = localStorage.getItem('qa-theme')
    if (storedTheme) {
      return storedTheme
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('qa-theme', theme)
  }, [theme])

  // ── Session check on mount ───────────────────────────────
  // The httpOnly cookies are sent automatically. If the refresh cookie
  // is still valid we restore the session; otherwise user must sign in.
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await getVendorProfile()
        if (response?.vendor) {
          dispatch(setAuthUser(response.vendor))
        } else {
          dispatch(clearAuth())
        }
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
        VendorDashboardPage,
        VendorProfilePage,
        VendorWarehousesPage,
        VendorInventoryPage,
        VendorOrdersPage,
        VendorAnalyticsPage,
        VendorLedgerPage,
        VendorNotificationsPage,
        VendorReviewsPage,
      ].forEach((page) => page.preload?.())
    })
  }, [isAuthenticated])

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
  }

  // Show a minimal loading screen while verifying the session cookie
  if (isInitializing) {
    return <PageSkeleton />
  }

  const vp = { theme, onToggleTheme: toggleTheme }

  return (
    <ToastProvider>
    <Suspense fallback={<PageLoader />}>
    {isAuthenticated && <GlobalNotificationBell />}
    {isAuthenticated && <VendorWorkflowDock />}
    <Routes>
      <Route path="/" element={<Navigate to="/auth/vendor/signin" replace />} />
      <Route path="/auth/vendor/signin" element={<VendorSignInPage {...vp} />} />
      <Route path="/auth/vendor/signup" element={<VendorSignUpPage {...vp} />} />
      <Route path="/auth/vendor/forgot-password" element={<VendorForgotPasswordPage {...vp} />} />
      <Route path="/auth/vendor/reset-password" element={<VendorResetPasswordPage {...vp} />} />
      <Route path="/dashboard" element={<RequireAuth><VendorDashboardPage {...vp} /></RequireAuth>} />
      <Route path="/warehouses" element={<RequireAuth><VendorWarehousesPage {...vp} /></RequireAuth>} />
      <Route path="/warehouses/:warehouseId/inventory" element={<RequireAuth><VendorInventoryPage {...vp} /></RequireAuth>} />
      <Route path="/warehouses/:warehouseId/reservations" element={<RequireAuth><VendorReservationsPage {...vp} /></RequireAuth>} />
      <Route path="/reservations" element={<RequireAuth><VendorReservationsPage {...vp} /></RequireAuth>} />
      <Route path="/bulk-import" element={<RequireAuth><VendorBulkImportPage {...vp} /></RequireAuth>} />
      <Route path="/warehouses/:warehouseId/bulk-import" element={<RequireAuth><VendorBulkImportPage {...vp} /></RequireAuth>} />
      <Route path="/orders" element={<RequireAuth><VendorOrdersPage {...vp} /></RequireAuth>} />
      <Route path="/orders/:orderId" element={<RequireAuth><VendorOrderDetailPage {...vp} /></RequireAuth>} />
      <Route path="/analytics" element={<RequireAuth><VendorAnalyticsPage {...vp} /></RequireAuth>} />
      <Route path="/notifications" element={<RequireAuth><VendorNotificationsPage {...vp} /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><VendorProfilePage {...vp} /></RequireAuth>} />
      <Route path="/reviews" element={<RequireAuth><VendorReviewsPage {...vp} /></RequireAuth>} />
      <Route path="/change-password" element={<RequireAuth><VendorChangePasswordPage {...vp} /></RequireAuth>} />
      <Route path="/ledger" element={<RequireAuth><VendorLedgerPage {...vp} /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/auth/vendor/signin" replace />} />
    </Routes>
    </Suspense>
    </ToastProvider>
  )
}

export default App
