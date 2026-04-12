import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, getVendorProfile, updateVendorProfile } from '../lib/api'
import MobileNav from '../components/MobileNav'
import RequiredAsterisk from '../components/RequiredAsterisk'

const cardClass = 'rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md p-6 sm:p-8 shadow-xl dark:shadow-2xl relative overflow-hidden transition-all duration-300'
const inputClass = 'w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F172A] px-4 py-3 text-sm font-medium outline-none transition-all focus:border-blue-500 focus:bg-white dark:focus:bg-[#0B1120] focus:ring-4 focus:ring-blue-500/10 dark:text-white'
const labelClass = 'mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400'
const errTxtClass = 'mt-1.5 text-[10px] font-bold text-red-500 uppercase tracking-widest'

function Field({ label, value, mono = false, badge = false, badgeColor = '' }) {
  return (
    <div className="flex flex-col gap-1.5 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#0F172A]/50 hover:bg-slate-50 dark:hover:bg-[#0F172A] transition-colors">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {label}
      </span>
      {badge ? (
        <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${badgeColor}`}>
          {value}
        </span>
      ) : (
        <span className={`text-sm font-bold text-slate-900 dark:text-white ${mono ? 'font-mono tracking-wider' : ''}`}>
          {value || <span className="italic text-slate-400 dark:text-slate-500 opacity-60">Not set</span>}
        </span>
      )}
    </div>
  )
}

function Section({ icon, title, children }) {
  return (
    <section className={cardClass}>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xl shadow-inner">
          {icon}
        </div>
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">{title}</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

export default function VendorProfilePage({ theme, onToggleTheme }) {
  const [vendor, setVendor]       = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [editMode, setEditMode]   = useState(false)
  const [isSaving, setIsSaving]   = useState(false)
  const [successMsg, setSuccess]  = useState('')
  const [formErrors, setFErrors]  = useState({})

  const [form, setForm] = useState({
    full_name: '', phone_number: '',
    upi_id: '', bank_account_number: '', bank_ifsc: '', bank_holder_name: '',
  })

  useEffect(() => {
    getVendorProfile()
      .then((res) => {
        setVendor(res.vendor)
        populateForm(res.vendor)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your profile.'))
      .finally(() => setLoading(false))
  }, [])

  const populateForm = (v) => setForm({
    full_name: v.full_name || '',
    phone_number: v.phone_number || '',
    upi_id: v.upi_id || '',
    bank_account_number: v.bank_account_number || '',
    bank_ifsc: v.bank_ifsc || '',
    bank_holder_name: v.bank_holder_name || '',
  })

  const handleChange = (field) => (e) => {
    setForm((p) => ({ ...p, [field]: e.target.value }))
    setFErrors((p) => ({ ...p, [field]: '' }))
    setSuccess('')
  }

  const validate = () => {
    const errs = {}
    if (!form.full_name.trim()) errs.full_name = 'Name is required'
    if (form.phone_number && !/^\d{10}$/.test(form.phone_number))
      errs.phone_number = 'Must be exactly 10 digits'
    if (form.bank_ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.bank_ifsc.toUpperCase()))
      errs.bank_ifsc = 'Invalid IFSC format (e.g. SBIN0001234)'
    setFErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setIsSaving(true)
    setSuccess('')
    try {
      const res = await updateVendorProfile(form)
      setVendor((p) => ({ ...p, ...res.vendor }))
      setEditMode(false)
      setSuccess('Profile saved successfully.')
    } catch (err) {
      setFErrors({ form: err instanceof ApiError ? err.message : 'Failed to update' })
    } finally {
      setIsSaving(false)
    }
  }

  const cancelEdit = () => {
    setEditMode(false)
    populateForm(vendor)
    setFErrors({})
    setSuccess('')
  }

  const initials = vendor?.full_name
    ? vendor.full_name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '??'

  const memberSince = vendor?.created_at
    ? new Date(vendor.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Not available'

  const hasBank = vendor?.bank_account_number || vendor?.bank_ifsc || vendor?.bank_holder_name

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 overflow-x-hidden relative transition-colors duration-500">
      {/* Background Blurs */}
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Floating Header */}
        <header className="mb-8 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md pl-6 pr-1 sm:px-6 py-3 shadow-xl dark:shadow-2xl flex items-center justify-between gap-3 mr-10 sm:mr-0 relative z-[40]">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">Profile</span>
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
          </div>
          <MobileNav>
            <Link to="/dashboard" className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-600 dark:text-slate-300">
              ← Dashboard
            </Link>
            <button type="button" onClick={onToggleTheme} className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm ml-2 text-slate-600 dark:text-slate-300">
              {theme === 'dark' ? '☀ Light' : '☾ Dark'}
            </button>
          </MobileNav>
        </header>

        {error && (
          <div className="mb-6 rounded-[24px] border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-5 text-sm font-medium text-red-600 dark:text-red-400 shadow-sm flex items-center gap-3">
            <span className="text-xl">❌</span> {error}
          </div>
        )}
        
        {successMsg && (
          <div className="mb-6 rounded-[24px] border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 p-5 text-sm font-medium text-blue-600 dark:text-blue-400 shadow-sm flex items-center gap-3">
            <span className="text-xl">✅</span> {successMsg}
          </div>
        )}

        {loading && (
          <div className="space-y-6 animate-pulse mt-8">
            <div className="h-64 rounded-[32px] bg-slate-200 dark:bg-slate-800/50" />
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="h-48 rounded-[32px] bg-slate-200 dark:bg-slate-800/50" />
              <div className="h-48 rounded-[32px] bg-slate-200 dark:bg-slate-800/50" />
            </div>
          </div>
        )}

        {vendor && !loading && !editMode && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* Hero Card */}
            <div className={cardClass + " !p-0"}>
              <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500/20 dark:to-indigo-500/20 relative overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.1)_50%,transparent_100%)] dark:bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.05)_50%,transparent_100%)] opacity-50 animate-shimmer"></div>
              </div>
              <div className="px-6 sm:px-8 pb-8 relative z-10">
                <div className="-mt-12 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-24 w-24 items-center justify-center rounded-[24px] border-4 border-white dark:border-[#0B1120] bg-gradient-to-br from-blue-500 to-indigo-600 text-3xl font-black text-white shadow-xl dark:shadow-2xl">
                      {initials}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:pb-2">
                    <button
                      onClick={() => setEditMode(true)}
                      className="whitespace-nowrap rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/20 active:scale-95 transition-all flex items-center gap-2"
                    >
                      <span>✏️</span> Edit Profile
                    </button>
                    <Link
                      to="/change-password"
                      className="whitespace-nowrap rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-slate-700 dark:text-slate-300 shadow-sm flex items-center gap-2 active:scale-95"
                    >
                      <span>🔑</span> Password
                    </Link>
                  </div>
                </div>

                <div className="mt-5">
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                    {vendor.full_name}
                    {vendor.is_active && <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>}
                  </h2>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-1">
                    ✉️ {vendor.email}
                  </p>
                </div>

                <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-2xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#0F172A]/50 p-4 text-center">
                    <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{vendor.warehouse_count ?? 0}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">Locations</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#0F172A]/50 p-4 text-center">
                    <p className="text-lg font-black text-indigo-600 mt-1 truncate">
                      {vendor.role?.toUpperCase()}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">Role</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#0F172A]/50 p-4 text-center">
                    <p className={`text-lg font-black mt-1 whitespace-nowrap ${vendor.is_active ? 'text-teal-600 dark:text-teal-400' : 'text-red-500'}`}>
                      {vendor.is_active ? 'Active' : 'Inactive'}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">Status</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#0F172A]/50 p-4 text-center">
                    <p className={`text-lg font-black mt-1 whitespace-nowrap ${vendor.is_verified ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {vendor.is_verified ? 'Verified' : 'Pending'}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">Verification</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#0F172A]/50 p-4 text-center flex flex-col justify-center items-center">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{memberSince.split(' ')[2]}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">Joined</p>
                  </div>
                </div>
              </div>
            </div>

            {!hasBank && (
              <div className="rounded-[24px] border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 p-5 shadow-sm flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-xl font-bold text-amber-600">
                  ⚠️
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-amber-800 dark:text-amber-400 mb-1">Add payment details</h3>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300/80">
                    Your payment details are missing. Add your UPI ID or bank account so you can receive payments.
                  </p>
                </div>
              </div>
            )}

            <Section icon="👤" title="Account Details">
              <Field label="Full Name" value={vendor.full_name} />
              <Field label="Email Address" value={vendor.email} />
              <Field label="Phone Number" value={vendor.phone_number} />
              <Field label="Member Since" value={memberSince} />
            </Section>

            <Section icon="💳" title="Payment Details">
              <Field label="UPI ID" value={vendor.upi_id} mono />
              <Field label="Account Holder" value={vendor.bank_holder_name} />
              <Field label="Account Number" value={vendor.bank_account_number} mono />
              <Field label="IFSC Code" value={vendor.bank_ifsc} mono />
            </Section>

          </div>
        )}

        {/* Edit Form */}
        {vendor && editMode && (
          <form onSubmit={handleSave} noValidate className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className={cardClass}>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xl shadow-inner">👤</div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Personal Information</h2>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="full_name" className={labelClass}>Full Name<RequiredAsterisk /></label>
                  <input id="full_name" type="text" value={form.full_name} onChange={handleChange('full_name')} className={inputClass} placeholder="Your full name" />
                  {formErrors.full_name && <p className={errTxtClass}>{formErrors.full_name}</p>}
                </div>
                <div>
                  <label htmlFor="phone_number" className={labelClass}>Phone Number</label>
                  <input id="phone_number" type="tel" value={form.phone_number} onChange={handleChange('phone_number')} className={inputClass} placeholder="10-digit mobile number" maxLength={10} />
                  {formErrors.phone_number && <p className={errTxtClass}>{formErrors.phone_number}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Email Address</label>
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800/60 bg-slate-100/50 dark:bg-[#0F172A]/50 px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                    <span className="text-lg">🔒</span> {vendor.email}
                    <span className="ml-auto text-[10px] font-black uppercase tracking-widest opacity-60">Locked</span>
                  </div>
                </div>
              </div>
            </section>

            <section className={cardClass}>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xl shadow-inner">💳</div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Payment Details</h2>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="upi_id" className={labelClass}>UPI ID</label>
                  <input id="upi_id" type="text" value={form.upi_id} onChange={handleChange('upi_id')} className={inputClass + ' font-mono text-sm tracking-wide'} placeholder="e.g. yourname@okaxis" />
                </div>
                <div>
                  <label htmlFor="bank_account_number" className={labelClass}>Bank Account Number</label>
                  <input id="bank_account_number" type="text" value={form.bank_account_number} onChange={handleChange('bank_account_number')} className={inputClass + ' font-mono text-sm tracking-wide'} placeholder="Account number" />
                </div>
                <div>
                  <label htmlFor="bank_ifsc" className={labelClass}>IFSC Code</label>
                  <input
                    id="bank_ifsc"
                    type="text"
                    value={form.bank_ifsc}
                    onChange={(e) => { handleChange('bank_ifsc')({ target: { value: e.target.value.toUpperCase() } }) }}
                    className={inputClass + ' font-mono text-sm tracking-wide'}
                    placeholder="e.g. SBIN0001234"
                    maxLength={11}
                  />
                  {formErrors.bank_ifsc && <p className={errTxtClass}>{formErrors.bank_ifsc}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="bank_holder_name" className={labelClass}>Account Holder Name</label>
                  <input id="bank_holder_name" type="text" value={form.bank_holder_name} onChange={handleChange('bank_holder_name')} className={inputClass} placeholder="Name on the bank account" />
                </div>
              </div>
            </section>

            {formErrors.form && (
              <div className="rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400 flex items-center gap-3 shadow-sm">
                <span className="text-lg">❌</span> {formErrors.form}
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button type="submit" disabled={isSaving} className="flex-1 rounded-[20px] bg-blue-600 py-4 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 disabled:opacity-60 transition-all active:scale-[0.98]">
                {isSaving ? 'Saving...' : 'Save profile'}
              </button>
              <button type="button" onClick={cancelEdit} className="rounded-[20px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-8 py-4 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-[0.98]">
                Cancel
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}

