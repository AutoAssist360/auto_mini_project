import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const RoleSelectionPage = lazy(() => import('./pages/RoleSelectionPage'))
const FAQPage = lazy(() => import('./pages/FAQPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md space-y-4 px-6">
        <div className="mx-auto h-6 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="mx-auto h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      </div>
      <></>
    </div>
  )
}

function App() {
  const [theme, setTheme] = useState(() => {
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

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage theme={theme} onToggleTheme={toggleTheme} />} />
          <Route path="/auth/role" element={<RoleSelectionPage theme={theme} />} />
          <Route path="/faq" element={<FAQPage theme={theme} onToggleTheme={toggleTheme} />} />
          <Route path="/terms" element={<TermsPage theme={theme} onToggleTheme={toggleTheme} />} />
          <Route path="/privacy" element={<PrivacyPage theme={theme} onToggleTheme={toggleTheme} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
