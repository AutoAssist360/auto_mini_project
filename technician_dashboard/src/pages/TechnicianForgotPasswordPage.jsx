import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import { EMAIL_REGEX, useFirstErrorFocus } from '../lib/formValidation'
import RequiredAsterisk from '../components/RequiredAsterisk'

export default function TechnicianForgotPasswordPage({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const { registerField, focusFirst } = useFirstErrorFocus(['email'])
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isDark = theme === 'dark'

  const validateEmail = (value = email) => {
    const trimmedEmail = value.trim()
    if (!trimmedEmail) return 'Email is required'
    if (!EMAIL_REGEX.test(trimmedEmail)) return 'Enter a valid email address'
    return ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const nextError = validateEmail()
    setFieldError(nextError)
    if (nextError) {
      focusFirst({ email: nextError })
      return
    }

    setIsSubmitting(true)
    try {
      await apiRequest('/tech/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      })
      setSubmitted(true)
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-[#030712] text-slate-100' : 'bg-slate-50 text-slate-900'} font-['Outfit',_sans-serif] transition-colors duration-500 relative overflow-hidden flex flex-col`}>
      {/* Background Blurs */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] -left-[10%] w-[50%] h-[50%] bg-blue-600/10 dark:bg-blue-600/15 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-indigo-600/10 dark:bg-indigo-600/15 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">
        <header className="absolute top-8 left-0 w-full px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white text-lg font-black shadow-lg shadow-blue-500/30">Q</div>
            <h1 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">Quick Auto Assist</h1>
          </div>
          <button onClick={onToggleTheme} className="w-10 h-10 rounded-2xl bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 backdrop-blur-sm flex items-center justify-center text-sm transition-all shadow-sm">
            {isDark ? '🌞' : '🌙'}
          </button>
        </header>

        <section className="w-full max-w-md rounded-[40px] border border-white/40 dark:border-slate-800/60 bg-white/60 dark:bg-[#0F172A]/80 backdrop-blur-xl p-8 sm:p-10 shadow-2xl relative overflow-hidden transition-all hover:shadow-blue-500/5 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          
          <div className="w-16 h-16 rounded-3xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-3xl mb-6 shadow-inner">🔑</div>
          
          <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Reset Password</h2>
          <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
            Enter your technician account email below and we will send a reset link to your inbox.
          </p>

          {submitted ? (
            <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5 text-center">
                <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Reset link sent</p>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">If an account exists for {email}, you'll receive a link shortly. Valid for 15 minutes.</p>
              </div>
              <Link to="/auth/technician/signin" className="w-full h-14 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center transition-all shadow-lg">
                BACK TO SIGN IN
              </Link>
            </div>
          ) : (
            <form className="mt-8 grid gap-6" onSubmit={handleSubmit} noValidate>
              <div className="space-y-2">
                <label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                  Account Email
                  <RequiredAsterisk />
                </label>
                <input
                  id="email"
                  ref={registerField('email')}
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setFieldError('')
                    setError('')
                  }}
                  onBlur={() => setFieldError(validateEmail())}
                  className="w-full h-14 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl px-5 text-sm font-medium outline-none focus:border-blue-500 dark:focus:border-blue-500/50 transition-all placeholder:text-slate-400"
                  placeholder="name@company.com"
                  autoComplete="email"
                />
                {fieldError && <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight ml-1">{fieldError}</p>}
              </div>

              {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-[10px] font-bold text-red-500 uppercase tracking-widest text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !email.trim()}
                className="w-full h-14 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 transition-all shadow-xl shadow-slate-900/10 dark:shadow-white/5 mt-2"
              >
                {isSubmitting ? 'SENDING...' : 'SEND RESET LINK'}
              </button>
            </form>
          )}

          <div className="mt-8 pt-8 border-t border-slate-200/50 dark:border-slate-800/50 text-center">
            <Link to="/auth/technician/signin" className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Back to sign in
            </Link>
          </div>
        </section>

        <footer className="mt-12 text-center opacity-40">
           <p className="text-[10px] font-black uppercase tracking-[0.4em]">Quick Auto Assist</p>
        </footer>
      </div>
    </div>
  )
}
