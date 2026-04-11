import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import { createEmptyErrors, useFirstErrorFocus } from '../lib/formValidation'
import RequiredAsterisk from '../components/RequiredAsterisk'

export default function TechnicianResetPasswordPage({ theme, onToggleTheme }) {
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
      await apiRequest('/tech/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: password }),
      })
      setSuccess(true)
      setTimeout(() => navigate('/auth/technician/signin'), 3000)
    } catch (err) {
      setError(err?.message || 'Invalid or expired reset link. Please request a new one.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-[#030712] text-slate-100' : 'bg-slate-50 text-slate-900'} font-['Outfit',_sans-serif] transition-colors duration-500 relative flex items-center justify-center overflow-hidden`}>
      {/* Background Blurs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/5 dark:bg-indigo-600/15 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 w-full max-w-lg px-4">
        <header className="mb-10 flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-500/20">A</div>
            <h1 className="text-sm font-black tracking-widest text-[#0f172a] dark:text-white uppercase">Reset Password</h1>
          </div>
          <button onClick={onToggleTheme} className="w-10 h-10 rounded-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:scale-110 transition-all shadow-sm">
            {isDark ? '🌞' : '🌙'}
          </button>
        </header>

        <section className="rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-10 shadow-xl dark:shadow-2xl relative overflow-hidden group">
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/20 rotate-3 group-hover:rotate-0 transition-transform duration-500">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mb-1">Choose a new password</h2>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Set a new password for your technician account.</p>
              </div>
            </div>

            {success ? (
              <div className="mt-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center animate-in zoom-in-95">
                <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white mx-auto mb-4 shadow-xl shadow-emerald-500/20">
                   <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                   </svg>
                </div>
                <h3 className="text-lg font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tight mb-2">Password updated</h3>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest opacity-80">Going back to sign in in 3 seconds...</p>
              </div>
            ) : (
              <form className="grid gap-6" onSubmit={handleSubmit} noValidate>
                <div className="group/field relative">
                  <label htmlFor="password" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-blue-400/60 block mb-2 ml-1 transition-colors group-focus-within/field:text-blue-600">
                    New password
                    <RequiredAsterisk />
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      ref={registerField('password')}
                      type="password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setErrors((prev) => ({ ...prev, password: '', confirm: '' })) }}
                      onBlur={() => validateField('password')}
                      className={`w-full h-14 px-5 bg-slate-100/50 dark:bg-slate-900/50 rounded-2xl border transition-all duration-300 outline-none font-bold text-sm ${
                        errors.password ? 'border-red-500/50 bg-red-50/10' : 'border-slate-200 dark:border-slate-800 focus:border-blue-600 focus:bg-white dark:focus:bg-slate-800'
                      }`}
                      placeholder="Min 8 characters"
                      autoComplete="new-password"
                    />
                  </div>
                  {errors.password && (
                    <div className="absolute -bottom-5 left-1 text-[9px] font-black uppercase text-red-500 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                       <span>●</span> {errors.password}
                    </div>
                  )}
                </div>

                <div className="group/field relative">
                  <label htmlFor="confirm" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-blue-400/60 block mb-2 ml-1 transition-colors group-focus-within/field:text-blue-600">
                    Confirm password
                    <RequiredAsterisk />
                  </label>
                  <div className="relative">
                    <input
                      id="confirm"
                      ref={registerField('confirm')}
                      type="password"
                      value={confirm}
                      onChange={(e) => { setConfirm(e.target.value); setErrors((prev) => ({ ...prev, confirm: '' })) }}
                      onBlur={() => validateField('confirm')}
                      className={`w-full h-14 px-5 bg-slate-100/50 dark:bg-slate-900/50 rounded-2xl border transition-all duration-300 outline-none font-bold text-sm ${
                        errors.confirm ? 'border-red-500/50 bg-red-50/10' : 'border-slate-200 dark:border-slate-800 focus:border-blue-600 focus:bg-white dark:focus:bg-slate-800'
                      }`}
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                    />
                  </div>
                  {errors.confirm && (
                    <div className="absolute -bottom-5 left-1 text-[9px] font-black uppercase text-red-500 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                       <span>●</span> {errors.confirm}
                    </div>
                  )}
                </div>

                {error && (
                  <div className="mt-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-red-500 text-center animate-in zoom-in-95">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || !password || !confirm}
                  className="w-full h-16 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all relative overflow-hidden group/btn mt-2"
                >
                  <span className="relative z-10">{isSubmitting ? 'RESETTING...' : 'RESET PASSWORD'}</span>
                  <div className="absolute inset-0 bg-blue-600 dark:bg-blue-400 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500"></div>
                </button>
              </form>
            )}

            <div className="mt-8 text-center px-1">
              <Link to="/auth/technician/signin" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                 Back to sign in
              </Link>
            </div>
          </div>
          
          {/* Background Accent */}
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-indigo-600/5 rounded-full blur-[100px] pointer-events-none"></div>
        </section>
      </div>
    </div>
  )
}
