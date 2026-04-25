import { useState, useCallback, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CarScrollAnimation from '../components/CarScrollAnimation'
import requestHelpImg from './requesthelp.jpg'
import connectToTechImg from './connecttotech.png'
import getRescuedImg from './getrescued.png'
import backgroundImg from './Background.png'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

function LandingPage({ theme, onToggleTheme }) {
  const navigate = useNavigate()

  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false)
  const [requestSubmitted, setRequestSubmitted] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])
  const [quickRequest, setQuickRequest] = useState({
    fullName: '',
    phone: '',
    issueType: 'mechanical_failure',
    needsTowing: false,
    locationHint: '',
  })

  const openRolePage = (intent, role) => {
    const params = new URLSearchParams({ intent })
    if (role) params.set('role', role)
    navigate(`/auth/role?${params.toString()}`)
  }

  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false)
  const [emergencyRef, setEmergencyRef] = useState('')
  const [emergencyError, setEmergencyError] = useState('')

  const handleQuickRequestSubmit = useCallback(async (event) => {
    event.preventDefault()
    setIsSubmittingRequest(true)
    setEmergencyError('')
    setEmergencyRef('')

    try {
      const res = await fetch(`${API_BASE}/emergency-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: quickRequest.fullName,
          phone: quickRequest.phone,
          issue_type: quickRequest.issueType,
          needs_towing: quickRequest.needsTowing,
          location_hint: quickRequest.locationHint,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setEmergencyError(data?.message || 'Something went wrong. Please try again.')
        return
      }

      setEmergencyRef(data.reference || '')
      setRequestSubmitted(true)
    } catch {
      setEmergencyError('Network error. Please check your connection and try again.')
    } finally {
      setIsSubmittingRequest(false)
    }
  }, [quickRequest])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#050505] dark:text-slate-100 pb-10">
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 px-4 sm:px-6 lg:px-8 ${isScrolled ? 'pt-4 pointer-events-auto' : 'pt-6 sm:pt-8 pointer-events-none'}`}>
        <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-top-4 duration-700 pointer-events-none">
          <nav className={`pointer-events-auto flex items-center justify-between gap-3 rounded-[32px] transition-all duration-500 ${isScrolled ? 'border border-white/20 bg-white/70 shadow-2xl backdrop-blur-2xl dark:border-slate-800/50 dark:bg-[#050505]/80 p-2 pl-3 sm:pl-6' : 'border border-transparent bg-transparent p-2 pl-3 sm:pl-6 shadow-none'}`}>
            {/* Logo Section */}
            <Link to="/" className="group flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white shadow-lg shadow-blue-500/30 transition-transform group-hover:scale-110">
                A
              </div>
              <div className="hidden sm:block">
                <span className="text-lg font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none block">Quick Auto</span>
                <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Roadside Help</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-2">
              <button
                type="button"
                onClick={() => openRolePage('login', 'technician')}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
              >
                Technician Login
              </button>
              <button
                type="button"
                onClick={() => openRolePage('login', 'vendor')}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
              >
                Vendor Login
              </button>
            </div>

            {/* CTA Section */}
            <div className="flex shrink-0 items-center gap-2 pr-1 sm:pr-2">
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white/80 text-slate-500 transition-all hover:scale-105 hover:bg-slate-100 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 active:scale-95"
                title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              >
                {theme === 'dark' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.243 17.657l.707.707M7.757 7.757l.707.707M12 7a5 5 0 100 10 5 5 0 000-10z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={() => openRolePage('login')}
                className="hidden sm:block rounded-2xl px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-900 hover:bg-slate-100 transition-all dark:text-white dark:hover:bg-white/10 active:scale-95"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => openRolePage('help')}
                className="rounded-[24px] bg-blue-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-blue-500/20 transition-all hover:bg-blue-500 hover:shadow-blue-500/30 active:scale-95 sm:px-8"
              >
                Get Help
              </button>
            </div>
          </nav>
        </div>
      </header>

      <CarScrollAnimation openRolePage={openRolePage} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 md:mt-24">

        <section className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 relative z-10" aria-label="Service options">
          {/* Feature 1 */}
          
          <div className="group relative flex flex-col overflow-hidden text-left rounded-[40px] border border-white/20 bg-white/70 shadow-2xl transition-all duration-500 hover:-translate-y-3 hover:shadow-blue-500/20 dark:border-slate-800/50 dark:bg-[#0B1120]/70 backdrop-blur-xl">
            <div className="relative h-56 w-full overflow-hidden flex-shrink-0">
              <img src={requestHelpImg} alt="Request Help Map" className="h-[150%] w-[150%] object-cover object-top opacity-60 group-hover:scale-110 transition-transform duration-1000" />
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent dark:from-[#0B1120] dark:via-[#0B1120]/40"></div>
            </div>
            <div className="flex flex-col flex-1 p-10 pt-0 -mt-12 relative z-10">
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-600 text-white shadow-xl shadow-blue-500/30 transition-all duration-500 group-hover:rotate-6 group-hover:scale-110">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.242-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Request Help</h3>
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Share your location</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Tell us what happened and where you are so help can reach you faster.
              </p>
            </div>
          
          </div>
          {/* Feature 2 */}
          
          <div className="group relative flex flex-col overflow-hidden text-left rounded-[40px] border border-white/20 bg-white/70 shadow-2xl transition-all duration-500 hover:-translate-y-3 hover:shadow-blue-500/20 dark:border-slate-800/50 dark:bg-[#0B1120]/70 backdrop-blur-xl">
            <div className="relative h-56 w-full overflow-hidden flex-shrink-0">
              <img src={connectToTechImg} alt="Connect to Tech" className="h-full w-full object-cover object-center opacity-60 group-hover:scale-110 transition-transform duration-1000" />
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent dark:from-[#0B1120] dark:via-[#0B1120]/40"></div>
            </div>
            <div className="flex flex-col flex-1 p-10 pt-0 -mt-12 relative z-10">
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-600 text-white shadow-xl shadow-blue-500/30 transition-all duration-500 group-hover:rotate-6 group-hover:scale-110">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                </svg>
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Find a Technician</h3>
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Compare nearby help</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                See available technicians, compare offers, and chat with them directly.
              </p>
            </div>
            </div>

          {/* Feature 3 */}
          <div className="group relative flex flex-col overflow-hidden text-left rounded-[40px] border border-white/20 bg-white/70 shadow-2xl transition-all duration-500 hover:-translate-y-3 hover:shadow-blue-500/20 dark:border-slate-800/50 dark:bg-[#0B1120]/70 backdrop-blur-xl">
            <div className="relative h-56 w-full overflow-hidden flex-shrink-0">
              <img src={getRescuedImg} alt="Get Rescued" className="h-full w-full object-cover object-center opacity-60 group-hover:scale-110 transition-transform duration-1000" />
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent dark:from-[#0B1120] dark:via-[#0B1120]/40"></div>
            </div>
            <div className="flex flex-col flex-1 p-10 pt-0 -mt-12 relative z-10">
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-600 text-white shadow-xl shadow-blue-500/30 transition-all duration-500 group-hover:rotate-6 group-hover:scale-110">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                </svg>
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Track Your Help</h3>
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">See arrival updates</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Follow the technician on the way, see towing updates, and know when the job is done.
              </p>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mt-16 relative overflow-hidden rounded-[48px] bg-slate-100/40 px-6 py-20 text-slate-900 shadow-xl transition-colors dark:bg-[#0B1120]/40 backdrop-blur-md dark:text-slate-50 sm:px-12 lg:p-24 border border-white/20 dark:border-slate-800/50">
          <div className="absolute -left-40 -top-40 h-[40rem] w-[40rem] pointer-events-none rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.1)_0%,transparent_70%)]"></div>
          <div className="absolute -bottom-40 -right-40 h-[40rem] w-[40rem] pointer-events-none rounded-full bg-[radial-gradient(circle,rgba(6,182,214,0.1)_0%,transparent_70%)]"></div>

          <div className="relative z-10 mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white sm:text-6xl uppercase">How It Works</h2>
            <p className="mt-6 text-[10px] font-black uppercase tracking-[0.4em] text-blue-500">4 easy steps to get help</p>
          </div>

          <div className="relative z-10 mt-20 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Step 1 */}
            <div className="group relative flex flex-col rounded-[32px] border border-white/10 bg-white/60 p-8 shadow-xl transition-all duration-500 hover:-translate-y-2 dark:bg-slate-900/60">
              <div className="flex items-center justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-xl font-black text-white shadow-xl dark:bg-blue-600 transition-transform group-hover:scale-110">
                  01
                </div>
                <div className="h-10 w-10 text-slate-300 dark:text-slate-700">
                  <svg className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
              <h3 className="mt-8 text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Choose Your Role</h3>
              <p className="mt-3 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                Pick whether you are a driver, technician, or vendor.
              </p>
            </div>

            {/* Step 2 */}
            <div className="group relative flex flex-col rounded-[32px] border border-white/10 bg-white/60 p-8 shadow-xl transition-all duration-500 hover:-translate-y-2 dark:bg-slate-900/60">
              <div className="flex items-center justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-xl font-black text-white shadow-xl dark:bg-blue-600 transition-transform group-hover:scale-110">
                  02
                </div>
                <div className="h-10 w-10 text-slate-300 dark:text-slate-700">
                  <svg className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </div>
              </div>
              <h3 className="mt-8 text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Sign In Or Create An Account</h3>
              <p className="mt-3 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                Log in or sign up in a few steps to continue.
              </p>
            </div>

            {/* Step 3 */}
            <div className="group relative flex flex-col rounded-[32px] border border-white/10 bg-white/60 p-8 shadow-xl transition-all duration-500 hover:-translate-y-2 dark:bg-slate-900/60">
              <div className="flex items-center justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-xl font-black text-white shadow-xl dark:bg-blue-600 transition-transform group-hover:scale-110">
                  03
                </div>
                <div className="h-10 w-10 text-slate-300 dark:text-slate-700">
                  <svg className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              <h3 className="mt-8 text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Request Help</h3>
              <p className="mt-3 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                Share your issue and we will connect you with nearby help.
              </p>
            </div>

            {/* Step 4 */}
            <div className="group relative flex flex-col rounded-[32px] border border-white/10 bg-white/60 p-8 shadow-xl transition-all duration-500 hover:-translate-y-2 dark:bg-slate-900/60">
              <div className="flex items-center justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-xl font-black text-white shadow-xl dark:bg-blue-600 transition-transform group-hover:scale-110">
                  04
                </div>
                <div className="h-10 w-10 text-slate-300 dark:text-slate-700">
                  <svg className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <h3 className="mt-8 text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Track And Pay</h3>
              <p className="mt-3 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                Follow the arrival time, check your bill, and pay safely.
              </p>
            </div>
          </div>
        </section>

        <section id="about" className="mt-12 rounded-[40px] border border-white/20 bg-white/70 p-10 shadow-2xl backdrop-blur-xl dark:border-slate-800/50 dark:bg-[#0B1120]/70">
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">About Quick Auto Assist</h2>
          <p className="mt-4 text-sm font-medium leading-[1.8] text-slate-500 dark:text-slate-400 sm:text-base">
            Quick Auto Assist helps drivers get roadside support quickly. We connect people with nearby technicians and vendors, keep updates clear, and make the whole process easier during a stressful breakdown.
          </p>
        </section>

        <section id="contact" className="mt-8 rounded-[40px] border border-white/20 bg-white/70 p-10 shadow-2xl backdrop-blur-xl dark:border-slate-800/50 dark:bg-[#0B1120]/70">
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Need Help?</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="group rounded-[32px] border border-slate-200 dark:border-slate-800 p-6 transition-all hover:bg-white dark:hover:bg-slate-900 shadow-sm">
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-blue-500">Email Support</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">support@quickautoassist.com</p>
            </div>
            <div className="group rounded-[32px] border border-slate-200 dark:border-slate-800 p-6 transition-all hover:bg-white dark:hover:bg-slate-900 shadow-sm">
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-blue-500">Call Us</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">+91 90000 00000</p>
            </div>
          </div>
        </section>

        <footer className="mb-12 mt-20 rounded-[60px] border border-white/20 bg-white/70 px-6 py-12 shadow-2xl backdrop-blur-2xl dark:border-slate-800/50 dark:bg-[#0B1120]/80 sm:px-16 sm:py-16">
          <div className="mx-auto grid max-w-7xl gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-12">
            <div className="flex flex-col gap-6">
              <Link to="/" className="inline-flex items-center gap-3 group">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white shadow-lg transition-transform group-hover:rotate-12">
                  A
                </div>
                <span className="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">Quick Auto Assist</span>
              </Link>
              <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                Quick Auto Assist is here 24/7 to help drivers find roadside support fast.
              </p>
              <div className="flex gap-5">
                <a  href="https://github.com/AutoAssist360/myRepo" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-blue-600 hover:text-white transition-all dark:bg-slate-800">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" /></svg>
                  </a>
              </div>
            </div>

            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-900 dark:text-white">Quick Links</h3>
              <ul className="mt-8 flex flex-col gap-6 text-sm font-bold text-slate-500 dark:text-slate-400">
                <li><a href="#about" className="hover:text-blue-600 transition-colors uppercase tracking-widest text-[10px]">About Us</a></li>
                <li><a href="#how-it-works" className="hover:text-blue-600 transition-colors uppercase tracking-widest text-[10px]">How It Works</a></li>
              </ul>
            </div>

            

            <div className="p-8 rounded-[40px] bg-slate-900 dark:bg-blue-600 shadow-2xl">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Get Updates</h3>
              <p className="mt-4 text-[10px] font-bold leading-relaxed text-slate-400 dark:text-blue-100/60 uppercase">
                Get updates about service improvements and important news.
              </p>
              <form className="mt-6 space-y-3" onSubmit={(e) => e.preventDefault()}>
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="w-full rounded-2xl border-none bg-white/10 px-5 py-4 text-xs font-bold text-white placeholder-slate-500 focus:bg-white/20 focus:outline-none transition-all shadow-inner"
                  required
                />
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-white px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-900 shadow-xl hover:bg-slate-100 transition-all active:scale-95"
                >
                  Subscribe
                </button>
              </form>
            </div>
          </div>

          <div className="mt-16 flex flex-col items-center justify-between gap-6 border-t border-slate-200/50 pt-10 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:border-slate-800/50 sm:flex-row">
            <p>&copy; {new Date().getFullYear()} Quick Auto Assist. All rights reserved.</p>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-8">
              <Link to="/privacy" className="hover:text-blue-600 transition-all">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-blue-600 transition-all">Terms Of Service</Link>
            </div>
          </div>
        </footer>
      </div>

      {isEmergencyModalOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/60 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Emergency Quick Request</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Fill in a few details so our team can contact you quickly.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEmergencyModalOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm dark:border-slate-700"
              >
                Close
              </button>
            </div>

            <form className="mt-4 grid gap-3" onSubmit={handleQuickRequestSubmit}>
              <input
                required
                value={quickRequest.fullName}
                onChange={(event) => setQuickRequest((prev) => ({ ...prev, fullName: event.target.value }))}
                placeholder="Full name"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                required
                value={quickRequest.phone}
                onChange={(event) => setQuickRequest((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="Phone number"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800"
              />
              <select
                value={quickRequest.issueType}
                onChange={(event) => setQuickRequest((prev) => ({ ...prev, issueType: event.target.value }))}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="mechanical_failure">Mechanical failure</option>
                <option value="electrical_issue">Electrical issue</option>
                <option value="tire_related">Tire related</option>
                <option value="battery_issue">Battery issue</option>
              </select>
              <input
                value={quickRequest.locationHint}
                onChange={(event) => setQuickRequest((prev) => ({ ...prev, locationHint: event.target.value }))}
                placeholder="Current location / nearby landmark"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800"
              />
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={quickRequest.needsTowing}
                  onChange={(event) => setQuickRequest((prev) => ({ ...prev, needsTowing: event.target.checked }))}
                />
                Needs towing support
              </label>

              <button
                type="submit"
                disabled={isSubmittingRequest}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingRequest ? 'Submitting...' : 'Submit Quick Request'}
              </button>
            </form>

            {emergencyError && (
              <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200">
                {emergencyError}
              </div>
            )}

            {requestSubmitted && (
              <div className="mt-4 rounded-xl border border-blue-300 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-200">
                <p className="font-semibold">Emergency request submitted successfully!</p>
                {emergencyRef && <p className="mt-1">Reference: <strong>{emergencyRef}</strong></p>}
                <p className="mt-1">Our support team will contact you at <strong>{quickRequest.phone}</strong> shortly.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default LandingPage

