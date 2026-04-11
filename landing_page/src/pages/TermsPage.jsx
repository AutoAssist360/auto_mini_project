import { Link } from 'react-router-dom'

export default function TermsPage({ theme, onToggleTheme }) {
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
          <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Last updated: March 4, 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">1. Acceptance of Terms</h2>
              <p className="mt-2">By accessing or using the Quick Auto Assist platform ("Service"), you agree to be bound by these Terms of Service. If you do not agree, you must not use the Service.</p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">2. Service Description</h2>
              <p className="mt-2">Quick Auto Assist provides a technology platform that connects vehicle owners with roadside assistance technicians and parts vendors. We act solely as an intermediary and do not directly provide repair, towing, or parts services.</p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">3. User Accounts</h2>
              <p className="mt-2">You must provide accurate, complete, and current information when creating an account. You are responsible for maintaining the confidentiality of your credentials and for all activities under your account. Users may register as Customers, Technicians, or Vendors. Admin accounts are provisioned manually.</p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">4. Service Requests & Offers</h2>
              <p className="mt-2">Customers submit service requests describing their vehicle issue and location. Technicians may respond with offers including estimated cost and time. Acceptance of an offer creates a binding agreement between the customer and technician. Quick Auto Assist is not a party to this agreement.</p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">5. Payments & Invoicing</h2>
              <p className="mt-2">All payments are processed through the platform. Invoices are generated upon job completion. Refunds are subject to review and may be initiated by the admin team. Users are responsible for verifying invoice accuracy before payment.</p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">6. Technician Obligations</h2>
              <p className="mt-2">Technicians must maintain valid certifications, provide honest cost estimates, and complete accepted jobs in a timely manner. Technician accounts are subject to admin verification. We reserve the right to suspend accounts that violate quality standards.</p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">7. Vendor Obligations</h2>
              <p className="mt-2">Vendors must maintain accurate inventory records and fulfill part orders promptly. Expired reservations are automatically released. Vendors are responsible for the quality of parts supplied.</p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">8. Limitation of Liability</h2>
              <p className="mt-2">Quick Auto Assist provides the platform "as is" without warranties. We are not liable for the quality of repairs, part defects, delays, or any direct or indirect damages arising from the use of the Service. Our total liability shall not exceed the fees paid to the platform.</p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">9. Termination</h2>
              <p className="mt-2">We may suspend or terminate your account at our discretion for violation of these terms, fraudulent activity, or prolonged inactivity. You may delete your account at any time through the platform.</p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">10. Contact</h2>
              <p className="mt-2">For questions about these Terms, contact us at <strong>support@quickautoassist.com</strong> or call our helpline at <strong>+91 90000 00000</strong>.</p>
            </section>
          </div>
        </main>

        <footer className="mt-12 flex flex-wrap gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800">
          <Link to="/" className="hover:text-slate-900 dark:hover:text-white">Home</Link>
          <Link to="/faq" className="hover:text-slate-900 dark:hover:text-white">FAQ</Link>
          <Link to="/privacy" className="hover:text-slate-900 dark:hover:text-white">Privacy Policy</Link>
        </footer>
      </div>
    </div>
  )
}
