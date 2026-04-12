import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { setAuthUser, clearAuth } from './store/authSlice'
import { getMyProfile } from './lib/api'

import CartDrawer from './components/CartDrawer'
import ChatWidget from './components/ChatWidget'
import GlobalNotificationBell from './components/GlobalNotificationBell'
import UserWorkflowDock from './components/UserWorkflowDock'

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

const UserSignInPage = lazyPage(() => import('./pages/UserSignInPage'))
const UserSignUpPage = lazyPage(() => import('./pages/UserSignUpPage'))
const UserDashboardPage = lazyPage(() => import('./pages/UserDashboardPage'))
const UserRequestsPage = lazyPage(() => import('./pages/UserRequestsPage'))
const UserNewRequestPage = lazyPage(() => import('./pages/UserNewRequestPage'))
const UserRequestDetailPage = lazyPage(() => import('./pages/UserRequestDetailPage'))
const UserOrdersPage = lazyPage(() => import('./pages/UserOrdersPage'))
const UserOrderDetailPage = lazyPage(() => import('./pages/UserOrderDetailPage'))
const UserInvoicesPage = lazyPage(() => import('./pages/UserInvoicesPage'))
const UserInvoiceDetailPage = lazyPage(() => import('./pages/UserInvoiceDetailPage'))
const UserProfilePage = lazyPage(() => import('./pages/UserProfilePage'))
const UserVehiclesPage = lazyPage(() => import('./pages/UserVehiclesPage'))
const UserJobsPage = lazyPage(() => import('./pages/UserJobsPage'))
const UserJobDetailPage = lazyPage(() => import('./pages/UserJobDetailPage'))
const UserReviewsPage = lazyPage(() => import('./pages/UserReviewsPage'))
const UserMessagesPage = lazyPage(() => import('./pages/UserMessagesPage'))
const UserNotificationsPage = lazyPage(() => import('./pages/UserNotificationsPage'))
const UserForgotPasswordPage = lazyPage(() => import('./pages/UserForgotPasswordPage'))
const UserResetPasswordPage = lazyPage(() => import('./pages/UserResetPasswordPage'))
const UserChangePasswordPage = lazyPage(() => import('./pages/UserChangePasswordPage'))
const UserPartsPage = lazyPage(() => import('./pages/UserPartsPage'))
const UserCheckoutPage = lazyPage(() => import('./pages/UserCheckoutPage'))
const UserFeedbackPage = lazyPage(() => import('./pages/UserFeedbackPage'))

import { PageSkeleton } from './components/Skeleton'
import { ToastProvider } from './components/Toast'

function PageLoader() {
  return <PageSkeleton />
}


