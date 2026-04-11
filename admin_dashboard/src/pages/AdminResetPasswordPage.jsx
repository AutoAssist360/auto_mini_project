import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { adminResetPassword, ApiError } from '../lib/api'
import { createEmptyErrors, useFirstErrorFocus } from '../lib/formValidation'
import RequiredAsterisk from '../components/RequiredAsterisk'

export default function AdminResetPasswordPage({ theme, onToggleTheme }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''
  const fieldOrder = ['password', 'confirm']
  const { registerField, focusFirst } = useFirstErrorFocus(fieldOrder)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState(createEmptyErrors(fieldOrder))
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isDark = theme === 'dark'

  const getErrors = (values = { password, confirm }) => {
    const nextErrors = createEmptyErrors(fieldOrder)
    if (!values.password) nextErrors.password = 'Password is required.'
    else if (values.password.length < 8) nextErrors.password = 'Password must be at least 8 characters.'
    if (!values.confirm) nextErrors.confirm = 'Please confirm your password.'
    else if (values.password !== values.confirm) nextErrors.confirm = 'Passwords do not match.'
    return nextErrors
  }

  const validateField = (field, values = { password, confirm }) => {
    const nextErrors = getErrors(values)
    setErrors((prev) => ({ ...prev, [field]: nextErrors[field] }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('Reset token is missing. Please use the link from your email.')
      return
    }

    const nextErrors = getErrors()
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) {
      focusFirst(nextErrors)
      return
    }

    setIsSubmitting(true)
    try {
      await adminResetPassword(token, password)
      setSuccess(true)
      setTimeout(() => navigate('/admin/login'), 3000)
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError('Invalid or expired reset link. Please request a new one.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={`min-h-screen flex items-center justify-center relative overflow-hidden font-['Outfit',_sans-serif] ${isDark ? 'dark bg-[#0B1120] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Ambient background glows */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-[440px] px-6 py-12">
        <div className="absolute top-0 right-6">
          <button
            onClick={onToggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-white/20 dark:border-slate-800/50 backdrop-blur-xl hover:scale-110 transition-all active:scale-95 shadow-xl"
          >
            {isDark ? (
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

        <div className="group relative rounded-[40px] border border-white/20 bg-white/70 p-8 shadow-2xl backdrop-blur-2xl transition-all duration-500 hover:shadow-blue-500/10 dark:border-slate-800/50 dark:bg-[#0B1120]/70 sm:p-10">
          <div className="mb-10 text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-[20px] bg-blue-600 text-xl font-black text-white shadow-xl shadow-blue-500/25 transition-transform group-hover:rotate-12">
              A
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 dark:text-blue-400">Reset password</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-[#0f172a] dark:text-white uppercase">Reset Access</h2>
            <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-loose">Choose a new password for your account</p>
          </div>

          {success ? (
            <div className="rounded-[24px] border border-blue-200 bg-blue-50/50 p-6 text-center backdrop-blur-md dark:border-blue-900/30 dark:bg-blue-900/10">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-black text-blue-900 dark:text-blue-100 uppercase tracking-tight">Password updated</h3>
              <p className="mt-2 text-xs font-medium text-blue-700/70 dark:text-blue-400/70 leading-relaxed">
                Your password has been updated. Redirecting to sign in...
              </p>
            </div>
          ) : (
            <form className="grid gap-6" onSubmit={handleSubmit} noValidate>
              <div className="space-y-2">
                <label htmlFor="password" className="block px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">New Password<RequiredAsterisk /></label>
                <input
                  id="password"
                  ref={registerField('password')}
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors((prev) => ({ ...prev, password: '', confirm: '' })) }}
                  onBlur={() => validateField('password')}
                  className="w-full rounded-[20px] bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 px-5 py-4 text-sm font-bold outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-inner"
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                />
                {errors.password && <p className="px-1 text-[10px] font-bold text-red-500 uppercase tracking-wider">{errors.password}</p>}
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm" className="block px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Confirm Password<RequiredAsterisk /></label>
                <input
                  id="confirm"
                  ref={registerField('confirm')}
                  type="password"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setErrors((prev) => ({ ...prev, confirm: '' })) }}
                  onBlur={() => validateField('confirm')}
                  className="w-full rounded-[20px] bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 px-5 py-4 text-sm font-bold outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-inner"
                  placeholder="Verify password"
                  autoComplete="new-password"
                />
                {errors.confirm && <p className="px-1 text-[10px] font-bold text-red-500 uppercase tracking-wider">{errors.confirm}</p>}
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50/50 px-4 py-3 text-[10px] font-bold text-red-600 uppercase tracking-wider dark:border-red-900/30 dark:bg-red-900/10">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !password || !confirm}
                className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-[20px] bg-blue-600 px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-blue-500/25 transition-all hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:shadow-none active:scale-[0.98]"
              >
                <span className="relative z-10">{isSubmitting ? 'Saving...' : 'Save new password'}</span>
                {!isSubmitting && (
                  <svg className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                )}
                <div className="absolute inset-0 translate-y-full bg-gradient-to-t from-white/10 to-transparent transition-transform group-hover:translate-y-0"></div>
              </button>
            </form>
          )}

          <div className="mt-8 text-center border-t border-slate-100 dark:border-slate-800 pt-6">
            <Link to="/admin/login" className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-500 transition-colors dark:text-blue-400">
              Back to sign in
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400/60 transition-colors dark:text-slate-600">
          Admin Portal &copy; {new Date().getFullYear()} Password Reset
        </p>
      </div>
    </div>
  )
}
