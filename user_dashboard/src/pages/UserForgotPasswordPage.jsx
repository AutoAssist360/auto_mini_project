import { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import RequiredAsterisk from '../components/RequiredAsterisk'
import { EMAIL_REGEX, useFirstErrorFocus } from '../lib/formValidation'

export default function UserForgotPasswordPage({ theme, onToggleTheme }) {
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
    e.preventDefault(); setError('')
    const nextError = validateEmail()
    setFieldError(nextError)
    if (nextError) { focusFirst({ email: nextError }); return }

    setIsSubmitting(true)
    try {
      await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      })
      setSubmitted(true)
    } catch (err) { setError(err?.message || 'Could not send reset link') }
    finally { setIsSubmitting(false) }
  }

  return (
    <div className={`min-h-screen font-['Outfit',_sans-serif] selection:bg-blue-500/30 transition-colors duration-500 ${isDark ? 'dark bg-[#030712] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-16">
        
        <header className="mb-10 flex flex-wrap items-center justify-between gap-3 sm:mb-12">
            <Link to="/" className="group flex min-w-0 items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20 group-hover:scale-110 transition-transform">
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <span className="min-w-0 text-lg font-black tracking-tight uppercase sm:text-xl">Quick Auto Assist</span>
           </Link>
           <button onClick={onToggleTheme} className="h-10 w-10 shrink-0 rounded-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-800 flex items-center justify-center transition-all hover:bg-white dark:hover:bg-slate-800">
              {isDark ? '🌞' : '🌙'}
           </button>
        </header>

        <section className="relative overflow-hidden rounded-[40px] border border-slate-200 bg-white/70 p-6 shadow-2xl backdrop-blur-2xl group dark:border-slate-800 dark:bg-slate-900/40 sm:p-8 lg:p-12">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl rounded-full translate-x-12 -translate-y-12"></div>
          
          <div className="relative z-10">
            <h2 className="mb-2 text-2xl font-black leading-none tracking-tighter text-slate-900 uppercase dark:text-white sm:text-3xl">Reset Password</h2>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-10">
              {submitted ? 'Reset link sent' : 'Enter your email to get a reset link'}
            </p>

            {submitted ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-6 rounded-3xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
                  <div className="flex items-center gap-4 mb-4">
                     <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                     </div>
                     <span className="text-xs font-black uppercase tracking-widest italic">Check your inbox</span>
                  </div>
                  <p className="text-sm font-medium leading-relaxed">If an account exists for <span className="font-bold underline">{email}</span>, we have sent a reset link. The link expires in 15 minutes.</p>
                </div>
                
                <Link to="/auth/user/signin" className="flex h-14 w-full items-center justify-center whitespace-nowrap rounded-2xl bg-slate-900 text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-xl hover:scale-[1.02] active:scale-95 dark:bg-white dark:text-slate-900">
                  GO TO SIGN IN
                </Link>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit} noValidate>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Email address<RequiredAsterisk /></label>
                  <div className="relative group/input">
                    <input
                      id="email"
                      ref={registerField('email')}
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setFieldError(''); setError('') }}
                      onBlur={() => setFieldError(validateEmail())}
                      className="w-full h-14 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 text-[11px] font-bold outline-none focus:border-blue-500 transition-all"
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-700">
                       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" /></svg>
                    </div>
                  </div>
                  {fieldError && <p className="pl-2 text-[9px] font-black italic uppercase tracking-widest text-red-500 break-words">⚠️ {fieldError}</p>}
                </div>

                {error && (
                  <div className="break-words rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-[9px] font-black uppercase tracking-widest text-red-500 animate-in shake">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || !email.trim()}
                  className="h-14 w-full whitespace-nowrap rounded-2xl bg-blue-600 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all shadow-xl shadow-blue-600/20 hover:bg-blue-500 active:scale-95 disabled:opacity-30"
                >
                  {isSubmitting ? 'SENDING...' : 'SEND RESET LINK'}
                </button>
              </form>
            )}

            <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800 text-center">
              <Link to="/auth/user/signin" className="flex items-center justify-center gap-2 whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-blue-600">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7 7-7" /></svg>
                BACK TO SIGN IN
              </Link>
            </div>
          </div>
        </section>

        <footer className="mt-12 text-center text-[9px] font-black text-slate-300 dark:text-slate-800 uppercase tracking-[0.4em]">
           QUICK AUTO ASSIST
        </footer>
      </div>
    </div>
  )
}
