import { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import { EMAIL_REGEX, useFirstErrorFocus } from '../lib/formValidation'
import RequiredAsterisk from '../components/RequiredAsterisk'

export default function VendorForgotPasswordPage({ theme, onToggleTheme }) {
  const { registerField, focusFirst } = useFirstErrorFocus(['email'])
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      await apiRequest('/vendor/auth/forgot-password', {
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 overflow-x-hidden transition-colors duration-500 relative flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
      {/* Background Blurs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="absolute top-4 right-4 z-20">
        <button type="button" onClick={onToggleTheme} className="w-10 h-10 rounded-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm">
          {theme === 'dark' ? '🌞' : '🌙'}
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl shadow-blue-500/30 mb-6 group hover:scale-105 transition-transform duration-500">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase mb-2">
          Forgot <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Password</span>
        </h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm max-w-sm mx-auto">
          Enter your email address and we will send you a reset link.
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 w-full px-4">
        <div className="bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl py-10 px-8 shadow-2xl rounded-[32px] border border-white/20 dark:border-slate-800/50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.03),transparent)] pointer-events-none"></div>

          {submitted ? (
            <div className="relative z-10 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-6">
                 <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                 </svg>
              </div>
              <h3 className="text-lg font-black uppercase tracking-widest text-slate-900 dark:text-white mb-2">Check your email</h3>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mb-8">
                If an account with that email exists, a password reset link has been sent. It expires in 15 minutes.
              </p>
              <Link to="/auth/vendor/signin" className="w-full h-12 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form className="grid gap-6 relative z-10" onSubmit={handleSubmit} noValidate>
              <div>
                <label htmlFor="email" className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 ml-1">
                  Email address
                  <RequiredAsterisk />
                </label>
                <div className="relative group/input">
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
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F172A] px-4 py-4 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-900 dark:text-white font-medium"
                    placeholder="vendor@example.com"
                    autoComplete="email"
                  />
                </div>
                {fieldError && <p className="mt-2 text-[11px] font-bold text-red-500 ml-1">{fieldError}</p>}
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200/50 bg-red-50/50 dark:bg-red-500/10 dark:border-red-500/20 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-3 backdrop-blur-sm">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !email.trim()}
                className="mt-2 w-full h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[11px] font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-blue-500/25 flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>SENDING...</span>
                  </>
                ) : (
                  'Send reset link'
                )}
              </button>
              
              <div className="mt-2 text-center text-sm font-medium">
                <Link to="/auth/vendor/signin" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors uppercase font-black tracking-widest text-[10px]">
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
