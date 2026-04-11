import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminChangePassword, ApiError } from '../lib/api'
import Breadcrumbs from '../components/Breadcrumbs'
import { useToast } from '../components/toastContext'
import { createEmptyErrors, useFirstErrorFocus } from '../lib/formValidation'
import RequiredAsterisk from '../components/RequiredAsterisk'

function AdminChangePasswordPage({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const fieldOrder = ['current_password', 'new_password', 'confirmPassword']
  const { registerField, focusFirst } = useFirstErrorFocus(fieldOrder)

  const [form, setForm] = useState({ current_password: '', new_password: '', confirmPassword: '' })
  const [errors, setErrors] = useState(createEmptyErrors(fieldOrder))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState('')

  const isDisabled = useMemo(
    () => isSubmitting || !form.current_password || !form.new_password || !form.confirmPassword,
    [isSubmitting, form],
  )

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    setErrors((prev) => ({ ...prev, [field]: '', form: '' }))
    setSuccess('')
  }

  const getErrors = (values = form) => {
    const nextErrors = createEmptyErrors(fieldOrder)
    if (!values.current_password) nextErrors.current_password = 'Current password is required'
    if (!values.new_password) nextErrors.new_password = 'New password is required'
    else if (values.new_password.length < 8) nextErrors.new_password = 'Must be at least 8 characters'
    if (!values.confirmPassword) nextErrors.confirmPassword = 'Please confirm your new password'
    else if (values.new_password !== values.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match'
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setIsSubmitting(true)
    setErrors((prev) => ({ ...prev, form: '' }))
    setSuccess('')

    try {
      await adminChangePassword(form.current_password, form.new_password)
      setSuccess('Password changed successfully. You will be redirected to sign in again.')
      toast.success('Password changed successfully')
      setTimeout(() => navigate('/admin/login'), 2500)
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        form: err instanceof ApiError ? err.message : 'Failed to change password. Please try again.',
      }))
      toast.error(err instanceof ApiError ? err.message : 'Failed to change password')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] transition-colors duration-500 overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Floating Capsule Header */}
        <header className="mb-8 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-6 py-3 shadow-xl dark:shadow-2xl transition-all">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">Password Settings</span>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
            </div>

            <button
              onClick={onToggleTheme}
              className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all font-bold"
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </header>

        <Breadcrumbs items={[
          { label: 'DASHBOARD', to: '/admin/dashboard' },
          { label: 'CHANGE PASSWORD' },
        ]} />

        <main className="mt-8 mx-auto max-w-[480px]">
          <div className="group relative rounded-[40px] border border-white/20 bg-white/70 p-8 shadow-24 backdrop-blur-2xl transition-all duration-500 dark:border-slate-800/50 dark:bg-[#0B1120]/70 sm:p-10">
            <div className="mb-10 text-center">
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-[20px] bg-blue-600 text-xl font-black text-white shadow-xl shadow-blue-500/25 transition-transform group-hover:rotate-12 uppercase">
                K
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 dark:text-blue-400">Account security</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-[#0f172a] dark:text-white uppercase leading-none">Change Password</h2>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-loose text-center mx-auto max-w-[280px]">
                Enter your current password, then choose a new one. You will sign in again after saving.
              </p>
            </div>

            <form className="grid gap-6" onSubmit={handleSubmit} noValidate>
              <div className="space-y-2">
                <label htmlFor="current_password" className="block px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Current Password<RequiredAsterisk /></label>
                <input
                  id="current_password"
                  ref={registerField('current_password')}
                  type="password"
                  value={form.current_password}
                  onChange={handleChange('current_password')}
                  onBlur={() => validateField('current_password')}
                  className="w-full rounded-[20px] bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 px-5 py-4 text-sm font-bold outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700 shadow-inner tracking-widest"
                  placeholder="********"
                />
                {errors.current_password && <p className="px-1 text-[10px] font-bold text-red-500 uppercase tracking-wider">{errors.current_password}</p>}
              </div>

              <div className="space-y-2">
                <label htmlFor="new_password" className="block px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">New Password<RequiredAsterisk /></label>
                <input
                  id="new_password"
                  ref={registerField('new_password')}
                  type="password"
                  value={form.new_password}
                  onChange={handleChange('new_password')}
                  onBlur={() => validateField('new_password')}
                  className="w-full rounded-[20px] bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 px-5 py-4 text-sm font-bold outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700 shadow-inner tracking-widest"
                  placeholder="Min 8 chars"
                />
                {errors.new_password && <p className="px-1 text-[10px] font-bold text-red-500 uppercase tracking-wider">{errors.new_password}</p>}
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="block px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Confirm New Password<RequiredAsterisk /></label>
                <input
                  id="confirmPassword"
                  ref={registerField('confirmPassword')}
                  type="password"
                  value={form.confirmPassword}
                  onChange={handleChange('confirmPassword')}
                  onBlur={() => validateField('confirmPassword')}
                  className="w-full rounded-[20px] bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 px-5 py-4 text-sm font-bold outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700 shadow-inner tracking-widest"
                  placeholder="Re-enter your new password"
                />
                {errors.confirmPassword && <p className="px-1 text-[10px] font-bold text-red-500 uppercase tracking-wider">{errors.confirmPassword}</p>}
              </div>

              {errors.form && (
                <div className="rounded-[20px] border border-red-200 bg-red-50/50 px-4 py-3 text-[10px] font-bold text-red-600 uppercase tracking-widest dark:border-red-900/30 dark:bg-red-900/10 shadow-sm">
                  {errors.form}
                </div>
              )}

              {success ? (
                <div className="rounded-[24px] border border-blue-200 bg-blue-50/50 p-6 text-center backdrop-blur-md dark:border-blue-900/30 dark:bg-blue-900/10 shadow-lg">
                  <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 shadow-inner">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-black text-blue-900 dark:text-blue-100 uppercase tracking-widest">Password Updated</h3>
                  <p className="mt-2 text-[10px] font-bold text-blue-700/70 dark:text-blue-400/70 leading-relaxed uppercase tracking-wider">
                    Signing you out now. Redirecting to the login page...
                  </p>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={isDisabled}
                  className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-[20px] bg-blue-600 px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-blue-500/25 transition-all hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:shadow-none active:scale-[0.98]"
                >
                  <span className="relative z-10">{isSubmitting ? 'Saving...' : 'Save New Password'}</span>
                  {!isSubmitting && (
                    <svg className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  )}
                  <div className="absolute inset-0 translate-y-full bg-gradient-to-t from-white/10 to-transparent transition-transform group-hover:translate-y-0"></div>
                </button>
              )}
            </form>
          </div>
        </main>
      </div>
    </div>
  )
}

export default AdminChangePasswordPage
