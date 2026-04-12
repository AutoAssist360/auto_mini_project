import { useLocation, useNavigate } from 'react-router-dom'

function DashboardBackButton({ fallbackPath = '/dashboard' }) {
  const navigate = useNavigate()
  const location = useLocation()

  if (location.pathname === fallbackPath) {
    return null
  }

  const handleBack = () => {
    const historyIndex = window.history.state?.idx

    if (typeof historyIndex === 'number' && historyIndex > 0) {
      navigate(-1)
      return
    }

    navigate(fallbackPath, { replace: true })
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="fixed left-3 top-3 z-50 max-w-[calc(100vw-1.5rem)] whitespace-nowrap rounded-full border border-slate-300 bg-white/90 px-3.5 py-2 text-xs font-medium text-slate-700 shadow-lg backdrop-blur transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:hover:bg-slate-800 sm:left-6 sm:top-6 sm:px-4 sm:text-sm"
      aria-label="Go back to previous page"
    >
      Back
    </button>
  )
}

export default DashboardBackButton
