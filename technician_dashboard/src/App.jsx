import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { setAuthUser, clearAuth } from './store/authSlice'
import { getTechnicianProfile } from './lib/api'
import GlobalNotificationBell from './components/GlobalNotificationBell'
import TechnicianWorkflowDock from './components/TechnicianWorkflowDock'

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

const TechnicianSignInPage = lazyPage(() => import('./pages/TechnicianSignInPage'))
const TechnicianSignUpPage = lazyPage(() => import('./pages/TechnicianSignUpPage'))
const TechnicianDashboardPage = lazyPage(() => import('./pages/TechnicianDashboardPage'))
const TechnicianProfilePage = lazyPage(() => import('./pages/TechnicianProfilePage'))
const TechnicianOffersPage = lazyPage(() => import('./pages/TechnicianOffersPage'))
const TechnicianAssignmentsPage = lazyPage(() => import('./pages/TechnicianAssignmentsPage'))
const TechnicianJobsPage = lazyPage(() => import('./pages/TechnicianJobsPage'))
const TechnicianJobDetailPage = lazyPage(() => import('./pages/TechnicianJobDetailPage'))
const TechnicianEarningsPage = lazyPage(() => import('./pages/TechnicianEarningsPage'))
const TechnicianMessagesPage = lazyPage(() => import('./pages/TechnicianMessagesPage'))
const TechnicianDiscoverPage = lazyPage(() => import('./pages/TechnicianDiscoverPage'))
const TechnicianNotificationsPage = lazyPage(() => import('./pages/TechnicianNotificationsPage'))
const TechnicianForgotPasswordPage = lazyPage(() => import('./pages/TechnicianForgotPasswordPage'))
const TechnicianResetPasswordPage = lazyPage(() => import('./pages/TechnicianResetPasswordPage'))
const TechnicianChangePasswordPage = lazyPage(() => import('./pages/TechnicianChangePasswordPage'))
const TechnicianReviewsPage = lazyPage(() => import('./pages/TechnicianReviewsPage'))

import { PageSkeleton } from './components/Skeleton'
import { ToastProvider } from './components/Toast'

function PageLoader() {
  return <PageSkeleton />
}

function RequireAuth({ children }) {
  const { isAuthenticated, isInitializing } = useSelector((state) => state.auth)
  if (isInitializing) return null
  if (!isAuthenticated) {
    return <Navigate to="/auth/technician/signin" replace />
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
  // POST /tech/auth/refresh before retrying.
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await getTechnicianProfile()
        if (response?.profile) {
          dispatch(setAuthUser(response.profile))
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
        TechnicianDashboardPage,
        TechnicianDiscoverPage,
        TechnicianOffersPage,
        TechnicianAssignmentsPage,
        TechnicianJobsPage,
        TechnicianEarningsPage,
        TechnicianProfilePage,
        TechnicianNotificationsPage,
        TechnicianReviewsPage,
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

  const tp = { theme, onToggleTheme: toggleTheme }

  return (
    <ToastProvider>
    <Suspense fallback={<PageLoader />}>
    {isAuthenticated && <GlobalNotificationBell />}
    {isAuthenticated && <TechnicianWorkflowDock />}
    <Routes>
      <Route path="/" element={<Navigate to="/auth/technician/signin" replace />} />
      <Route path="/auth/technician/signin" element={<TechnicianSignInPage {...tp} />} />
      <Route path="/auth/technician/signup" element={<TechnicianSignUpPage {...tp} />} />
      <Route path="/auth/technician/forgot-password" element={<TechnicianForgotPasswordPage {...tp} />} />
      <Route path="/auth/technician/reset-password" element={<TechnicianResetPasswordPage {...tp} />} />
      <Route path="/dashboard" element={<RequireAuth><TechnicianDashboardPage {...tp} /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><TechnicianProfilePage {...tp} /></RequireAuth>} />
      <Route path="/offers" element={<RequireAuth><TechnicianOffersPage {...tp} /></RequireAuth>} />
      <Route path="/discover" element={<RequireAuth><TechnicianDiscoverPage {...tp} /></RequireAuth>} />
      <Route path="/assignments" element={<RequireAuth><TechnicianAssignmentsPage {...tp} /></RequireAuth>} />
      <Route path="/jobs" element={<RequireAuth><TechnicianJobsPage {...tp} /></RequireAuth>} />
      <Route path="/jobs/:jobId" element={<RequireAuth><TechnicianJobDetailPage {...tp} /></RequireAuth>} />
      <Route path="/earnings" element={<RequireAuth><TechnicianEarningsPage {...tp} /></RequireAuth>} />
      <Route path="/messages/:requestId" element={<RequireAuth><TechnicianMessagesPage {...tp} /></RequireAuth>} />
      <Route path="/notifications" element={<RequireAuth><TechnicianNotificationsPage {...tp} /></RequireAuth>} />
      <Route path="/reviews" element={<RequireAuth><TechnicianReviewsPage {...tp} /></RequireAuth>} />
      <Route path="/change-password" element={<RequireAuth><TechnicianChangePasswordPage {...tp} /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/auth/technician/signin" replace />} />
    </Routes>
    </Suspense>
    </ToastProvider>
  )
}

export default App
