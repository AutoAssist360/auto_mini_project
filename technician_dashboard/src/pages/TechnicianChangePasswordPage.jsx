import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, technicianChangePassword } from '../lib/api'
import Breadcrumbs from '../components/Breadcrumbs'
import MobileNav from '../components/MobileNav'
import { useToast } from '../components/toastContext'
import { createEmptyErrors, useFirstErrorFocus } from '../lib/formValidation'
import RequiredAsterisk from '../components/RequiredAsterisk'

export default function TechnicianChangePasswordPage({ theme, onToggleTheme }) {
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
      await technicianChangePassword(form.current_password, form.new_password)
      setSuccess('Password changed successfully. You will be redirected to sign in again.')
      toast.success('Password changed successfully')
      setTimeout(() => navigate('/auth/technician/signin'), 2500)
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
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-[#030712] text-slate-100' : 'bg-slate-50 text-slate-900'} font-['Outfit',_sans-serif] transition-colors duration-500 relative overflow-x-hidden`}>
      {/* Background Blurs */}
      <div className="fixed top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/5 dark:bg-indigo-600/15 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Floating Header */}
        <header className="mb-12 rounded-[32px] sm:rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-6 py-3 shadow-xl dark:shadow-2xl flex flex-wrap gap-4 items-center justify-between transition-all sticky top-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">Security settings</h1>
          </div>

          <div className="flex items-center gap-4 ml-auto">
             <button onClick={onToggleTheme} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm">
                {theme === 'dark' ? '🌞' : '🌙'}
             </button>
          </div>
        </header>

        <main className="mt-20 mx-auto max-w-lg">
          <section className="rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-10 shadow-xl dark:shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-2xl shadow-blue-500/20 rotate-3 group-hover:rotate-0 transition-transform duration-500">
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mb-1">Change password</h2>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Change the password for your technician account.</p>
                </div>
              </div>

              <form className="grid gap-6" onSubmit={handleSubmit} noValidate>
                {[
                  { id: 'current_password', label: 'Current password', icon: '🔑', placeholder: 'Enter your current password' },
                  { id: 'new_password', label: 'New password', icon: '✨', placeholder: 'Minimum 8 characters' },
                  { id: 'confirmPassword', label: 'Confirm new password', icon: '✅', placeholder: 'Re-enter your new password' }
                ].map((field) => (
                  <div key={field.id} className="group/field relative">
                    <label htmlFor={field.id} className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-blue-400/60 block mb-2 ml-1 transition-colors group-focus-within/field:text-blue-600">
                      {field.label}
                      <RequiredAsterisk />
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 pointer-events-none group-focus-within/field:text-blue-500 transition-colors">
                        {field.icon}
                      </div>
                      <input
                        id={field.id}
                        ref={registerField(field.id)}
                        type="password"
                        value={form[field.id]}
                        onChange={handleChange(field.id)}
                        onBlur={() => validateField(field.id)}
                        className={`w-full h-14 pl-12 pr-4 bg-slate-100/50 dark:bg-slate-900/50 rounded-2xl border transition-all duration-300 outline-none font-bold text-sm ${
                          errors[field.id] 
                            ? 'border-red-500/50 bg-red-50/10' 
                            : 'border-slate-200 dark:border-slate-800 group-hover/field:border-blue-500/30 focus:border-blue-600 focus:bg-white dark:focus:bg-slate-800'
                        }`}
                        placeholder={field.placeholder}
                      />
                    </div>
                    {errors[field.id] && (
                      <div className="absolute -bottom-5 left-1 text-[9px] font-black uppercase text-red-500 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                         <span>●</span> {errors[field.id]}
                      </div>
                    )}
                  </div>
                ))}

                <div className="mt-4 space-y-3">
                  {errors.form && (
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-red-500 text-center animate-in zoom-in-95">
                      {errors.form}
                    </div>
                  )}

                  {success && (
                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 text-center animate-pulse">
                      {success}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isDisabled}
                    className="w-full h-16 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all relative overflow-hidden group/btn"
                  >
                    <span className="relative z-10">{isSubmitting ? 'Saving...' : 'Save password'}</span>
                    <div className="absolute inset-0 bg-blue-600 dark:bg-blue-400 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500"></div>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="w-full py-4 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    Cancel and go back
                  </button>
                </div>
              </form>
            </div>
            
            {/* Background Accent */}
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full blur-[100px] pointer-events-none"></div>
          </section>
        </main>
      </div>
    </div>
  )
}
