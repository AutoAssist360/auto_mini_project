import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, apiRequest } from '../lib/api'
import Breadcrumbs from '../components/Breadcrumbs'
import MobileNav from '../components/MobileNav'
import RequiredAsterisk from '../components/RequiredAsterisk'
import { useToast } from '../components/toastContext'
import { createEmptyErrors, useFirstErrorFocus } from '../lib/formValidation'

export default function UserChangePasswordPage({ theme, onToggleTheme }) {
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
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: form.current_password, new_password: form.new_password }),
      })
      setSuccess('Password changed successfully. You will be redirected to sign in again.')
      toast.success('Password changed successfully')
      setTimeout(() => navigate('/auth/user/signin'), 2500)
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

  const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900'
  const inputClass = 'w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <header className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold">Change Password</h1>
            <MobileNav>
              <button type="button" onClick={onToggleTheme} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
            </MobileNav>
          </div>
        </header>

        <Breadcrumbs items={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Change Password' },
        ]} />

        <main className="mt-5 mx-auto max-w-lg">
          <section className={card}>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Enter your current password and choose a new one. You will be signed out after the change.
            </p>

            <form className="mt-5 grid gap-4" onSubmit={handleSubmit} noValidate>
              <div>
                <label htmlFor="current_password" className="mb-1 block text-sm font-medium">Current Password<RequiredAsterisk /></label>
                <input id="current_password" ref={registerField('current_password')} type="password" value={form.current_password} onChange={handleChange('current_password')} onBlur={() => validateField('current_password')} className={inputClass} placeholder="Enter current password" />
                {errors.current_password && <p className="mt-1 text-xs text-red-600">{errors.current_password}</p>}
              </div>
              <div>
                <label htmlFor="new_password" className="mb-1 block text-sm font-medium">New Password<RequiredAsterisk /></label>
                <input id="new_password" ref={registerField('new_password')} type="password" value={form.new_password} onChange={handleChange('new_password')} onBlur={() => validateField('new_password')} minLength={8} className={inputClass} placeholder="At least 8 characters" />
                {errors.new_password && <p className="mt-1 text-xs text-red-600">{errors.new_password}</p>}
              </div>
              <div>
                <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium">Confirm New Password<RequiredAsterisk /></label>
                <input id="confirmPassword" ref={registerField('confirmPassword')} type="password" value={form.confirmPassword} onChange={handleChange('confirmPassword')} onBlur={() => validateField('confirmPassword')} minLength={8} className={inputClass} placeholder="Re-enter new password" />
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>}
              </div>

              {errors.form && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                  {errors.form}
                </div>
              )}

              {success && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300">
                  {success}
                </div>
              )}

              <button type="submit" disabled={isDisabled} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
                {isSubmitting ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </section>
        </main>
      </div>
    </div>
  )
}
