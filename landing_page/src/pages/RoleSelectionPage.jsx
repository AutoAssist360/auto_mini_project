import { Link, useSearchParams } from 'react-router-dom'

function RoleSelectionPage({ theme }) {
  const [searchParams] = useSearchParams()
  const intent = searchParams.get('intent') || 'login'

  const userAppBaseUrl = import.meta.env.VITE_USER_APP_URL || 'http://localhost:5174'
  const technicianAppBaseUrl = import.meta.env.VITE_TECHNICIAN_APP_URL || 'http://localhost:5175'
  const vendorAppBaseUrl = import.meta.env.VITE_VENDOR_APP_URL || 'http://localhost:5176'
  const adminAppBaseUrl = import.meta.env.VITE_ADMIN_APP_URL || 'http://localhost:5177'

  const q = theme ? `?theme=${theme}` : ''

  const roleCards = [
    {
      key: 'customer',
      label: 'CUSTOMER',
      desc: 'Get roadside assistance, raise service requests, and track your vehicle repairs in real-time.',
      primaryRoute: `${userAppBaseUrl}/auth/user/signin${q}`,
      secondaryRoute: `${userAppBaseUrl}/auth/user/signup${q}`,
      primaryLabel: intent === 'help' ? 'CONTINUE' : 'LOGIN',
      secondaryLabel: 'Register',
      iconGradient: 'from-blue-400 to-blue-600',
      shadowColor: 'shadow-blue-500/30',
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    {
      key: 'technician',
      label: 'TECHNICIAN',
      desc: 'Take control of your schedule. Browse assignments, submit offers, and earn by helping customers.',
      primaryRoute: `${technicianAppBaseUrl}/auth/technician/signin${q}`,
      secondaryRoute: `${technicianAppBaseUrl}/auth/technician/signup${q}`,
      primaryLabel: 'LOGIN',
      secondaryLabel: 'Join Network',
      iconGradient: 'from-indigo-400 to-purple-600',
      shadowColor: 'shadow-purple-500/30',
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
        </svg>
      )
    },
    {
      key: 'vendor',
      label: 'VENDOR',
      desc: 'Scale your business. Manage multi-warehouse inventory and fulfill spare parts orders seamlessly.',
      primaryRoute: `${vendorAppBaseUrl}/auth/vendor/signin${q}`,
      secondaryRoute: `${vendorAppBaseUrl}/auth/vendor/signup${q}`,
      primaryLabel: 'LOGIN',
      secondaryLabel: 'Register',
      iconGradient: 'from-cyan-400 to-blue-500',
      shadowColor: 'shadow-cyan-500/30',
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1v1H9V7zm5 0h1v1h-1V7zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1zm-3 4H2v5h15v-5z" />
        </svg>
      )
    },
    {
      key: 'admin',
      label: 'ADMIN',
      desc: 'Access the system control panel to monitor platform health, verify users, and manage payments.',
      primaryRoute: `${adminAppBaseUrl}/admin/login${q}`,
      secondaryRoute: '',
      primaryLabel: 'LOGIN',
      secondaryLabel: '',
      iconGradient: 'from-slate-600 to-slate-800',
      shadowColor: 'shadow-slate-500/30',
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    },
  ]

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:p-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-slate-800 dark:text-white">
            Choose Your <span className="italic pr-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-500">ROLE</span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Entry intent: <span className="font-semibold text-blue-600 dark:text-blue-400 underline decoration-blue-300 dark:decoration-blue-700 underline-offset-4">{intent === 'help' ? 'Get Roadside Help' : 'Login Options'}</span>. Select a pathway to enter your specialized workspace.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {roleCards.map((role) => (
            <div
              key={role.key}
              className="group relative flex flex-col justify-between overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/50 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-300/50 dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none dark:hover:border-slate-700 dark:backdrop-blur-md"
            >
              <div className={`absolute -top-6 -left-6 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity group-hover:opacity-20 dark:group-hover:opacity-10 bg-gradient-to-br ${role.iconGradient}`} />
              
              <div className="relative z-10 flex flex-col flex-1">
                <div className={`mb-8 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${role.iconGradient} shadow-lg ${role.shadowColor}`}>
                  {role.icon}
                </div>
                
                <h2 className="mb-3 text-2xl font-extrabold tracking-widest text-slate-800 dark:text-white uppercase">
                  {role.label}
                </h2>
                
                <p className="mb-8 text-sm leading-relaxed text-slate-500 dark:text-slate-400 flex-1">
                  {role.desc}
                </p>
              </div>

              <div className="relative z-10 mt-auto flex flex-col gap-3">
                <a
                  href={role.primaryRoute}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-4 text-sm font-extrabold tracking-wide text-white shadow-xl shadow-blue-500/20 transition-colors hover:bg-blue-700 active:scale-95 dark:bg-white dark:text-slate-900 dark:shadow-white/10 dark:hover:bg-slate-100"
                >
                  {role.primaryLabel} 
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </a>
                
                {role.secondaryRoute ? (
                  <a
                    href={role.secondaryRoute}
                    className="flex w-full items-center justify-center rounded-xl border-2 border-slate-100 bg-transparent px-4 py-3.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/50 active:scale-95"
                  >
                    {role.secondaryLabel}
                  </a>
                ) : (
                  <div className="h-[52px]" />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 flex justify-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border-2 border-slate-200 bg-white px-6 py-3 text-xs font-bold uppercase tracking-widest text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            RETURN TO LANDING
          </Link>
        </div>
      </div>
    </div>
  )
}

export default RoleSelectionPage
