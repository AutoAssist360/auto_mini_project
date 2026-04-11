import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, vendorChangePassword } from '../lib/api'
import MobileNav from '../components/MobileNav'
import { useToast } from '../components/toastContext'
import { createEmptyErrors, useFirstErrorFocus } from '../lib/formValidation'
import RequiredAsterisk from '../components/RequiredAsterisk'

export default function VendorChangePasswordPage({ theme, onToggleTheme }) {
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
      await vendorChangePassword(form.current_password, form.new_password)
      setSuccess('Password changed successfully. You will be redirected to sign in again.')
      toast.success('Password changed successfully')
      setTimeout(() => navigate('/auth/vendor/signin'), 2500)
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

  const cardClass = 'rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md p-6 sm:p-8 shadow-xl dark:shadow-2xl relative overflow-hidden transition-all duration-300'
  const inputClass = 'w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F172A] px-4 py-3 text-sm font-medium outline-none transition-all focus:border-blue-500 focus:bg-white dark:focus:bg-[#0B1120] focus:ring-4 focus:ring-blue-500/10 dark:text-white'
  const labelClass = 'mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400'
  const errTxtClass = 'mt-1.5 text-[10px] font-bold text-red-500 uppercase tracking-widest'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 overflow-x-hidden relative transition-colors duration-500">
      {/* Background Blurs */}
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[30%] -right-[5%] w-[30%] h-[30%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Floating Header */}
        <header className="mb-8 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-6 py-3 shadow-xl dark:shadow-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">Change Password</span>
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
          </div>
          <MobileNav>
            <button type="button" onClick={() => navigate('/profile')} className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-600 dark:text-slate-300">
              ← Profile
            </button>
            <button type="button" onClick={onToggleTheme} className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm ml-2 text-slate-600 dark:text-slate-300">
              {theme === 'dark' ? '☀ Light' : '☾ Dark'}
            </button>
          </MobileNav>
        </header>

        <main className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <section className={cardClass}>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-2xl shadow-inner">
                🔒
              </div>
              <div>
                <h2 className="text-lg font-black uppercase tracking-widest text-slate-900 dark:text-white">Secure Your Account</h2>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">Enter your current password and choose a new one.</p>
              </div>
            </div>

            <form className="mt-8 grid gap-6" onSubmit={handleSubmit} noValidate>
              <div>
                <label htmlFor="current_password" className={labelClass}>Current Password<RequiredAsterisk /></label>
                <input id="current_password" ref={registerField('current_password')} type="password" value={form.current_password} onChange={handleChange('current_password')} onBlur={() => validateField('current_password')} className={inputClass} placeholder="Enter current password" />
                {errors.current_password && <p className={errTxtClass}>{errors.current_password}</p>}
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent my-2" />

              <div>
                <label htmlFor="new_password" className={labelClass}>New Password<RequiredAsterisk /></label>
                <input id="new_password" ref={registerField('new_password')} type="password" value={form.new_password} onChange={handleChange('new_password')} onBlur={() => validateField('new_password')} minLength={8} className={inputClass} placeholder="At least 8 characters" />
                {errors.new_password && <p className={errTxtClass}>{errors.new_password}</p>}
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className={labelClass}>Confirm New Password<RequiredAsterisk /></label>
                <input id="confirmPassword" ref={registerField('confirmPassword')} type="password" value={form.confirmPassword} onChange={handleChange('confirmPassword')} onBlur={() => validateField('confirmPassword')} minLength={8} className={inputClass} placeholder="Re-enter new password" />
                {errors.confirmPassword && <p className={errTxtClass}>{errors.confirmPassword}</p>}
              </div>

              {errors.form && (
                <div className="rounded-[24px] border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-3 shadow-sm mt-2">
                  <span className="text-xl">❌</span> {errors.form}
                </div>
              )}

              {success && (
                <div className="rounded-[24px] border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 p-4 text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center gap-3 shadow-sm mt-2 animate-pulse">
                  <span className="text-xl">✅</span> {success}
                </div>
              )}

              <button type="submit" disabled={isDisabled} className="mt-4 w-full rounded-[20px] bg-blue-600 py-4 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-[0.98]">
                {isSubmitting ? 'Changing Password...' : 'Change Password'}
              </button>
            </form>
          </section>
        </main>
      </div>
    </div>
  )
}
