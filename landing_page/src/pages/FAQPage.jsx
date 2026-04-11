import { Link } from 'react-router-dom'

export default function FAQPage({ theme, onToggleTheme }) {
  const faqs = [
    { q: 'What is Quick Auto Assist?', a: 'Quick Auto Assist is a 24/7 roadside assistance platform that connects stranded vehicle owners with nearby verified technicians for instant repair, towing, and parts supply.' },
    { q: 'How do I request roadside help?', a: 'Click "Get Help Now" on the homepage, sign in or register as a customer, then create a new service request by entering your vehicle details, issue type, and current location.' },
    { q: 'How are technicians matched to my request?', a: 'Our system uses geo-filtering to find technicians within range of your location. Technicians can view your request, submit offers with estimated cost and time, and you choose the best one.' },
    { q: 'Is there an emergency option if I don\'t have an account?', a: 'Yes — use the "Get Rescued" button on the homepage to submit an emergency quick request as a guest. You\'ll receive a reference number and our support team will contact you.' },
    { q: 'How does payment work?', a: 'After the technician completes the job, an invoice is generated. You can view and download your invoice as a PDF from your dashboard. Payment is processed through the platform.' },
    { q: 'Can I track the technician?', a: 'Yes — once a technician accepts your request, you can track their location on the map in your request detail page.' },
    { q: 'How do I become a technician on the platform?', a: 'Click "Join as Technician" on the homepage, fill in your business details, location, and service radius. After admin verification, you can start receiving requests.' },
    { q: 'What if I forget my password?', a: 'Each dashboard (User, Technician, Vendor, Admin) has a "Forgot password?" link on the sign-in page. Enter your email and we\'ll send a reset link valid for 15 minutes.' },
    { q: 'How do vendors participate?', a: 'Vendors manage warehouses and parts inventory. When a technician needs parts for a repair, orders are placed through the vendor system and fulfilled from the nearest warehouse.' },
    { q: 'Is my data secure?', a: 'Yes — we use httpOnly cookies for authentication, helmet security headers, input sanitization, rate limiting, and encrypted passwords. See our Privacy Policy for full details.' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <header className="flex items-center justify-between">
          <Link to="/" className="text-lg font-semibold text-blue-600 dark:text-blue-300">Quick Auto Assist</Link>
          <div className="flex gap-2">
            <button onClick={onToggleTheme} className="rounded-lg border border-slate-300 px-3 py-1 text-xs dark:border-slate-700">
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
            <Link to="/" className="rounded-lg border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">Home</Link>
          </div>
        </header>

        <main className="mt-8">
          <h1 className="text-3xl font-bold tracking-tight">Frequently Asked Questions</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Everything you need to know about Quick Auto Assist.</p>

          <div className="mt-8 space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="group rounded-2xl border border-slate-200 bg-white shadow-sm open:shadow-md dark:border-slate-800 dark:bg-slate-900">
                <summary className="cursor-pointer select-none px-5 py-4 text-sm font-semibold transition group-open:text-blue-600 dark:group-open:text-blue-300">
                  {faq.q}
                </summary>
                <div className="border-t border-slate-100 px-5 py-4 text-sm leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-300">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </main>

        <footer className="mt-12 flex flex-wrap gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800">
          <Link to="/" className="hover:text-slate-900 dark:hover:text-white">Home</Link>
          <Link to="/terms" className="hover:text-slate-900 dark:hover:text-white">Terms of Service</Link>
          <Link to="/privacy" className="hover:text-slate-900 dark:hover:text-white">Privacy Policy</Link>
        </footer>
      </div>
    </div>
  )
}
