import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { ApiError, getWarehouses, vendorSignIn } from '../lib/api'
import { setAuthUser } from '../store/authSlice'
import { createEmptyErrors, EMAIL_REGEX, useFirstErrorFocus } from '../lib/formValidation'
import RequiredAsterisk from '../components/RequiredAsterisk'

function VendorSignInPage({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const signupSuccessMessage = location.state?.signupSuccess
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
      await vendorSignIn({
        email: form.email.trim(),
        password: form.password,
      })

      await getWarehouses(1, 5)
      dispatch(setAuthUser({ email: form.email.trim(), role: 'vendor' }))
      navigate('/dashboard')
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
      <div className="hidden lg:flex lg:w-1/2 bg-cyan-50 dark:bg-slate-900 items-center justify-center relative overflow-hidden">
        <div className="relative z-10 w-full max-w-lg">
          <svg viewBox="0 0 500 500" className="w-full h-auto drop-shadow-2xl">
            {/* Soft Shadow */}
            <ellipse cx="250" cy="420" rx="150" ry="20" fill="rgba(0,0,0,0.05)" />

            {/* Main Warehouse Shape (Vendor) */}
            <rect x="180" y="150" width="140" height="180" rx="15" fill="#0891b2" />
            <path d="M180 180 L320 180 L320 200 L180 200 Z" fill="white" opacity="0.2" />
            <rect x="230" y="280" width="40" height="50" rx="5" fill="#06b6d4" />

            {/* Floating UI Elements */}
            <g className="animate-bounce" style={{ animationDuration: '3.5s' }}>
              <rect x="100" y="250" width="50" height="40" rx="8" fill="#22d3ee" />
              <rect x="110" y="260" width="30" height="2" rx="1" fill="white" />
              <rect x="110" y="270" width="20" height="2" rx="1" fill="white" />
            </g>

            <g className="animate-bounce" style={{ animationDuration: '5s', animationDelay: '1.5s' }}>
              <path
                d="M360 200 L420 200 L420 260 L360 260 Z"
                fill="#0ea5e9"
                transform="rotate(15 390 230)"
              />
              <path d="M375 225l5 5l10-10" stroke="white" strokeWidth="4" strokeLinecap="round" />
            </g>

            <g className="animate-pulse">
              <circle cx="210" cy="180" r="10" fill="white" opacity="0.4" />
              <circle cx="290" cy="180" r="10" fill="white" opacity="0.4" />
            </g>
          </svg>
        </div>

        {/* Background Decorative Circles */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-cyan-100/50 dark:bg-cyan-900/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-50/50 dark:bg-slate-800/10 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl"></div>
      </div>

      {/* Right Column - Form */}
      <div className="flex w-full flex-col px-4 py-6 sm:px-8 sm:py-10 md:px-20 md:py-24 lg:w-1/2">
        <div className="mb-10 flex items-center justify-between gap-3 sm:mb-12">
          <a
            href={import.meta.env.VITE_LANDING_APP_URL || 'http://localhost:5173'}
            className="flex items-center gap-2 text-cyan-600 font-black text-sm uppercase tracking-wider hover:-translate-x-1 transition-transform"
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
            <h1 className="mb-2 text-3xl font-black text-[#0f172a] dark:text-white sm:text-4xl">Vendor Sign In</h1>
            <p className="text-slate-500 dark:text-slate-400">Sign in to manage your items, orders, and payments.</p>
          </div>

          {(signupSuccessMessage || errors.form) && (
            <div className={`mb-6 p-4 rounded-xl text-sm border ${errors.form
                ? 'bg-red-50 border-red-100 text-red-700 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400'
                : 'bg-cyan-50 border-cyan-100 text-cyan-700 dark:bg-cyan-950/20 dark:border-cyan-900/50 dark:text-cyan-400'
              }`}>
              {errors.form || signupSuccessMessage}
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
                className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-cyan-500 focus:bg-white dark:focus:bg-slate-800 rounded-2xl px-5 py-4 text-sm outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                placeholder="vendor@example.com"
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
                <Link to="/auth/vendor/forgot-password" title="Forgot Password?" className="text-xs font-bold text-cyan-600 hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  ref={registerField('password')}
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange('password')}
                  onBlur={() => validateField('password')}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-cyan-500 focus:bg-white dark:focus:bg-slate-800 rounded-2xl px-5 py-4 text-sm outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-600 transition-colors"
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
              className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-cyan-500/25 active:scale-[0.98]"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">
            New here? <Link to="/auth/vendor/signup" className="text-cyan-600 font-bold hover:underline">Create account</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default VendorSignInPage

