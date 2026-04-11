import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, technicianSendOtp, technicianSignUp } from '../lib/api'
import LocationPicker from '../components/LocationPicker'
import {
  createEmptyErrors,
  EMAIL_REGEX,
  PHONE_REGEX,
  sanitizeDigits,
  useFirstErrorFocus,
} from '../lib/formValidation'
import RequiredAsterisk from '../components/RequiredAsterisk'

function TechnicianSignUpPage({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const fieldOrder = ['full_name', 'email', 'phone_number', 'password', 'confirmPassword', 'technician_type', 'latitude', 'longitude', 'service_radius']
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
    password: '',
    confirmPassword: '',
    business_name: '',
    technician_type: 'individual',
    location: '',
    latitude: '',
    longitude: '',
    service_radius: '',
  })
  const [errors, setErrors] = useState({ ...createEmptyErrors(fieldOrder), otp: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isDisabled = useMemo(() => {
    if (step === 'form') {
      return (
        isSubmitting ||
        !form.full_name ||
        !form.email ||
        !form.phone_number ||
        !form.password ||
        !form.confirmPassword ||
        !form.technician_type ||
        form.latitude === '' ||
        form.longitude === '' ||
        !form.service_radius
      )
    }

    return isSubmitting || otp.length !== 6
  }, [form, isSubmitting, otp.length, step])

  const handleChange = (field) => (event) => {
    const rawValue = event.target.value
    let value = rawValue

    if (field === 'phone_number') value = sanitizeDigits(rawValue, 10)
    if (field === 'service_radius') value = sanitizeDigits(rawValue, 3)

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
    if (!values.password) nextErrors.password = 'Password is required'
    else if (values.password.length < 8) nextErrors.password = 'Password must be at least 8 characters'
    if (!values.confirmPassword) nextErrors.confirmPassword = 'Please confirm your password'
    else if (values.password !== values.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match'
    if (!['individual', 'garage'].includes(values.technician_type)) nextErrors.technician_type = 'Select a valid technician type'

    const latitude = Number(values.latitude)
    const longitude = Number(values.longitude)
    const serviceRadius = Number(values.service_radius)

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) nextErrors.latitude = 'Please pick your location on the map'
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) nextErrors.longitude = 'Please pick your location on the map'
    if (!Number.isInteger(serviceRadius) || serviceRadius <= 0) nextErrors.service_radius = 'Service radius must be a positive integer'

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
      const response = await technicianSendOtp(form.email.trim())
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
      const response = await technicianSendOtp(form.email.trim())
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
      await technicianSignUp({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone_number: form.phone_number,
        password: form.password,
        business_name: form.business_name.trim() || undefined,
        technician_type: form.technician_type,
        location: form.location?.trim() || `${Number(form.latitude).toFixed(5)}, ${Number(form.longitude).toFixed(5)}`,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        service_radius: Number(form.service_radius),
        otp_token: otpToken,
        otp,
      })

      navigate('/auth/technician/signin', {
        replace: true,
        state: { signupSuccess: 'Technician account created successfully. Please sign in.' },
      })
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        form: error instanceof ApiError
          ? error.message
          : 'Unable to create account. Please try again.',
      }))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] transition-colors duration-500 relative overflow-hidden">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[5%] -left-[10%] w-[50%] h-[50%] bg-blue-600/10 dark:bg-blue-600/15 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[5%] -right-[10%] w-[50%] h-[50%] bg-indigo-600/10 dark:bg-indigo-600/15 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4 rounded-[32px] border border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-8 py-4 shadow-xl shadow-slate-200/50 dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-blue-500/30">Q</div>
            <div>
              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest leading-none">Technician Hub</span>
              <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mt-0.5">Quick Auto Assist</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href={import.meta.env.VITE_LANDING_APP_URL || 'http://localhost:5173'} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-colors">Home</a>
            <button type="button" onClick={onToggleTheme} className="flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 px-3 text-[11px] font-black transition-all shadow-sm dark:border-slate-700 dark:bg-slate-800">
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </header>

        <main className="grid gap-8 lg:grid-cols-12 items-start">
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></div>
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                {step === 'form' ? 'Get ready for service calls' : 'Verify your technician email'}
              </span>
            </div>
            <div>
              <h2 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-[0.9]">
                Grow your <span className="text-blue-600 underline decoration-blue-500/30 underline-offset-8">business</span> with us.
              </h2>
              <p className="mt-6 text-lg font-medium text-slate-600 dark:text-slate-400 leading-relaxed max-w-md">
                {step === 'form'
                  ? 'Create your technician account, add your service area, and start receiving nearby jobs.'
                  : `We sent a 6-digit code to ${form.email}. Verify it to finish creating your technician account.`}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {[
                { icon: '01', title: 'Nearby jobs', desc: 'Get alerts when new work is available.' },
                { icon: '02', title: 'Easy tracking', desc: 'Manage your service area and updates in one place.' },
                { icon: '03', title: step === 'form' ? 'Verify email' : 'Finish signup', desc: step === 'form' ? 'We confirm your email before the account goes live.' : 'Enter the code and sign in to start receiving jobs.' },
              ].map((item) => (
                <div key={item.icon} className="flex items-center gap-4 p-4 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-white/5 backdrop-blur-sm shadow-sm transition-transform hover:scale-[1.02]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-sm font-black text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400">{item.icon}</div>
                  <div>
                    <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-900 dark:text-white">{item.title}</h4>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <section className="lg:col-span-7 rounded-[40px] border border-white/40 dark:border-slate-800/60 bg-white/60 dark:bg-[#0F172A]/80 backdrop-blur-xl p-8 sm:p-10 shadow-2xl relative overflow-hidden transition-all hover:shadow-blue-500/5 group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>

            <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-2">
              {step === 'form' ? 'Create Technician Account' : 'Verify Your Email'}
            </h3>
            <p className="mb-8 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
              {step === 'form'
                ? 'Fill your details and request a verification code'
                : `Code sent to ${form.email}`}
            </p>

            {errors.form && (
              <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-[10px] font-bold text-red-500 uppercase tracking-widest text-center">
                {errors.form}
              </div>
            )}

            {step === 'form' ? (
              <form className="grid gap-6" onSubmit={handleSendOtp} noValidate>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="full_name" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Full name<RequiredAsterisk /></label>
                    <input id="full_name" ref={registerField('full_name')} value={form.full_name} onChange={handleChange('full_name')} onBlur={() => validateField('full_name')} className="w-full h-14 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl px-5 text-sm font-medium outline-none focus:border-blue-500 dark:focus:border-blue-500/50 transition-all placeholder:text-slate-400" placeholder="John Doe" />
                    {errors.full_name && <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight ml-1">{errors.full_name}</p>}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Email<RequiredAsterisk /></label>
                    <input id="email" ref={registerField('email')} type="email" value={form.email} onChange={handleChange('email')} onBlur={() => validateField('email')} className="w-full h-14 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl px-5 text-sm font-medium outline-none focus:border-blue-500 dark:focus:border-blue-500/50 transition-all placeholder:text-slate-400" placeholder="johndoe@email.com" />
                    {errors.email && <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight ml-1">{errors.email}</p>}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="phone_number" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Phone number<RequiredAsterisk /></label>
                    <input id="phone_number" ref={registerField('phone_number')} value={form.phone_number} onChange={handleChange('phone_number')} onBlur={() => validateField('phone_number')} inputMode="numeric" maxLength={10} className="w-full h-14 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl px-5 text-sm font-medium outline-none focus:border-blue-500 dark:focus:border-blue-500/50 transition-all placeholder:text-slate-400" placeholder="10 digit number" />
                    {errors.phone_number && <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight ml-1">{errors.phone_number}</p>}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="business_name" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Business name (optional)</label>
                    <input id="business_name" value={form.business_name} onChange={handleChange('business_name')} className="w-full h-14 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl px-5 text-sm font-medium outline-none focus:border-blue-500 dark:focus:border-blue-500/50 transition-all placeholder:text-slate-400" placeholder="Garage name" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Password<RequiredAsterisk /></label>
                    <input id="password" ref={registerField('password')} type="password" value={form.password} onChange={handleChange('password')} onBlur={() => validateField('password')} minLength={8} className="w-full h-14 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl px-5 text-sm font-medium outline-none focus:border-blue-500 dark:focus:border-blue-500/50 transition-all placeholder:text-slate-400" placeholder="Enter your password" />
                    {errors.password && <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight ml-1">{errors.password}</p>}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="confirmPassword" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Confirm password<RequiredAsterisk /></label>
                    <input id="confirmPassword" ref={registerField('confirmPassword')} type="password" value={form.confirmPassword} onChange={handleChange('confirmPassword')} onBlur={() => validateField('confirmPassword')} minLength={8} className="w-full h-14 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl px-5 text-sm font-medium outline-none focus:border-blue-500 dark:focus:border-blue-500/50 transition-all placeholder:text-slate-400" placeholder="Enter your password" />
                    {errors.confirmPassword && <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight ml-1">{errors.confirmPassword}</p>}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="technician_type" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Technician type<RequiredAsterisk /></label>
                    <div className="relative">
                      <select id="technician_type" ref={registerField('technician_type')} value={form.technician_type} onChange={handleChange('technician_type')} onBlur={() => validateField('technician_type')} className="w-full h-14 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl px-5 text-sm font-medium outline-none focus:border-blue-500 dark:focus:border-blue-500/50 transition-all appearance-none cursor-pointer">
                        <option value="individual">Individual</option>
                        <option value="garage">Garage</option>
                      </select>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                    {errors.technician_type && <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight ml-1">{errors.technician_type}</p>}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="service_radius" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Service radius (km)<RequiredAsterisk /></label>
                    <input id="service_radius" ref={registerField('service_radius')} type="number" min="1" value={form.service_radius} onChange={handleChange('service_radius')} onBlur={() => validateField('service_radius')} className="w-full h-14 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl px-5 text-sm font-medium outline-none focus:border-blue-500 dark:focus:border-blue-500/50 transition-all placeholder:text-slate-400" placeholder="e.g. 15" />
                    {errors.service_radius && <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight ml-1">{errors.service_radius}</p>}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Workshop / Service Location<RequiredAsterisk /></label>
                  <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 shadow-inner">
                    <LocationPicker
                      latitude={form.latitude}
                      longitude={form.longitude}
                      onChange={({ latitude, longitude, address }) => {
                        setForm((prev) => ({
                          ...prev,
                          latitude,
                          longitude,
                          location: address || prev.location,
                        }))
                        setErrors((prev) => ({ ...prev, latitude: '', longitude: '', form: '' }))
                      }}
                      label=""
                      required
                    />
                  </div>
                  {(errors.latitude || errors.longitude) && <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight ml-1">Please pick your location on the map</p>}
                </div>

                <button type="submit" disabled={isDisabled} className="w-full h-16 rounded-[40px] bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 transition-all shadow-xl shadow-slate-900/10 dark:shadow-white/5 mt-2">
                  {isSubmitting ? 'Sending code...' : 'Send verification code'}
                </button>
              </form>
            ) : (
              <form className="grid gap-6" onSubmit={handleVerifyAndCreate} noValidate>
                <div className="rounded-3xl border border-blue-500/10 bg-blue-50/80 px-5 py-4 dark:border-blue-500/20 dark:bg-blue-500/10">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-600 dark:text-blue-400">Verification required</p>
                  <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                    Enter the 6-digit code sent to <span className="font-black text-slate-900 dark:text-white">{form.email}</span>.
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="otp" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Verification code<RequiredAsterisk /></label>
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
                    className="w-full h-16 bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/50 rounded-3xl px-5 text-center text-2xl font-black tracking-[0.4em] outline-none focus:border-blue-500 dark:focus:border-blue-500/50 transition-all font-mono"
                    placeholder="000000"
                    inputMode="numeric"
                    maxLength={6}
                    autoFocus
                  />
                  {errors.otp && <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight ml-1">{errors.otp}</p>}
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

                <button type="submit" disabled={isDisabled} className="w-full h-16 rounded-[40px] bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 transition-all shadow-xl shadow-slate-900/10 dark:shadow-white/5 mt-2">
                  {isSubmitting ? 'Creating account...' : 'Verify and create account'}
                </button>
              </form>
            )}

            <div className="mt-8 pt-8 border-t border-slate-200/50 dark:border-slate-800/50 flex flex-wrap items-center justify-between gap-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Already have an account?</p>
              <Link to="/auth/technician/signin" className="px-6 py-2.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all">Sign In</Link>
            </div>
          </section>
        </main>

        <section className="mt-20 py-10 border-t border-slate-200 dark:border-slate-800/60 text-center">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">How it works</h4>
          <div className="flex flex-wrap justify-center gap-8">
            {[
              { step: '01', title: 'Share your details', desc: 'Tell us about you and your business.' },
              { step: '02', title: 'Verify email', desc: 'Enter the code sent to your inbox.' },
              { step: '03', title: 'Start taking jobs', desc: 'Sign in and begin receiving requests.' },
            ].map((item) => (
              <div key={item.step} className="max-w-[150px]">
                <span className="text-2xl font-black text-blue-600/20 dark:text-blue-400/20 leading-none">{item.step}</span>
                <h5 className="font-black text-[10px] text-slate-900 dark:text-white uppercase tracking-widest mt-1">{item.title}</h5>
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default TechnicianSignUpPage
