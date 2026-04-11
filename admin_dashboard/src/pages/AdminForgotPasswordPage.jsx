import { useState } from 'react'
import { Link } from 'react-router-dom'
import { adminForgotPassword, ApiError } from '../lib/api'
import { EMAIL_REGEX, useFirstErrorFocus } from '../lib/formValidation'
import RequiredAsterisk from '../components/RequiredAsterisk'

export default function AdminForgotPasswordPage({ theme, onToggleTheme }) {
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
      await adminForgotPassword(email.trim())
      setSubmitted(true)
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError('Something went wrong. Please try again.')
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
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
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 dark:text-blue-400">Password help</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-[#0f172a] dark:text-white uppercase leading-none">Lost Access?</h2>
            <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-loose">Enter your email to get a reset link</p>
          </div>

          {submitted ? (
            <div className="rounded-[24px] border border-blue-200 bg-blue-50/50 p-6 text-center backdrop-blur-md dark:border-blue-900/30 dark:bg-blue-900/10">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-black text-blue-900 dark:text-blue-100 uppercase tracking-tight">Email sent</h3>
              <p className="mt-2 text-xs font-medium text-blue-700/70 dark:text-blue-400/70 leading-relaxed">
                If an account exists, we sent a reset link to your email. Check your inbox.
              </p>
              <Link to="/admin/login" className="mt-6 inline-block text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-500 transition-colors dark:text-blue-400">
                Back to Authentication
              </Link>
            </div>
          ) : (
            <form className="grid gap-6" onSubmit={handleSubmit} noValidate>
              <div className="space-y-2">
                <label htmlFor="email" className="block px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Admin Email<RequiredAsterisk /></label>
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
                  className="w-full rounded-[20px] bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 px-5 py-4 text-sm font-bold outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-inner"
                  placeholder="admin@terminal.com"
                  autoComplete="email"
                />
                {fieldError && <p className="px-1 text-[10px] font-bold text-red-500 uppercase tracking-wider">{fieldError}</p>}
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50/50 px-4 py-3 text-[10px] font-bold text-red-600 uppercase tracking-wider dark:border-red-900/30 dark:bg-red-900/10">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !email.trim()}
                className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-[20px] bg-blue-600 px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-blue-500/25 transition-all hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:shadow-none active:scale-[0.98]"
              >
                <span className="relative z-10">{isSubmitting ? 'Processing...' : 'Send reset link'}</span>
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
          Admin Portal &copy; {new Date().getFullYear()} Password Help
        </p>
      </div>
    </div>
  )
}
