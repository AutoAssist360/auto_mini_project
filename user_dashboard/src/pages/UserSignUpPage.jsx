import { useMemo, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, userSignUp, sendOtp } from '../lib/api'
import RequiredAsterisk from '../components/RequiredAsterisk'
import { createEmptyErrors, EMAIL_REGEX, PHONE_REGEX, sanitizeDigits, useFirstErrorFocus } from '../lib/formValidation'

function UserSignUpPage({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const fieldOrder = ['full_name', 'email', 'phone_number', 'password', 'confirmPassword']
  const { registerField, focusFirst } = useFirstErrorFocus(fieldOrder)
  const { registerField: registerOtpField, focusFirst: focusOtp } = useFirstErrorFocus(['otp'])

  const [step, setStep] = useState('form')
  const [otpToken, setOtpToken] = useState('')

  const [form, setForm] = useState({ full_name: '', email: '', phone_number: '', password: '', confirmPassword: '' })
  const [otp, setOtp] = useState('')
  const [errors, setErrors] = useState({ ...createEmptyErrors(fieldOrder), otp: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [otpCountdown, setOtpCountdown] = useState(0)

  const isDisabled = useMemo(() => {
    if (step === 'form') return isSubmitting || !form.full_name || !form.email || !form.phone_number || !form.password || !form.confirmPassword
    return isSubmitting || otp.length !== 6
  }, [isSubmitting, form, step, otp])

  const handleChange = (field) => (event) => {
    const rawValue = event.target.value; const value = field === 'phone_number' ? sanitizeDigits(rawValue, 10) : rawValue
    setForm(p => ({ ...p, [field]: value })); setErrors(p => ({ ...p, [field]: '', form: '' }))
  }

  const getErrors = (values = form) => {
    const nextErrors = { ...createEmptyErrors(fieldOrder), otp: '' }
    if (!values.full_name.trim()) nextErrors.full_name = 'Full name is required'
    if (!values.email.trim()) nextErrors.email = 'Email is required'
    else if (!EMAIL_REGEX.test(values.email.trim())) nextErrors.email = 'Enter a valid email address'
    if (!values.phone_number) nextErrors.phone_number = 'Phone number is required'
    else if (!PHONE_REGEX.test(values.phone_number)) nextErrors.phone_number = 'Enter a 10-digit phone number'
    if (!values.password) nextErrors.password = 'Password is required'
    else if (values.password.length < 8) nextErrors.password = 'Password must be at least 8 characters'
    if (!values.confirmPassword) nextErrors.confirmPassword = 'Please confirm your password'
    else if (values.password !== values.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match'
    return nextErrors
  }

  const validateField = (field, values = form) => {
    const nextErrors = getErrors(values)
    setErrors(p => ({ ...p, [field]: nextErrors[field], form: '' }))
  }

  const validateForm = () => {
    const nextErrors = getErrors(form); setErrors(nextErrors)
    const isValid = !fieldOrder.some((field) => nextErrors[field])
    if (!isValid) focusFirst(nextErrors)
    return isValid
  }

  const startCooldown = useCallback(() => {
    setOtpCountdown(60)
    const id = setInterval(() => {
      setOtpCountdown((p) => { if (p <= 1) { clearInterval(id); return 0 }; return p - 1 })
    }, 1000)
  }, [])

  const handleSendOtp = async (event) => {
    event.preventDefault()
    if (!validateForm()) return
    setIsSubmitting(true); setErrors(p => ({ ...p, form: '' }))
    try {
      const res = await sendOtp(form.email.trim())
      setOtpToken(res.otp_token); setStep('otp'); startCooldown()
    } catch (error) { setErrors(p => ({ ...p, form: error instanceof ApiError ? error.message : 'Unable to send the code. Please try again.' })) }
    finally { setIsSubmitting(false) }
  }

  const handleResendOtp = async () => {
    if (otpCountdown > 0) return
    setIsSubmitting(true); setErrors(p => ({ ...p, form: '', otp: '' }))
    try { const res = await sendOtp(form.email.trim()); setOtpToken(res.otp_token); setOtp(''); startCooldown() }
    catch (error) { setErrors(p => ({ ...p, form: error instanceof ApiError ? error.message : 'Unable to send the code again. Please try again.' })) }
    finally { setIsSubmitting(false) }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (otp.length !== 6) { const nErr = { otp: 'Enter the 6-digit code' }; setErrors(p => ({ ...p, otp: nErr.otp })); focusOtp(nErr); return }
    setIsSubmitting(true); setErrors(p => ({ ...p, form: '', otp: '' }))
    try {
      await userSignUp({ full_name: form.full_name.trim(), email: form.email.trim(), phone_number: form.phone_number, password: form.password, otp_token: otpToken, otp })
      navigate('/auth/user/signin', { replace: true, state: { signupSuccess: 'Your account is ready. Please sign in.' } })
    } catch (error) { setErrors(p => ({ ...p, form: error instanceof ApiError ? error.message : 'Unable to create your account. Please try again.' })) }
    finally { setIsSubmitting(false) }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 transition-colors duration-500 overflow-x-hidden">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl min-h-screen flex flex-col px-4 py-8">
        
        <header className="mb-12 flex flex-wrap items-center justify-between gap-4">
           <Link to="/" className="group flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20 group-hover:scale-110 transition-transform">
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <span className="text-xl font-black tracking-tighter uppercase dark:text-white">Quick Auto Assist</span>
           </Link>
           <button onClick={onToggleTheme} className="flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white/50 px-3 text-[11px] font-black backdrop-blur-md transition-all hover:bg-white dark:border-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-800">
              {theme === 'dark' ? 'Light' : 'Dark'}
           </button>
        </header>

        <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-16 lg:gap-24">
           
           {/* Visual Brand Section */}
           <section className="hidden lg:block lg:w-1/2 space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
              <div className="space-y-4">
                 <span className="text-[10px] font-black text-blue-600 dark:text-blue-500 uppercase tracking-[0.3em]">Create your account</span>
                 <h1 className="text-5xl font-black text-slate-900 dark:text-white leading-[1.1] tracking-tight">Get roadside help faster.</h1>
                 <p className="text-lg text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-md">Sign up to request help, follow your technician, and pay safely in one place.</p>
              </div>

              <div className="grid gap-6 pt-4">
                 {[
                   { id: '01', title: 'Create your account', desc: 'Add your basic details to get started.' },
                   { id: '02', title: 'Verify your email', desc: 'Enter the code we send to your inbox.' },
                   { id: '03', title: 'Start using the app', desc: 'Request help and track updates from one place.' }
                 ].map(item => (
                   <div key={item.id} className="flex gap-4 group">
                      <span className="text-xl font-black text-slate-200 dark:text-slate-800 group-hover:text-blue-500/50 transition-colors uppercase italic">{item.id}</span>
                      <div>
                         <h3 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest mb-1">{item.title}</h3>
                         <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">{item.desc}</p>
                      </div>
                   </div>
                 ))}
              </div>
           </section>

           {/* Focused Form Section */}
           <section className="w-full max-w-md lg:w-1/2 animate-in fade-in slide-in-from-right-8 duration-700">
              <div className="p-8 lg:p-10 rounded-[40px] bg-white/70 dark:bg-slate-900/40 backdrop-blur-2xl border border-slate-200 dark:border-slate-800 shadow-2xl relative">
                 
                 <div className="mb-8">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                       {step === 'form' ? 'Create Account' : 'Enter Verification Code'}
                    </h2>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                       {step === 'form' ? 'Fill in your details to get started' : `We sent a 6-digit code to ${form.email}`}
                    </p>
                 </div>

                 {errors.form && <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[9px] font-black uppercase tracking-widest animate-in shake transition-all">{errors.form}</div>}

                 {step === 'form' ? (
                   <form className="space-y-5" onSubmit={handleSendOtp} noValidate>
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Full name<RequiredAsterisk /></label>
                         <input ref={registerField('full_name')} value={form.full_name} onChange={handleChange('full_name')} onBlur={() => validateField('full_name')} className="w-full h-12 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 text-[11px] font-bold outline-none focus:border-blue-500 transition-all font-sans" placeholder="John Doe" />
                         {errors.full_name && <p className="text-[9px] font-black text-red-500 uppercase tracking-widest pl-2">{errors.full_name}</p>}
                      </div>

                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Email address<RequiredAsterisk /></label>
                         <input ref={registerField('email')} type="email" value={form.email} onChange={handleChange('email')} onBlur={() => validateField('email')} className="w-full h-12 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 text-[11px] font-bold outline-none focus:border-blue-500 transition-all" placeholder="you@example.com" />
                         {errors.email && <p className="text-[9px] font-black text-red-500 uppercase tracking-widest pl-2">{errors.email}</p>}
                      </div>

                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Phone number<RequiredAsterisk /></label>
                         <input ref={registerField('phone_number')} value={form.phone_number} onChange={handleChange('phone_number')} onBlur={() => validateField('phone_number')} inputMode="numeric" maxLength={10} className="w-full h-12 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 text-[11px] font-bold outline-none focus:border-blue-500 transition-all font-mono" placeholder="10-digit phone number" />
                         {errors.phone_number && <p className="text-[9px] font-black text-red-500 uppercase tracking-widest pl-2">{errors.phone_number}</p>}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Password<RequiredAsterisk /></label>
                           <input ref={registerField('password')} type="password" value={form.password} onChange={handleChange('password')} onBlur={() => validateField('password')} minLength={8} className="w-full h-12 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 text-[11px] font-bold outline-none focus:border-blue-500 transition-all" placeholder="Enter your password" />
                           {errors.password && <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">{errors.password}</p>}
                        </div>
                        <div className="space-y-1">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Confirm password<RequiredAsterisk /></label>
                           <input ref={registerField('confirmPassword')} type="password" value={form.confirmPassword} onChange={handleChange('confirmPassword')} onBlur={() => validateField('confirmPassword')} minLength={8} className="w-full h-12 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 text-[11px] font-bold outline-none focus:border-blue-500 transition-all" placeholder="Enter your password" />
                           {errors.confirmPassword && <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">{errors.confirmPassword}</p>}
                        </div>
                      </div>

                      <button type="submit" disabled={isDisabled} className="w-full h-14 bg-blue-600 text-white rounded-[20px] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-500 shadow-xl shadow-blue-600/20 active:scale-95 transition-all disabled:opacity-30">
                        {isSubmitting ? 'Sending code...' : 'Send verification code'}
                      </button>
                   </form>
                 ) : (
                   <form className="space-y-6" onSubmit={handleSubmit} noValidate>
                      <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center block">6-digit code<RequiredAsterisk /></label>
                         <input
                           ref={registerOtpField('otp')}
                           value={otp}
                           onChange={(e) => { const v = sanitizeDigits(e.target.value, 6); setOtp(v); setErrors(p => ({ ...p, otp: '', form: '' })) }}
                           onBlur={() => { if (otp.length !== 6) setErrors(p => ({ ...p, otp: 'Enter the 6-digit code' })) }}
                           className="w-full h-16 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[24px] px-5 text-center text-2xl font-black tracking-[0.5em] focus:border-blue-500 outline-none transition-all font-mono"
                           placeholder="000000"
                           inputMode="numeric"
                           maxLength={6}
                           autoFocus
                         />
                         {errors.otp && <p className="text-[9px] font-black text-red-500 uppercase tracking-widest text-center italic">{errors.otp}</p>}
                      </div>

                      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                         <button type="button" onClick={() => { setStep('form'); setOtp(''); setOtpToken(''); setOtpCountdown(0) }} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-500 transition-colors">
                           Edit details
                         </button>
                         <button type="button" onClick={handleResendOtp} disabled={otpCountdown > 0 || isSubmitting} className="text-[10px] font-black uppercase tracking-widest text-blue-600 disabled:opacity-30">
                           {otpCountdown > 0 ? `Wait ${otpCountdown}s` : 'Send again'}
                         </button>
                      </div>

                      <button type="submit" disabled={isDisabled} className="w-full h-14 bg-blue-600 text-white rounded-[20px] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-500 shadow-xl shadow-blue-600/20 active:scale-95 transition-all disabled:opacity-30">
                        {isSubmitting ? 'Creating account...' : 'Create account'}
                      </button>
                   </form>
                 )}

                 <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                       Already have an account? <Link to="/auth/user/signin" className="text-blue-600 hover:text-blue-500 ml-1">Sign in</Link>
                    </p>
                 </div>
              </div>
           </section>

        </main>

        <footer className="mt-12 text-center text-[9px] font-black text-slate-300 dark:text-slate-800 uppercase tracking-[0.4em]">
           Quick Auto Assist account setup
        </footer>

      </div>
    </div>
  )
}

export default UserSignUpPage


