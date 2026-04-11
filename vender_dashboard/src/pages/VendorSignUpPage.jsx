import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, vendorSendOtp, vendorSignUp } from '../lib/api'
import {
  createEmptyErrors,
  EMAIL_REGEX,
  PHONE_REGEX,
  UPI_REGEX,
  sanitizeDigits,
  useFirstErrorFocus,
} from '../lib/formValidation'
import RequiredAsterisk from '../components/RequiredAsterisk'

function VendorSignUpPage({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const fieldOrder = ['full_name', 'email', 'phone_number', 'upi_id', 'password', 'confirmPassword']
  const { registerField, focusFirst } = useFirstErrorFocus(fieldOrder)
  const { registerField: registerOtpField, focusFirst: focusOtp } = useFirstErrorFocus(['otp'])

  const [step, setStep] = useState('form')
  const [otpToken, setOtpToken] = useState('')
  const [otp, setOtp] = useState('')
  const [otpCountdown, setOtpCountdown] = useState(0)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    upi_id: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState({ ...createEmptyErrors(fieldOrder), otp: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isDisabled = useMemo(() => {
    if (step === 'form') {
      return isSubmitting || !form.full_name || !form.email || !form.phone_number || !form.upi_id || !form.password || !form.confirmPassword
    }

    return isSubmitting || otp.length !== 6
  }, [form, isSubmitting, otp.length, step])

  const handleChange = (field) => (event) => {
    const rawValue = event.target.value
    const value = field === 'phone_number' ? sanitizeDigits(rawValue, 10) : rawValue
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: '', form: '' }))
  }

  const getErrors = (values = form) => {
    const nextErrors = { ...createEmptyErrors(fieldOrder), otp: '' }

    if (!values.full_name.trim()) nextErrors.full_name = 'Full name is required'
    if (!values.email.trim()) nextErrors.email = 'Email is required'
    else if (!EMAIL_REGEX.test(values.email.trim())) nextErrors.email = 'Enter a valid email address'
    if (!values.phone_number) nextErrors.phone_number = 'Phone number is required'
    else if (!PHONE_REGEX.test(values.phone_number)) nextErrors.phone_number = 'Phone number must be exactly 10 digits'
    if (!values.upi_id.trim()) nextErrors.upi_id = 'UPI ID is required'
    else if (!UPI_REGEX.test(values.upi_id.trim())) nextErrors.upi_id = 'Enter a valid UPI ID'
    if (!values.password) nextErrors.password = 'Password is required'
    else if (values.password.length < 8) nextErrors.password = 'Password must be at least 8 characters'
    if (!values.confirmPassword) nextErrors.confirmPassword = 'Please confirm your password'
    else if (values.password !== values.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match'

    return nextErrors
  }

  const validateField = (field, values = form) => {
    const nextErrors = getErrors(values)
    setErrors((prev) => ({ ...prev, [field]: nextErrors[field], form: '' }))
  }

  const validateForm = () => {
    const nextErrors = getErrors(form)
    setErrors(nextErrors)
    const isValid = !fieldOrder.some((field) => nextErrors[field])
    if (!isValid) focusFirst(nextErrors)
    return isValid
  }

  const startCooldown = useCallback(() => {
    setOtpCountdown(60)
    const intervalId = setInterval(() => {
      setOtpCountdown((current) => {
        if (current <= 1) {
          clearInterval(intervalId)
          return 0
        }
        return current - 1
      })
    }, 1000)
  }, [])

  const handleSendOtp = async (event) => {
    event.preventDefault()
    if (!validateForm()) return

    setIsSubmitting(true)
    setErrors((prev) => ({ ...prev, form: '', otp: '' }))

    try {
      const response = await vendorSendOtp(form.email.trim())
      setOtpToken(response.otp_token)
      setOtp('')
      setStep('otp')
      startCooldown()
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        form: error instanceof ApiError ? error.message : 'Unable to send the verification code. Please try again.',
      }))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResendOtp = async () => {
    if (otpCountdown > 0) return

    setIsSubmitting(true)
    setErrors((prev) => ({ ...prev, form: '', otp: '' }))

    try {
      const response = await vendorSendOtp(form.email.trim())
      setOtpToken(response.otp_token)
      setOtp('')
      startCooldown()
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        form: error instanceof ApiError ? error.message : 'Unable to resend the verification code. Please try again.',
      }))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerifyAndCreate = async (event) => {
    event.preventDefault()

    if (otp.length !== 6) {
      const nextErrors = { otp: 'Enter the 6-digit code' }
      setErrors((prev) => ({ ...prev, otp: nextErrors.otp, form: '' }))
      focusOtp(nextErrors)
      return
    }

    setIsSubmitting(true)
    setErrors((prev) => ({ ...prev, form: '', otp: '' }))

    try {
      await vendorSignUp({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone_number: form.phone_number,
        upi_id: form.upi_id.trim(),
        password: form.password,
        otp_token: otpToken,
        otp,
      })

      navigate('/auth/vendor/signin', {
        replace: true,
        state: { signupSuccess: 'Your account is ready. Please sign in.' },
      })
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        form: error instanceof ApiError ? error.message : 'Unable to create account. Please try again.',
      }))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-slate-50 py-8 text-slate-900 transition-colors duration-500 dark:bg-[#030712] dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 sm:px-6 lg:px-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="absolute top-4 right-4 z-20">
        <button type="button" onClick={onToggleTheme} className="flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white/50 px-3 text-[11px] font-black backdrop-blur-md transition-all hover:bg-white dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800 shadow-sm">
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>

      <div className="relative z-10 w-full max-w-2xl px-4 sm:mx-auto sm:w-full">
        <div className="mb-8 flex items-center justify-between gap-4">
          <a href={import.meta.env.VITE_LANDING_APP_URL || 'http://localhost:5173'} className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 transition-colors hover:text-blue-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back To Home
          </a>
        </div>
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl shadow-blue-500/30 mb-6 group hover:scale-105 transition-transform duration-500">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase mb-2">
            Vendor <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{step === 'form' ? 'Sign Up' : 'Verify Email'}</span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {step === 'form'
              ? 'Create your vendor account to manage your items, orders, and payments.'
              : `Enter the 6-digit code sent to ${form.email} to finish creating your account.`}
          </p>
        </div>

        <div className="bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl py-10 px-6 shadow-2xl rounded-[40px] border border-white/20 dark:border-slate-800/50 sm:px-12 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.03),transparent)] pointer-events-none"></div>

          {errors.form && (
            <div className="mb-6 rounded-2xl border border-red-200/50 bg-red-50/50 dark:bg-red-500/10 dark:border-red-500/20 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-3 backdrop-blur-sm relative z-10">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {errors.form}
            </div>
          )}

          {step === 'form' ? (
            <form className="grid gap-6 relative z-10" onSubmit={handleSendOtp} noValidate>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="full_name" className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 ml-1">Business or owner name<RequiredAsterisk /></label>
                  <input id="full_name" ref={registerField('full_name')} value={form.full_name} onChange={handleChange('full_name')} onBlur={() => validateField('full_name')} className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F172A] px-4 py-4 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-900 dark:text-white font-medium" placeholder="AutoParts Pro" />
                  {errors.full_name && <p className="mt-2 text-[11px] font-bold text-red-500 ml-1">{errors.full_name}</p>}
                </div>

                <div>
                  <label htmlFor="email" className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 ml-1">Email address<RequiredAsterisk /></label>
                  <input id="email" ref={registerField('email')} type="email" value={form.email} onChange={handleChange('email')} onBlur={() => validateField('email')} className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F172A] px-4 py-4 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-900 dark:text-white font-medium" placeholder="vendor@example.com" />
                  {errors.email && <p className="mt-2 text-[11px] font-bold text-red-500 ml-1">{errors.email}</p>}
                </div>

                <div>
                  <label htmlFor="phone_number" className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 ml-1">Contact Number<RequiredAsterisk /></label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 font-bold text-sm">+91</span>
                    <input id="phone_number" ref={registerField('phone_number')} value={form.phone_number} onChange={handleChange('phone_number')} onBlur={() => validateField('phone_number')} inputMode="numeric" maxLength={10} className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F172A] pl-12 pr-4 py-4 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-900 dark:text-white font-medium" placeholder="10-digit phone number" />
                  </div>
                  {errors.phone_number && <p className="mt-2 text-[11px] font-bold text-red-500 ml-1">{errors.phone_number}</p>}
                </div>

                <div>
                  <label htmlFor="upi_id" className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 ml-1">UPI ID to receive payments<RequiredAsterisk /></label>
                  <input id="upi_id" ref={registerField('upi_id')} value={form.upi_id} onChange={handleChange('upi_id')} onBlur={() => validateField('upi_id')} maxLength={100} className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F172A] px-4 py-4 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-900 dark:text-white font-medium" placeholder="business@upi" />
                  {errors.upi_id && <p className="mt-2 text-[11px] font-bold text-red-500 ml-1">{errors.upi_id}</p>}
                </div>

                <div>
                  <label htmlFor="password" className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 ml-1">Password<RequiredAsterisk /></label>
                  <input id="password" ref={registerField('password')} type="password" value={form.password} onChange={handleChange('password')} onBlur={() => validateField('password')} minLength={8} className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F172A] px-4 py-4 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-900 dark:text-white font-medium" placeholder="Enter your password" />
                  {errors.password && <p className="mt-2 text-[11px] font-bold text-red-500 ml-1">{errors.password}</p>}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 ml-1">Confirm Password<RequiredAsterisk /></label>
                  <input id="confirmPassword" ref={registerField('confirmPassword')} type="password" value={form.confirmPassword} onChange={handleChange('confirmPassword')} onBlur={() => validateField('confirmPassword')} minLength={8} className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F172A] px-4 py-4 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-900 dark:text-white font-medium" placeholder="Enter your password" />
                  {errors.confirmPassword && <p className="mt-2 text-[11px] font-bold text-red-500 ml-1">{errors.confirmPassword}</p>}
                </div>
              </div>

              <button type="submit" disabled={isDisabled} className="mt-4 w-full h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[11px] font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-blue-500/25 flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed">
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Sending code...</span>
                  </>
                ) : (
                  'Send verification code'
                )}
              </button>

              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2 text-sm font-medium">
                <span className="text-slate-500 dark:text-slate-400">Already have an account?</span>
                <Link to="/auth/vendor/signin" className="text-blue-600 dark:text-blue-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors uppercase font-black tracking-widest text-[11px]">
                  Sign In
                </Link>
              </div>
            </form>
          ) : (
            <form className="grid gap-6 relative z-10" onSubmit={handleVerifyAndCreate} noValidate>
              <div className="rounded-3xl border border-blue-500/10 bg-blue-50/80 px-5 py-4 dark:border-blue-500/20 dark:bg-blue-500/10">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-600 dark:text-blue-400">Verification required</p>
                <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                  Enter the 6-digit code sent to <span className="font-black text-slate-900 dark:text-white">{form.email}</span>.
                </p>
              </div>

              <div>
                <label htmlFor="otp" className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 ml-1">Verification Code<RequiredAsterisk /></label>
                <input
                  id="otp"
                  ref={registerOtpField('otp')}
                  value={otp}
                  onChange={(event) => {
                    const nextValue = sanitizeDigits(event.target.value, 6)
                    setOtp(nextValue)
                    setErrors((prev) => ({ ...prev, otp: '', form: '' }))
                  }}
                  onBlur={() => {
                    if (otp.length !== 6) {
                      setErrors((prev) => ({ ...prev, otp: 'Enter the 6-digit code' }))
                    }
                  }}
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  className="w-full rounded-[28px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F172A] px-4 py-5 text-center text-2xl font-black tracking-[0.45em] outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-900 dark:text-white font-mono"
                  placeholder="000000"
                />
                {errors.otp && <p className="mt-2 text-[11px] font-bold text-red-500 ml-1">{errors.otp}</p>}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setStep('form')
                    setOtp('')
                    setOtpToken('')
                    setOtpCountdown(0)
                    setErrors((prev) => ({ ...prev, otp: '', form: '' }))
                  }}
                  className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-colors"
                >
                  Edit details
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={otpCountdown > 0 || isSubmitting}
                  className="text-[10px] font-black uppercase tracking-widest text-blue-600 disabled:opacity-40"
                >
                  {otpCountdown > 0 ? `Send again in ${otpCountdown}s` : 'Send code again'}
                </button>
              </div>

              <button type="submit" disabled={isDisabled} className="mt-2 w-full h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[11px] font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-blue-500/25 flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed">
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Creating account...</span>
                  </>
                ) : (
                  'Verify and create account'
                )}
              </button>

              <div className="mt-2 flex flex-col sm:flex-row items-center justify-center gap-2 text-sm font-medium">
                <span className="text-slate-500 dark:text-slate-400">Already have an account?</span>
                <Link to="/auth/vendor/signin" className="text-blue-600 dark:text-blue-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors uppercase font-black tracking-widest text-[11px]">
                  Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default VendorSignUpPage
