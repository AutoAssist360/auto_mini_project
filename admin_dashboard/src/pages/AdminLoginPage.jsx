import { useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { adminSignIn, ApiError, getDashboard } from '../lib/api'
import { setAuthUser, setDashboardSnapshot } from '../store/authSlice'
import { createEmptyErrors, EMAIL_REGEX, useFirstErrorFocus } from '../lib/formValidation'
import RequiredAsterisk from '../components/RequiredAsterisk'

function AdminLoginPage({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const fieldOrder = ['email', 'password']
  const { registerField, focusFirst } = useFirstErrorFocus(fieldOrder)

  const [form, setForm] = useState({
    email: '',
    password: '',
  })
  const [errors, setErrors] = useState(createEmptyErrors(fieldOrder))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const isDisabled = useMemo(() => isSubmitting || !form.email || !form.password, [isSubmitting, form.email, form.password])

  const handleChange = (field) => (event) => {
    const value = event.target.value
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: '', form: '' }))
  }

  const getErrors = (values = form) => {
    const nextErrors = createEmptyErrors(fieldOrder)
    if (!values.email.trim()) nextErrors.email = 'Email is required'
    else if (!EMAIL_REGEX.test(values.email.trim())) nextErrors.email = 'Enter a valid email address'
    if (!values.password) nextErrors.password = 'Password is required'
    return nextErrors
  }

  const validateField = (field, values = form) => {
    const nextErrors = getErrors(values)
    setErrors((prev) => ({ ...prev, [field]: nextErrors[field], form: '' }))
  }

  const validateForm = () => {
    const nextErrors = getErrors(form)
    setErrors(nextErrors)
    const isValid = !Object.values(nextErrors).some(Boolean)
    if (!isValid) focusFirst(nextErrors)
    return isValid
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validateForm()) return

    setIsSubmitting(true)
    setErrors(createEmptyErrors(fieldOrder))

    try {
      await adminSignIn({
        email: form.email.trim(),
        password: form.password,
      })

      const dashboardResponse = await getDashboard()
      dispatch(setDashboardSnapshot(dashboardResponse || null))
      dispatch(setAuthUser({ email: form.email.trim(), role: 'admin' }))

      navigate('/admin/dashboard')
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors((prev) => ({ ...prev, form: error.message }))
      } else {
        setErrors((prev) => ({ ...prev, form: 'Unable to sign in. Please try again.' }))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-900 transition-colors duration-500 dark:bg-slate-950 dark:text-white font-['Outfit',_sans-serif] lg:flex">
      {/* Left Column - Illustration */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-100 dark:bg-slate-900 items-center justify-center relative overflow-hidden">
        <div className="relative z-10 w-full max-w-lg">
          <svg viewBox="0 0 500 500" className="w-full h-auto drop-shadow-2xl">
            {/* Soft Shadow */}
            <ellipse cx="250" cy="420" rx="150" ry="20" fill="rgba(0,0,0,0.05)" />

            {/* Main Shield Shape (Admin) */}
            <path
              d="M250 100 L350 130 L350 300 L250 400 L150 300 L150 130 Z"
              fill="#475569"
            />
            <path d="M250 120 L330 145 L330 290 L250 370 L170 290 L170 145 Z" fill="#64748b" />
            <rect x="235" y="200" width="30" height="80" rx="15" fill="white" opacity="0.2" />

            {/* Floating UI Elements */}
            <g className="animate-bounce" style={{ animationDuration: '4s' }}>
              <circle cx="120" cy="180" r="25" fill="#475569" />
              <rect x="110" y="170" width="20" height="5" rx="2" fill="white" />
            </g>

            <g className="animate-bounce" style={{ animationDuration: '6s', animationDelay: '2s' }}>
              <rect x="380" y="280" width="60" height="40" rx="10" fill="#94a3b8" />
              <circle cx="410" cy="300" r="8" fill="white" />
            </g>

            <g className="animate-pulse">
              <path d="M220 150h60M230 170h40M240 190h20" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.3" />
            </g>
          </svg>
        </div>

        {/* Background Decorative Circles */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-slate-200/50 dark:bg-slate-800/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-slate-100/50 dark:bg-slate-700/10 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl"></div>
      </div>

      {/* Right Column - Form */}
      <div className="flex w-full flex-col px-4 py-6 sm:px-8 sm:py-10 md:px-20 md:py-24 lg:w-1/2">
        <div className="mb-10 flex items-center justify-between gap-3 sm:mb-12">
          <a
            href={import.meta.env.VITE_LANDING_APP_URL || 'http://localhost:5173'}
            className="flex items-center gap-2 text-slate-600 font-black text-sm uppercase tracking-wider hover:-translate-x-1 transition-transform"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back To Home
          </a>
          <button
            onClick={onToggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:scale-110 transition-all active:scale-95"
          >
            {theme === 'dark' ? (
              <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 9H3" />
                <circle cx="12" cy="12" r="5" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>

        <div className="max-w-md w-full mx-auto lg:my-auto">
          <div className="mb-10">
            <h1 className="mb-2 text-3xl font-black text-[#0f172a] dark:text-white sm:text-4xl">Admin Sign In</h1>
            <p className="text-slate-500 dark:text-slate-400">Sign in to manage users, requests, and reports.</p>
          </div>

          {errors.form && (
            <div className="mb-6 p-4 rounded-xl text-sm border bg-red-50 border-red-100 text-red-700 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400">
              {errors.form}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 px-1">
                Email Address
                <RequiredAsterisk />
              </label>
              <input
                id="email"
                ref={registerField('email')}
                type="email"
                value={form.email}
                onChange={handleChange('email')}
                onBlur={() => validateField('email')}
                className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-slate-500 focus:bg-white dark:focus:bg-slate-800 rounded-2xl px-5 py-4 text-sm outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                placeholder="admin@example.com"
                autoComplete="email"
              />
              {errors.email && <p className="mt-2 text-xs text-red-600 font-medium px-1">{errors.email}</p>}
            </div>

            <div>
              <div className="flex justify-between items-center mb-2 px-1">
                <label htmlFor="password" className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                  Password
                  <RequiredAsterisk />
                </label>
                <Link to="/admin/forgot-password" title="Forgot Password?" className="text-xs font-bold text-slate-600 hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  ref={registerField('password')}
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange('password')}
                  onBlur={() => validateField('password')}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-slate-500 focus:bg-white dark:focus:bg-slate-800 rounded-2xl px-5 py-4 text-sm outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.888 9.888L21 21M3 3l18 18" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
              {errors.password && <p className="mt-2 text-xs text-red-600 font-medium px-1">{errors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={isDisabled}
              className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-slate-500/25 active:scale-[0.98]"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400 flex flex-col gap-1">
            <p>Admin accounts are created by the team.</p>
            <p>Public sign-up is not available.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminLoginPage

