import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import RequiredAsterisk from '../components/RequiredAsterisk'
import { createEmptyErrors, useFirstErrorFocus } from '../lib/formValidation'

export default function UserResetPasswordPage({ theme, onToggleTheme }) {
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
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: password }),
      })
      setSuccess(true)
      setTimeout(() => navigate('/auth/user/signin'), 3000)
    } catch (err) {
      setError(err?.message || 'Invalid or expired reset link. Please request a new one.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <div className="mx-auto max-w-md px-4 py-16">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight text-blue-600">Quick Auto Assist</h1>
          <button onClick={onToggleTheme} className="rounded-lg border border-slate-300 px-3 py-1 text-xs dark:border-slate-700">
            {isDark ? 'Light' : 'Dark'}
          </button>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-bold">Reset Password</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Enter your new password below.</p>

          {success ? (
            <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300">
              <p className="font-semibold">Password reset successfully!</p>
              <p className="mt-1">Redirecting to sign in...</p>
            </div>
          ) : (
            <form className="mt-5 grid gap-4" onSubmit={handleSubmit} noValidate>
              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium">New Password<RequiredAsterisk /></label>
                <input
                  id="password"
                  ref={registerField('password')}
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setErrors((prev) => ({ ...prev, password: '', confirm: '' }))
                  }}
                  onBlur={() => validateField('password')}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800"
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                />
                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
              </div>

              <div>
                <label htmlFor="confirm" className="mb-1 block text-sm font-medium">Confirm Password<RequiredAsterisk /></label>
                <input
                  id="confirm"
                  ref={registerField('confirm')}
                  type="password"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value)
                    setErrors((prev) => ({ ...prev, confirm: '' }))
                  }}
                  onBlur={() => validateField('confirm')}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800"
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                />
                {errors.confirm && <p className="mt-1 text-xs text-red-600">{errors.confirm}</p>}
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !password || !confirm}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}

          <div className="mt-4 text-sm">
            <Link to="/auth/user/signin" className="text-blue-600 hover:text-blue-500 dark:text-blue-300">
              Back to Sign In
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
