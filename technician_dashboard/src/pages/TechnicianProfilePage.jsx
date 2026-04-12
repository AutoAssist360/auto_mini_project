import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { setAuthUser } from '../store/authSlice'
import {
  getTechnicianProfile,
  updateTechnicianProfile,
  addCertification,
  deleteCertification,
  addCarSupport,
  deleteCarSupport,
  addPartSkill,
  deletePartSkill,
  addResource,
  deleteResource,
  getCatalogCompanies,
  getCatalogVariants,
  getCatalogParts,
  ApiError,
} from '../lib/api'
import LocationPicker from '../components/LocationPicker'
import { ListSkeleton } from '../components/Skeleton'
import { useToast } from '../components/toastContext'
import RequiredAsterisk from '../components/RequiredAsterisk'
import { formatLabel } from '../lib/displayText'

export default function TechnicianProfilePage({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [profileData, setProfileData] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    business_name: '',
    location: '',
    latitude: '',
    longitude: '',
    service_radius: '',
    technician_type: 'individual',
    upi_id: '',
    bank_account_number: '',
    bank_ifsc: '',
    bank_holder_name: '',
  })

  const [certForm, setCertForm] = useState({
    certification: '',
    issued_by: '',
    issue_date: '',
    expiry_date: '',
  })
  const [addingCert, setAddingCert] = useState(false)
  const [showCertForm, setShowCertForm] = useState(false)

  // ── Car Support state ──
  const [carCompanies, setCarCompanies] = useState([])
  const [carVariants, setCarVariants] = useState([])
  const [carSupportForm, setCarSupportForm] = useState({ company_id: '', variant_id: '' })
  const [showCarSupportForm, setShowCarSupportForm] = useState(false)
  const [addingSupport, setAddingSupport] = useState(false)

  // ── Part Skills state ──
  const [catalogParts, setCatalogParts] = useState([])
  const [partSkillForm, setPartSkillForm] = useState({ part_id: '' })
  const [showPartSkillForm, setShowPartSkillForm] = useState(false)
  const [addingSkill, setAddingSkill] = useState(false)

  // ── Resources state ──
  const [resourceForm, setResourceForm] = useState({ resource_type: '', description: '' })
  const [showResourceForm, setShowResourceForm] = useState(false)
  const [addingResource, setAddingResource] = useState(false)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getTechnicianProfile()
      const p = res?.profile
      setProfileData(p)
      dispatch(setAuthUser(p))
      setForm({
        business_name: p?.business_name || '',
        location: p?.location || '',
        latitude: String(p?.latitude ?? ''),
        longitude: String(p?.longitude ?? ''),
        service_radius: String(p?.service_radius ?? ''),
        technician_type: p?.technician_type || 'individual',
        upi_id: p?.user?.upi_id || '',
        bank_account_number: p?.user?.bank_account_number || '',
        bank_ifsc: p?.user?.bank_ifsc || '',
        bank_holder_name: p?.user?.bank_holder_name || '',
      })
    } catch {
      setError('Could not load your profile.')
    } finally {
      setLoading(false)
    }
  }, [dispatch])

  useEffect(() => { loadProfile() }, [loadProfile])

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const payload = {}
      if (form.business_name) payload.business_name = form.business_name
      if (form.location) payload.location = form.location
      if (form.latitude) payload.latitude = Number(form.latitude)
      if (form.longitude) payload.longitude = Number(form.longitude)
      if (form.service_radius) payload.service_radius = Number(form.service_radius)
      if (form.technician_type) payload.technician_type = form.technician_type
      payload.upi_id = form.upi_id.trim() || null
      payload.bank_account_number = form.bank_account_number.trim() || null
      payload.bank_ifsc = form.bank_ifsc.trim() || null
      payload.bank_holder_name = form.bank_holder_name.trim() || null

      const res = await updateTechnicianProfile(payload)
      // Use fresh profile returned by the PUT endpoint directly
      const p = res?.profile
      if (p) {
        setProfileData(p)
        dispatch(setAuthUser(p))
        setForm({
          business_name: p?.business_name || '',
          location: p?.location || '',
          latitude: String(p?.latitude ?? ''),
          longitude: String(p?.longitude ?? ''),
          service_radius: String(p?.service_radius ?? ''),
          technician_type: p?.technician_type || 'individual',
          upi_id: p?.user?.upi_id || '',
          bank_account_number: p?.user?.bank_account_number || '',
          bank_ifsc: p?.user?.bank_ifsc || '',
          bank_holder_name: p?.user?.bank_holder_name || '',
        })
      } else {
        // Fallback: refetch if response didn't include profile
        await loadProfile()
      }
      setMessage('Profile saved successfully.')
      toast.success('Profile saved successfully.')
      setEditMode(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleAddCert = async () => {
    setAddingCert(true)
    setError('')
    try {
      await addCertification({
        certification: certForm.certification,
        issued_by: certForm.issued_by,
        issue_date: new Date(certForm.issue_date).toISOString(),
        ...(certForm.expiry_date ? { expiry_date: new Date(certForm.expiry_date).toISOString() } : {}),
      })
      setCertForm({ certification: '', issued_by: '', issue_date: '', expiry_date: '' })
      setShowCertForm(false)
      setMessage('Certification added')
      await loadProfile()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add certification')
    } finally {
      setAddingCert(false)
    }
  }

  const handleDeleteCert = async (certId) => {
    if (!confirm('Delete this certification?')) return
    try {
      await deleteCertification(certId)
      await loadProfile()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete certification')
    }
  }

  // ── Car Supports handlers ──

  const openCarSupportForm = async () => {
    setShowCarSupportForm(true)
    try {
      const res = await getCatalogCompanies()
      setCarCompanies(res.companies || [])
    } catch { /* ignore */ }
  }

  const loadVariants = async (companyId) => {
    if (!companyId) { setCarVariants([]); return }
    try {
      const res = await getCatalogVariants(companyId)
      setCarVariants(res.variants || [])
    } catch { /* ignore */ }
  }

  const handleAddCarSupport = async () => {
    setAddingSupport(true); setError('')
    try {
      const payload = { company_id: Number(carSupportForm.company_id) }
      if (carSupportForm.variant_id) payload.variant_id = Number(carSupportForm.variant_id)
      await addCarSupport(payload)
      setCarSupportForm({ company_id: '', variant_id: '' })
      setShowCarSupportForm(false)
      setMessage('Car support added')
      await loadProfile()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add car support')
    } finally { setAddingSupport(false) }
  }

  const handleDeleteCarSupport = async (supportId) => {
    if (!confirm('Remove this car support?')) return
    try { await deleteCarSupport(supportId); await loadProfile() }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Failed to remove car support') }
  }

  // ── Part Skills handlers ──

  const openPartSkillForm = async () => {
    setShowPartSkillForm(true)
    try {
      const res = await getCatalogParts()
      setCatalogParts(res.parts || [])
    } catch { /* ignore */ }
  }

  const handleAddPartSkill = async () => {
    setAddingSkill(true); setError('')
    try {
      await addPartSkill({ part_id: Number(partSkillForm.part_id) })
      setPartSkillForm({ part_id: '' })
      setShowPartSkillForm(false)
      setMessage('Part skill added')
      await loadProfile()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add part skill')
    } finally { setAddingSkill(false) }
  }

  const handleDeletePartSkill = async (skillId) => {
    if (!confirm('Remove this part skill?')) return
    try { await deletePartSkill(skillId); await loadProfile() }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Failed to remove part skill') }
  }

  // ── Resources handlers ──

  const handleAddResource = async () => {
    setAddingResource(true); setError('')
    try {
      await addResource(resourceForm)
      setResourceForm({ resource_type: '', description: '' })
      setShowResourceForm(false)
      setMessage('Resource added')
      await loadProfile()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add resource')
    } finally { setAddingResource(false) }
  }

  const handleDeleteResource = async (resourceId) => {
    if (!confirm('Remove this resource?')) return
    try {
      await deleteResource(resourceId)
      await loadProfile()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove resource')
    }
  }

  const user = profileData?.user
  const userInitials = user?.full_name ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : 'T'

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-[#030712] text-slate-100' : 'bg-slate-50 text-slate-900'} font-['Outfit',_sans-serif] transition-colors duration-500 relative overflow-x-hidden pb-20`}>
      {/* Background Blurs */}
      <div className="fixed top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-5%] left-[-10%] w-[45%] h-[45%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-5%] right-[-10%] w-[45%] h-[45%] bg-indigo-600/5 dark:bg-indigo-600/15 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Floating Header */}
        <header className="mb-8 rounded-[32px] sm:rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-6 py-3 shadow-xl dark:shadow-2xl flex flex-wrap gap-4 items-center justify-between transition-all sticky top-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">My Profile</h1>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <button onClick={onToggleTheme} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
              {theme === 'dark' ? '🌞' : '🌙'}
            </button>
          </div>
        </header>

        {message && (
          <div className="mb-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 backdrop-blur-md px-4 py-3 text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest text-center animate-in fade-in slide-in-from-top-4">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 backdrop-blur-md px-4 py-3 text-xs font-black text-red-500 uppercase tracking-widest text-center animate-in fade-in slide-in-from-top-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-20 flex items-center justify-center">
             <ListSkeleton />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            {/* LEFT COLUMN: Main Info */}
            <div className="lg:col-span-12 grid gap-6 lg:grid-cols-2">
              <section className="rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-8 shadow-xl dark:shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                <div className="flex items-center gap-6 mb-8">
                  <div className="w-20 h-20 rounded-3xl bg-blue-600 flex items-center justify-center text-3xl font-black text-white shadow-2xl shadow-blue-500/30">
                    {userInitials}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mb-2">{user?.full_name}</h2>
                    <div className="flex gap-2">
                      <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest leading-none">Technician ID: 00{profileData?.technician_id}</span>
                      {profileData?.is_verified && <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-600 uppercase tracking-widest leading-none">Verified</span>}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  {[
                    { icon: '✉️', label: 'EMAIL', value: user?.email },
                    { icon: '📞', label: 'MOBILE', value: user?.phone_number },
                    { icon: '⭐', label: 'RATING', value: `${profileData?.rating || '0.0'} (${profileData?.total_reviews || 0} REVIEWS)` }
                  ].map((it, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/50">
                      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{it.label}</span>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{it.value}</span>
                    </div>
                  ))}
                </div>

                <Link to="/change-password" title="Change password" 
                  className="mt-8 w-full h-14 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl">
                  Change password
                </Link>
              </section>

              {/* PAYMENT DETAILS */}
              <section className="rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-8 shadow-xl dark:shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-2xl">💰</div>
                  {!editMode && (
                    <button type="button" onClick={() => setEditMode(true)} className="px-6 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">Edit payment details</button>
                  )}
                </div>

                <div className="mb-4">
                   <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-1">Payment details</h3>
                   <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Add where you want to receive your earnings.</p>
                </div>

                {editMode ? (
                  <div className="grid gap-4 mt-6">
                    {['upi_id', 'bank_account_number', 'bank_ifsc', 'bank_holder_name'].map(k => (
                       <div key={k} className="space-y-1.5">
                         <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">{k.replace(/_/g, ' ')}</label>
                         <input value={form[k]} onChange={handleChange(k)} className="w-full h-12 bg-white/50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-4 text-xs font-bold outline-none focus:border-blue-500 transition-all" />
                       </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {[
                      { l: 'UPI ID', v: user?.upi_id || 'Not added', hl: !!user?.upi_id },
                      { l: 'Account number', v: user?.bank_account_number || 'Not added', hl: !!user?.bank_account_number },
                      { l: 'Bank IFSC', v: user?.bank_ifsc || 'Not added' },
                    ].map((it, i) => (
                      <div key={i} className={`p-4 rounded-2xl border ${it.hl ? 'border-emerald-500/10 bg-emerald-500/5' : 'border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/40'}`}>
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">{it.l}</span>
                         <span className={`text-xs font-bold ${it.hl ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>{it.v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* PROFESSIONAL SPECIFICATIONS */}
            <section className="lg:col-span-12 rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-8 shadow-xl dark:shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-10">
                   <div>
                      <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mb-2">Service details</h2>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Update your work area and service settings.</p>
                   </div>
                   {!editMode && (
                      <button type="button" onClick={() => setEditMode(true)} className="h-12 px-8 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all">Edit service details</button>
                   )}
                </div>

                {editMode ? (
                  <div className="grid gap-8 lg:grid-cols-2">
                    <div className="space-y-6">
                       <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Business Identity</label>
                          <input value={form.business_name} onChange={handleChange('business_name')} className="w-full h-14 bg-white/50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-5 text-sm font-bold outline-none focus:border-blue-500 transition-all" />
                       </div>
                       <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Work type</label>
                          <select value={form.technician_type} onChange={handleChange('technician_type')} className="w-full h-14 bg-white/50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-5 text-sm font-bold outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer">
                             <option value="individual">Independent technician</option>
                             <option value="garage">Garage</option>
                          </select>
                       </div>
                       <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Service radius (km)</label>
                          <input type="number" min="1" value={form.service_radius} onChange={handleChange('service_radius')} className="w-full h-14 bg-white/50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-5 text-sm font-bold outline-none focus:border-blue-500 transition-all" />
                       </div>
                    </div>
                    
                    <div className="space-y-6">
                       <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                          <LocationPicker
                            latitude={form.latitude}
                            longitude={form.longitude}
                            onChange={({ latitude, longitude, address }) => {
                              setForm((prev) => ({
                                ...prev,
                                latitude: String(latitude),
                                longitude: String(longitude),
                                location: address || prev.location,
                              }))
                            }}
                            label="Service location"
                          />
                       </div>
                       <div className="flex gap-4 pt-4">
                          <button type="button" onClick={handleSave} disabled={saving} className="flex-1 h-14 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Save changes</button>
                          <button type="button" onClick={() => setEditMode(false)} className="px-8 h-14 rounded-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900/50 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 hover:text-red-500 transition-all">CANCEL</button>
                       </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mt-6">
                    {[
                      { l: 'Business name', v: profileData?.business_name || 'N/A' },
                      { l: 'Technician type', v: formatLabel(profileData?.technician_type) },
                      { l: 'Service radius', v: `${profileData?.service_radius} km` },
                      { l: 'Coordinates', v: `${profileData?.latitude?.toFixed(4)}, ${profileData?.longitude?.toFixed(4)}` }
                    ].map((it, i) => (
                      <div key={i} className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-white/5">
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">{it.l}</span>
                         <span className="text-sm font-black text-slate-800 dark:text-slate-200">{it.v}</span>
                      </div>
                    ))}
                    <div className="sm:col-span-2 lg:col-span-4 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-white/5">
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Service address</span>
                         <span className="text-sm font-black text-slate-800 dark:text-slate-200 line-clamp-1">{profileData?.location}</span>
                    </div>
                  </div>
                )}
            </section>

            {/* CERTS & SKILLS GRID */}
            <div className="lg:col-span-12 grid gap-6 lg:grid-cols-2">
              {/* CERTIFICATIONS */}
              <section className="rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-8 shadow-xl dark:shadow-2xl relative overflow-hidden group">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Certifications</h2>
                  <button type="button" onClick={() => setShowCertForm(!showCertForm)} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-blue-600 hover:text-white transition-all">
                    {showCertForm ? '×' : '+'}
                  </button>
                </div>

                {showCertForm && (
                  <div className="grid gap-4 mb-8 p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
                    <label className="space-y-2 block">
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Certification Name<RequiredAsterisk /></span>
                      <input placeholder="Certification Name" value={certForm.certification} onChange={(e) => setCertForm((p) => ({ ...p, certification: e.target.value }))} className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 rounded-xl px-4 text-xs font-bold outline-none" />
                    </label>
                    <label className="space-y-2 block">
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Issued by<RequiredAsterisk /></span>
                      <input placeholder="Issued by" value={certForm.issued_by} onChange={(e) => setCertForm((p) => ({ ...p, issued_by: e.target.value }))} className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 rounded-xl px-4 text-xs font-bold outline-none" />
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                       <label className="space-y-2 block">
                         <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Issue Date<RequiredAsterisk /></span>
                         <input type="date" value={certForm.issue_date} onChange={(e) => setCertForm((p) => ({ ...p, issue_date: e.target.value }))} className="h-12 w-full bg-white dark:bg-slate-900 border border-slate-200 rounded-xl px-4 text-xs font-bold" />
                       </label>
                       <label className="space-y-2 block">
                         <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Expiry Date</span>
                         <input type="date" value={certForm.expiry_date} onChange={(e) => setCertForm((p) => ({ ...p, expiry_date: e.target.value }))} className="h-12 w-full bg-white dark:bg-slate-900 border border-slate-200 rounded-xl px-4 text-xs font-bold" />
                       </label>
                    </div>
                    <button type="button" onClick={handleAddCert} disabled={addingCert || !certForm.certification} className="h-12 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-black uppercase tracking-widest shadow-xl">Add certification</button>
                  </div>
                )}

                <div className="space-y-4">
                  {profileData?.certifications?.map((cert) => (
                    <div key={cert.certification_id} className="flex items-center justify-between p-4 rounded-2xl bg-white/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50 hover:border-blue-500/20 transition-all">
                      <div>
                        <p className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">{cert.certification}</p>
                        <p className="text-[10px] font-bold text-slate-400">{cert.issued_by} • {new Date(cert.issue_date).getFullYear()}</p>
                      </div>
                      <button type="button" onClick={() => handleDeleteCert(cert.certification_id)} className="text-[10px] font-black uppercase text-red-500/60 hover:text-red-500">REMOVE</button>
                    </div>
                  ))}
                  {!profileData?.certifications?.length && <p className="text-center py-10 text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-50">No certifications added yet</p>}
                </div>
              </section>

              {/* CAR SUPPORTED */}
              <section className="rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-8 shadow-xl dark:shadow-2xl relative overflow-hidden group">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Supported brands</h2>
                  <button type="button" onClick={() => showCarSupportForm ? setShowCarSupportForm(false) : openCarSupportForm()} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-blue-600 hover:text-white transition-all">{showCarSupportForm ? '×' : '+'}</button>
                </div>

                {showCarSupportForm && (
                  <div className="grid gap-4 mb-8 p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                    <label className="space-y-2 block">
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Choose brand<RequiredAsterisk /></span>
                      <select value={carSupportForm.company_id} onChange={(e) => { setCarSupportForm((p) => ({ ...p, company_id: e.target.value, variant_id: '' })); loadVariants(e.target.value) }} className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 rounded-xl px-4 text-xs font-bold outline-none cursor-pointer">
                        <option value="">Select a brand</option>
                        {carCompanies.map((c) => <option key={c.company_id} value={c.company_id}>{c.company_name?.toUpperCase()}</option>)}
                      </select>
                    </label>
                    <label className="space-y-2 block">
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Variant Scope</span>
                      <select value={carSupportForm.variant_id} onChange={(e) => setCarSupportForm((p) => ({ ...p, variant_id: e.target.value }))} className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 rounded-xl px-4 text-xs font-bold outline-none cursor-pointer">
                        <option value="">All variants</option>
                        {carVariants.map((v) => <option key={v.variant_id} value={v.variant_id}>{v.variant_name?.toUpperCase()}</option>)}
                      </select>
                    </label>
                    <button type="button" onClick={handleAddCarSupport} disabled={addingSupport || !carSupportForm.company_id} className="h-12 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-black uppercase tracking-widest shadow-xl">Add brand support</button>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  {profileData?.carSupports?.map((s) => (
                    <div key={s.support_id} className="flex items-center gap-2 pl-4 pr-3 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:scale-105 transition-all group/chip">
                      {s.company?.company_name} {s.variant ? `» ${s.variant.variant_name}` : ''}
                      <button onClick={() => handleDeleteCarSupport(s.support_id)} className="w-5 h-5 rounded-full hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center text-sm font-light">×</button>
                    </div>
                  ))}
                  {!profileData?.carSupports?.length && <p className="text-center py-10 w-full text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-50">No brands added yet</p>}
                </div>
              </section>

              {/* PART SKILLS */}
              <section className="rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-8 shadow-xl dark:shadow-2xl relative overflow-hidden group">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Parts you can work on</h2>
                    <button type="button" onClick={() => showPartSkillForm ? setShowPartSkillForm(false) : openPartSkillForm()} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-blue-600 hover:text-white transition-all">{showPartSkillForm ? '×' : '+'}</button>
                  </div>

                  {showPartSkillForm && (
                    <div className="grid gap-4 mb-8 p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                      <label className="space-y-2 block">
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Choose part<RequiredAsterisk /></span>
                        <select value={partSkillForm.part_id} onChange={(e) => setPartSkillForm({ part_id: e.target.value })} className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 rounded-xl px-4 text-xs font-bold outline-none cursor-pointer">
                          <option value="">Select a part</option>
                          {catalogParts.map((p) => <option key={p.part_id} value={p.part_id}>{p.part_name?.toUpperCase()}</option>)}
                        </select>
                      </label>
                      <button type="button" onClick={handleAddPartSkill} disabled={addingSkill || !partSkillForm.part_id} className="h-12 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-black uppercase tracking-widest shadow-xl">Add part</button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    {profileData?.partSkills?.map((s) => (
                      <div key={s.skill_id} className="flex items-center gap-2 pl-4 pr-3 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:scale-105 transition-all">
                        {s.part?.part_name}
                        <button onClick={() => handleDeletePartSkill(s.skill_id)} className="w-5 h-5 rounded-full hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center text-sm font-light">×</button>
                      </div>
                    ))}
                    {!profileData?.partSkills?.length && <p className="text-center py-10 w-full text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-50">No parts added yet</p>}
                  </div>
              </section>

              {/* RESOURCES */}
              <section className="rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-8 shadow-xl dark:shadow-2xl relative overflow-hidden group">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Tools and equipment</h2>
                    <button type="button" onClick={() => setShowResourceForm(!showResourceForm)} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-blue-600 hover:text-white transition-all">{showResourceForm ? '×' : '+'}</button>
                  </div>

                  {showResourceForm && (
                     <div className="grid gap-4 mb-8 p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                        <label className="space-y-2 block">
                          <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Tool or equipment<RequiredAsterisk /></span>
                          <input placeholder="Tool or equipment (for example, scanner)" value={resourceForm.resource_type} onChange={(e) => setResourceForm((p) => ({ ...p, resource_type: e.target.value }))} className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 rounded-xl px-4 text-xs font-bold" />
                        </label>
                        <label className="space-y-2 block">
                          <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Short description<RequiredAsterisk /></span>
                          <input placeholder="Short description" value={resourceForm.description} onChange={(e) => setResourceForm((p) => ({ ...p, description: e.target.value }))} className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 rounded-xl px-4 text-xs font-bold" />
                        </label>
                        <button type="button" onClick={handleAddResource} disabled={addingResource || !resourceForm.resource_type} className="h-12 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-black uppercase tracking-widest shadow-xl">Add resource</button>
                     </div>
                  )}

                  <div className="space-y-4">
                    {profileData?.resources?.map((r) => (
                      <div key={r.resource_id} className="flex items-center justify-between p-4 rounded-2xl bg-white/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50 hover:border-blue-500/20 transition-all">
                        <div>
                          <p className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">{r.resource_type}</p>
                          <p className="text-[10px] font-bold text-slate-400">{r.description}</p>
                        </div>
                        <button type="button" onClick={() => handleDeleteResource(r.resource_id)} className="text-[10px] font-black uppercase text-red-500/60 hover:text-red-500">REMOVE</button>
                      </div>
                    ))}
                    {!profileData?.resources?.length && <p className="text-center py-10 w-full text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-50">No tools added yet</p>}
                  </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
