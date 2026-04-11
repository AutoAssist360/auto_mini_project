import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import { createEmptyErrors, useFirstErrorFocus } from '../lib/formValidation'
import RequiredAsterisk from '../components/RequiredAsterisk'

export default function VendorResetPasswordPage({ theme, onToggleTheme }) {
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
      await apiRequest('/vendor/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: password }),
      })
      setSuccess(true)
      setTimeout(() => navigate('/auth/vendor/signin'), 3000)
    } catch (err) {
      setError(err?.message || 'Invalid or expired reset link. Please request a new one.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-[#030712]' : 'bg-slate-50'} text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 overflow-hidden relative transition-colors duration-500 flex flex-col items-center justify-center p-6`}>
      {/* Background Ambient Blurs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] -left-[10%] w-[50%] h-[50%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-10%] -right-[10%] w-[50%] h-[50%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full animate-pulse delay-700"></div>
      </div>

      <div className="relative z-10 w-full max-w-lg">
        <header className="mb-12 flex flex-col items-center justify-center gap-6 animate-in slide-in-from-top-10 duration-700">
           <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-blue-600/10 text-4xl shadow-inner border border-blue-500/20">🔑</div>
           <div className="text-center">
             <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">
               Quick Auto Assist
             </h1>
             <p className="mt-2 text-[10px] font-black uppercase tracking-[0.3em] text-blue-500">Reset password</p>
           </div>
           
           <button onClick={onToggleTheme} className="rounded-full border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 px-5 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95 text-slate-500 dark:text-slate-400">
             {isDark ? '☀ Light Mode' : '☾ Dark Mode'}
           </button>
        </header>

        <section className="rounded-[40px] border border-white/20 bg-white/70 p-10 shadow-2xl backdrop-blur-2xl dark:bg-[#0B1120]/80 animate-in zoom-in-95 duration-500">
          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Reset Password</h2>
            <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">Ensure your new password contains at least 8 characters.</p>
          </div>

          {success ? (
            <div className="mt-6 rounded-[24px] border border-blue-200 bg-blue-50/50 p-6 shadow-inner dark:border-blue-900/30 dark:bg-blue-900/10 animate-in fade-in duration-500">
               <div className="flex items-center gap-3 mb-2">
                 <span className="text-2xl">✅</span>
                 <p className="text-sm font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 underline decoration-2 underline-offset-4">Password updated</p>
               </div>
               <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">Your password has been changed. Redirecting to sign in...</p>
            </div>
          ) : (
            <form className="grid gap-6" onSubmit={handleSubmit} noValidate>
              <div className="space-y-2">
                <label htmlFor="password" className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
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
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0F172A]/50 px-4 py-4 text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all backdrop-blur-sm shadow-inner dark:text-white" 
                    placeholder="Min 8 characters" 
                    autoComplete="new-password" 
                  />
                  {errors.password && (
                    <p className="mt-2 ml-1 text-[10px] font-black uppercase tracking-widest text-red-500 animate-in slide-in-from-left-2">
                      <span className="mr-1">⚠</span> {errors.password}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm" className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
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
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0F172A]/50 px-4 py-4 text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all backdrop-blur-sm shadow-inner dark:text-white" 
                    placeholder="Enter the same password again" 
                    autoComplete="new-password" 
                  />
                  {errors.confirm && (
                    <p className="mt-2 ml-1 text-[10px] font-black uppercase tracking-widest text-red-500 animate-in slide-in-from-left-2">
                      <span className="mr-1">⚠</span> {errors.confirm}
                    </p>
                  )}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-3 rounded-[24px] border border-red-200 bg-red-50/50 px-5 py-4 text-sm font-bold text-red-600 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400 shadow-sm animate-in shake-in duration-300">
                  <span className="text-xl">❌</span> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !password || !confirm}
                className="mt-2 rounded-2xl bg-blue-600 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-blue-500/30 hover:bg-blue-500 hover:shadow-blue-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 transition-all"
              >
                {isSubmitting ? 'UPDATING...' : 'RESET PASSWORD'}
              </button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/60 text-center">
            <Link to="/auth/vendor/signin" className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-500 dark:text-blue-400 group flex items-center justify-center gap-2 transition-all">
              <span className="transition-transform group-hover:-translate-x-1">←</span> BACK TO SIGN IN
            </Link>
          </div>
        </section>

        <footer className="mt-12 text-center opacity-40 animate-in fade-in duration-1000">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">QUICK AUTO ASSIST</p>
        </footer>
      </div>
    </div>
  )
}