function RequireAuth({ children }) {
  const { isAuthenticated, isInitializing } = useSelector((state) => state.auth)
  if (isInitializing) return null // App-level loader handles this
  if (!isAuthenticated) {
    return <Navigate to="/auth/user/signin" replace />
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
  // The httpOnly cookies are sent automatically. If valid the user
  // is restored; if the access token expired the api layer auto-calls
  // POST /auth/refresh before retrying.
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await getMyProfile()
        if (response?.user?.role === 'user') {
          dispatch(setAuthUser(response.user))
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
        UserDashboardPage,
        UserVehiclesPage,
        UserNewRequestPage,
        UserRequestsPage,
        UserJobsPage,
        UserOrdersPage,
        UserPartsPage,
        UserProfilePage,
        UserNotificationsPage,
        UserFeedbackPage,
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

  return (
    <ToastProvider>
      <Suspense fallback={<PageLoader />}>
        {isAuthenticated && <CartDrawer />}
        {isAuthenticated && <ChatWidget />}
        {isAuthenticated && <GlobalNotificationBell />}
        {isAuthenticated && <UserWorkflowDock />}
        <Routes>
          <Route path="/" element={<Navigate to="/auth/user/signin" replace />} />
          <Route path="/auth/user/signin" element={<UserSignInPage theme={theme} onToggleTheme={toggleTheme} />} />
          <Route path="/auth/user/signup" element={<UserSignUpPage theme={theme} onToggleTheme={toggleTheme} />} />
          <Route path="/auth/user/forgot-password" element={<UserForgotPasswordPage theme={theme} onToggleTheme={toggleTheme} />} />
          <Route path="/auth/user/reset-password" element={<UserResetPasswordPage theme={theme} onToggleTheme={toggleTheme} />} />
          <Route
            path="/dashboard"
            element={(
              <RequireAuth>
                <UserDashboardPage theme={theme} onToggleTheme={toggleTheme} />
              </RequireAuth>
            )}
          />
          <Route
            path="/requests"
            element={(
              <RequireAuth>
                <UserRequestsPage theme={theme} onToggleTheme={toggleTheme} />
              </RequireAuth>
            )}
          />
          <Route
            path="/requests/new"
            element={(
              <RequireAuth>
                <UserNewRequestPage theme={theme} onToggleTheme={toggleTheme} />
              </RequireAuth>
            )}
          />
          <Route
            path="/requests/:requestId"
            element={(
              <RequireAuth>
                <UserRequestDetailPage theme={theme} onToggleTheme={toggleTheme} />
              </RequireAuth>
            )}
          />
          <Route
            path="/orders"
            element={(
              <RequireAuth>
                <UserOrdersPage theme={theme} onToggleTheme={toggleTheme} />
              </RequireAuth>
            )}
          />
          <Route
            path="/orders/:orderId"
            element={(
              <RequireAuth>
                <UserOrderDetailPage theme={theme} onToggleTheme={toggleTheme} />
              </RequireAuth>
            )}
          />
          <Route
            path="/invoices"
            element={(
              <RequireAuth>
                <UserInvoicesPage theme={theme} onToggleTheme={toggleTheme} />
              </RequireAuth>
            )}
          />
          <Route
            path="/invoices/:invoiceId"
            element={(
              <RequireAuth>
                <UserInvoiceDetailPage theme={theme} onToggleTheme={toggleTheme} />
              </RequireAuth>
            )}
          />
          <Route
            path="/jobs"
            element={(
              <RequireAuth>
                <UserJobsPage theme={theme} onToggleTheme={toggleTheme} />
              </RequireAuth>
            )}
          />
          <Route
            path="/jobs/:jobId"
            element={(
              <RequireAuth>
                <UserJobDetailPage theme={theme} onToggleTheme={toggleTheme} />
              </RequireAuth>
            )}
          />
          <Route
            path="/reviews"
            element={(
              <RequireAuth>
                <UserReviewsPage theme={theme} onToggleTheme={toggleTheme} />
              </RequireAuth>
            )}
          />
          <Route
            path="/requests/:requestId/messages"
            element={(
              <RequireAuth>
                <UserMessagesPage theme={theme} onToggleTheme={toggleTheme} />
              </RequireAuth>
            )}
          />
          <Route
            path="/profile"
            element={(
              <RequireAuth>
                <UserProfilePage theme={theme} onToggleTheme={toggleTheme} />
              </RequireAuth>
            )}
          />
          <Route
            path="/vehicles"
            element={(
              <RequireAuth>
                <UserVehiclesPage theme={theme} onToggleTheme={toggleTheme} />
              </RequireAuth>
            )}
          />
          <Route
            path="/notifications"
            element={(
              <RequireAuth>
                <UserNotificationsPage theme={theme} onToggleTheme={toggleTheme} />
              </RequireAuth>
            )}
          />
          <Route
            path="/change-password"
            element={(
              <RequireAuth>
                <UserChangePasswordPage theme={theme} onToggleTheme={toggleTheme} />
              </RequireAuth>
            )}
          />
          <Route
            path="/parts"
            element={(
              <RequireAuth>
                <UserPartsPage theme={theme} onToggleTheme={toggleTheme} />
              </RequireAuth>
            )}
          />
          <Route
            path="/checkout"
            element={(
              <RequireAuth>
                <UserCheckoutPage theme={theme} onToggleTheme={toggleTheme} />
              </RequireAuth>
            )}
          />
          <Route
            path="/feedback"
            element={(
              <RequireAuth>
                <UserFeedbackPage theme={theme} onToggleTheme={toggleTheme} />
              </RequireAuth>
            )}
          />
          <Route path="*" element={<Navigate to="/auth/user/signin" replace />} />
        </Routes>
      </Suspense>
    </ToastProvider>
  )
}

export default App
