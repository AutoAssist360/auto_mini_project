import { Link } from 'react-router-dom'

export default function PrivacyPage({ theme, onToggleTheme }) {
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
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Last updated: March 4, 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">1. Information We Collect</h2>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li><strong>Account information:</strong> Name, email, phone number, and role when you register.</li>
                <li><strong>Vehicle data:</strong> Registration number, VIN, and vehicle variant details for service requests.</li>
                <li><strong>Location data:</strong> GPS coordinates when you create a service request or when technicians update their availability.</li>
                <li><strong>Transaction data:</strong> Invoice details, payment references, and order history.</li>
                <li><strong>Usage data:</strong> Pages visited, features used, timestamps, and device information.</li>
              </ul>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">2. How We Use Your Information</h2>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>To match customers with nearby technicians using geo-filtering.</li>
                <li>To process service requests, offers, jobs, and invoices.</li>
                <li>To send transactional emails (password resets, order confirmations, emergency alerts).</li>
                <li>To display analytics and audit logs for admin oversight.</li>
                <li>To improve platform performance and user experience.</li>
              </ul>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">3. Data Security</h2>
              <p className="mt-2">We implement the following security measures to protect your data:</p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li><strong>Authentication:</strong> httpOnly cookies with secure JWT tokens — no sensitive data stored in localStorage.</li>
                <li><strong>Passwords:</strong> Hashed with bcrypt (10 salt rounds) — we never store plaintext passwords.</li>
                <li><strong>Transport:</strong> Helmet security headers on every response and CORS restricted to authorized origins.</li>
                <li><strong>Input validation:</strong> All inputs validated via Zod schemas and sanitized to prevent XSS attacks.</li>
                <li><strong>Rate limiting:</strong> API and auth endpoints are rate-limited to prevent brute-force attacks.</li>
              </ul>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">4. Data Sharing</h2>
              <p className="mt-2">We do not sell your personal data. Information is shared only as necessary:</p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>Between customers and technicians during active service requests (name, location, phone).</li>
                <li>Between technicians and vendors for parts ordering.</li>
                <li>With admin users for platform oversight and audit compliance.</li>
                <li>If required by law or legal process.</li>
              </ul>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">5. Cookies</h2>
              <p className="mt-2">We use httpOnly cookies for session management (access and refresh tokens). We also use localStorage to persist your theme preference (dark/light mode). We do not use third-party tracking cookies.</p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">6. Your Rights</h2>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li><strong>Access:</strong> View all your personal data through your dashboard profile page.</li>
                <li><strong>Correction:</strong> Update your name, phone number, and other details from your profile.</li>
                <li><strong>Deletion:</strong> Request account deletion through admin support. Soft-deleted accounts are retained for audit purposes.</li>
                <li><strong>Password:</strong> Change your password at any time via the "Change Password" feature.</li>
              </ul>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">7. Data Retention</h2>
              <p className="mt-2">Active account data is retained as long as your account exists. Completed job and invoice records are retained for accounting and audit purposes. Inventory reservations expire automatically after the configured timeout (cleaned every 5 minutes). Deleted accounts are soft-deleted and retained for compliance.</p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">8. Contact Us</h2>
              <p className="mt-2">For privacy-related inquiries, contact us at <strong>support@quickautoassist.com</strong> or call <strong>+91 90000 00000</strong>.</p>
            </section>
          </div>
        </main>

        <footer className="mt-12 flex flex-wrap gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800">
          <Link to="/" className="hover:text-slate-900 dark:hover:text-white">Home</Link>
          <Link to="/faq" className="hover:text-slate-900 dark:hover:text-white">FAQ</Link>
          <Link to="/terms" className="hover:text-slate-900 dark:hover:text-white">Terms of Service</Link>
        </footer>
      </div>
    </div>
  )
}
