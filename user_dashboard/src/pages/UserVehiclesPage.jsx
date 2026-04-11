import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import {
  addVehicle,
  ApiError,
  deleteVehicle,
  getMyVehicles,
  getVehicleCompanies,
  getModelsByCompany,
  getVariantsByModel,
  updateVehicle,
  userLogout,
} from '../lib/api'
import { clearAuth } from '../store/authSlice'
import { ListSkeleton } from '../components/Skeleton'
import MobileNav from '../components/MobileNav'
import {
  createEmptyErrors,
  REGISTRATION_REGEX,
  VIN_REGEX,
  sanitizeUppercaseAlphaNumeric,
  sanitizeUppercaseRegistration,
  useFirstErrorFocus,
} from '../lib/formValidation'
import RequiredAsterisk from '../components/RequiredAsterisk'

/* ═══════════════════════════════════════════════════════════
   Searchable Dropdown Component
   ═══════════════════════════════════════════════════════════ */
function SearchableDropdown({ label, placeholder, items, displayKey, valueKey, value, onSelect, onSearch, disabled, emptyText, inputRef, onBlur, required = false }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)
  const searchTimer = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => { return () => clearTimeout(searchTimer.current) }, [])

  const handleInput = (e) => {
    const q = e.target.value
    setQuery(q)
    if (value) onSelect(null)
    if (onSearch) {
      clearTimeout(searchTimer.current)
      searchTimer.current = setTimeout(() => onSearch(q), 300)
    }
    setOpen(true)
  }

  const handlePick = (item) => {
    setQuery(item[displayKey])
    setOpen(false)
    onSelect(item)
  }

  const filtered = useMemo(() => {
    if (onSearch) return items
    if (!query.trim()) return items
    return items.filter(i => i[displayKey].toLowerCase().includes(query.toLowerCase()))
  }, [items, query, displayKey, onSearch])

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">
        {label}
        {required && <RequiredAsterisk />}
      </label>
      <div className="relative group">
        <input
          type="text"
          ref={inputRef}
          value={value ? value[displayKey] : query}
          onChange={handleInput}
          onBlur={onBlur}
          onFocus={() => { if (!disabled) { setOpen(true); if (onSearch && items.length === 0) onSearch('') } }}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 text-[11px] font-bold outline-none focus:border-blue-500 transition-all placeholder:text-slate-400 placeholder:font-medium ${disabled ? 'cursor-not-allowed opacity-40 bg-slate-50 dark:bg-slate-950' : 'group-hover:border-slate-400'}`}
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            onClick={() => { onSelect(null); setQuery(''); setOpen(false) }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" diff-content d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>
      {open && !disabled && (
        <div className="absolute z-50 mt-2 w-full max-h-64 overflow-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl py-2 animate-in fade-in slide-in-from-top-2">
          {filtered.length > 0 ? filtered.map((item) => (
            <div
              key={item[valueKey]}
              onClick={() => handlePick(item)}
              className="px-5 py-3 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600 transition-all cursor-pointer"
            >
              {item[displayKey]}
            </div>
          )) : query && (
            <div className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
              {emptyText || 'No results found'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function UserVehiclesPage({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const fieldOrder = ['variant_id', 'registration_number', 'vin_number']
  const { registerField, focusFirst } = useFirstErrorFocus(fieldOrder)

  const [vehicles, setVehicles] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingVehicleId, setEditingVehicleId] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [companies, setCompanies] = useState([])
  const [models, setModels] = useState([])
  const [variants, setVariants] = useState([])

  const [selectedCompany, setSelectedCompany] = useState(null)
  const [selectedModel, setSelectedModel] = useState(null)
  const [selectedVariant, setSelectedVariant] = useState(null)

  const [form, setForm] = useState({ registration_number: '', vin_number: '' })
  const [errors, setErrors] = useState(createEmptyErrors(fieldOrder))

  const canSubmit = useMemo(() => selectedVariant && form.registration_number.trim(), [selectedVariant, form])

  const loadVehicles = async () => {
    const response = await getMyVehicles()
    setVehicles(response?.vehicles || [])
  }

  const loadCompanies = useCallback(async (query = '') => { try { const resp = await getVehicleCompanies({ query }); setCompanies(resp?.companies || []) } catch { setCompanies([]) } }, [])
  const loadModels = useCallback(async (cid, query = '') => { try { const resp = await getModelsByCompany(cid, { query }); setModels(resp?.models || []) } catch { setModels([]) } }, [])
  const loadVariants = useCallback(async (mid) => { try { const resp = await getVariantsByModel(mid); setVariants(resp?.variants || []) } catch { setVariants([]) } }, [])

  const initializePage = useCallback(async () => {
    setIsLoading(true); setError('')
    try { await Promise.all([loadVehicles(), loadCompanies()]) }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Could not load your vehicles right now.') }
    finally { setIsLoading(false) }
  }, [loadCompanies])

  useEffect(() => { initializePage() }, [initializePage])

  const handleSelectCompany = (company) => {
    setSelectedCompany(company); setSelectedModel(null); setSelectedVariant(null)
    setErrors(p => ({ ...p, variant_id: '', form: '' })); setModels([]); setVariants([])
    if (company) loadModels(company.company_id)
  }

  const handleSelectModel = (model) => {
    setSelectedModel(model); setSelectedVariant(null)
    setErrors(p => ({ ...p, variant_id: '', form: '' })); setVariants([])
    if (model) loadVariants(model.model_id)
  }

  const handleSelectVariant = (v) => { setSelectedVariant(v); setErrors(p => ({ ...p, variant_id: '', form: '' })) }

  const resetForm = () => {
    setForm({ registration_number: '', vin_number: '' })
    setErrors(createEmptyErrors(fieldOrder))
    setSelectedCompany(null); setSelectedModel(null); setSelectedVariant(null)
    setModels([]); setVariants([]); setEditingVehicleId(null)
  }

  const startEdit = async (vehicle) => {
    setEditingVehicleId(vehicle.vehicle_id)
    setForm({ registration_number: vehicle.registration_number || '', vin_number: vehicle.vin_number || '' })
    const company = vehicle.variant?.model?.company
    const model = vehicle.variant?.model
    const variant = vehicle.variant

    if (company) { setSelectedCompany({ company_id: company.company_id, company_name: company.company_name }); await loadModels(company.company_id) }
    if (model) { setSelectedModel({ model_id: model.model_id, model_name: model.model_name }); await loadVariants(model.model_id) }
    if (variant) {
      const displayName = `${variant.variant_name}${variant.year ? ` (${variant.year})` : ''}`
      setSelectedVariant({ variant_id: variant.variant_id, variant_name: variant.variant_name, year: variant.year, displayName })
    }
    setMessage(''); setError(''); setErrors(createEmptyErrors(fieldOrder))
  }

  const getErrors = (values = form, variant = selectedVariant) => {
    const nextErrors = createEmptyErrors(fieldOrder)
    if (!variant?.variant_id) nextErrors.variant_id = 'REQUIRED: SELECT VARIANT'
    if (!values.registration_number.trim()) nextErrors.registration_number = 'REQUIRED: ENTER PLATE NO'
    else if (!REGISTRATION_REGEX.test(values.registration_number.trim())) nextErrors.registration_number = 'INVALID: REGISTRATION FORMAT'
    if (values.vin_number && !VIN_REGEX.test(values.vin_number.trim())) nextErrors.vin_number = 'INVALID: VIN MUST BE 17 CHARS'
    return nextErrors
  }

  const validateField = (field, v = form, vr = selectedVariant) => {
    const nextErrors = getErrors(v, vr)
    setErrors(p => ({ ...p, [field]: nextErrors[field], form: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const nextErrors = getErrors()
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) { focusFirst(nextErrors); return }
    setIsSubmitting(true); setMessage(''); setError('')
    try {
      const payload = { variant_id: Number(selectedVariant.variant_id), registration_number: form.registration_number.trim().toUpperCase() }
      if (form.vin_number.trim()) payload.vin_number = form.vin_number.trim().toUpperCase()
      if (editingVehicleId) { await updateVehicle(editingVehicleId, payload); setMessage('Vehicle details updated.') }
      else { await addVehicle(payload); setMessage('Vehicle added successfully.') }
      await loadVehicles(); resetForm()
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not save the vehicle details.') }
    finally { setIsSubmitting(false) }
  }

  const handleDelete = async (vid) => {
    if (!window.confirm('Remove this vehicle from your list?')) return
    setMessage(''); setError('')
    try { await deleteVehicle(vid); setMessage('Vehicle deleted.'); await loadVehicles(); if (editingVehicleId === vid) resetForm() }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to remove vehicle.') }
  }

  const handleLogout = async () => { await userLogout().catch(() => null); dispatch(clearAuth()); navigate('/auth/user/signin') }
  const getVDisplayName = (v) => v ? `${v.variant_name}${v.year ? ` (${v.year})` : ''}${v.fuel_type ? ` · ${v.fuel_type}` : ''}` : ''

  const variantItems = useMemo(() => variants.map(v => ({ ...v, displayName: getVDisplayName(v) })), [variants])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 transition-colors duration-500 pb-20">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Floating Header */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-6">
           <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/dashboard')}
                className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-500 transition-all shadow-sm"
              >
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div>
                 <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">YOUR VEHICLES</span>
                 <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-tight">My Vehicles</h1>
              </div>
           </div>

           <div className="flex items-center gap-3">
             <button onClick={onToggleTheme} className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center transition-all hover:border-slate-400">
                {theme === 'dark' ? '🌞' : '🌙'}
             </button>
             <button onClick={handleLogout} className="px-5 py-2.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black tracking-widest uppercase active:scale-95 transition-all shadow-lg">
                LOGOUT
             </button>
           </div>
        </header>

        {error && <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-top-4">⚠️ {error}</div>}
        {message && <div className="mb-6 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-top-4">ℹ️ {message}</div>}

        <section className="mb-8 rounded-[32px] border border-blue-500/15 bg-white/80 p-6 shadow-xl backdrop-blur-sm dark:border-blue-500/20 dark:bg-[#0B1120]/60">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-600 dark:text-blue-400">
                Next step
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {vehicles.length > 0 ? 'Continue directly to your service request' : 'Register one vehicle to unlock help requests'}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {vehicles.length > 0
                  ? 'You no longer need to go back to the dashboard first. Use the buttons here to raise a new issue or review your existing requests.'
                  : 'Once you save a vehicle, the request flow becomes available immediately from this page.'}
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <button
                type="button"
                onClick={() => navigate('/requests/new')}
                disabled={vehicles.length === 0}
                className="h-12 rounded-2xl bg-blue-600 px-6 text-[10px] font-black uppercase tracking-[0.22em] text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-800"
              >
                Ask for help
              </button>
              <button
                type="button"
                onClick={() => navigate('/requests')}
                className="h-12 rounded-2xl border border-slate-200 bg-slate-100 px-6 text-[10px] font-black uppercase tracking-[0.22em] text-slate-700 transition-all hover:border-blue-500 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:text-blue-400"
              >
                My help requests
              </button>
            </div>
          </div>
        </section>

        {isLoading ? (
          <ListSkeleton rows={8} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            
            {/* Registration Form Panel */}
            <section className="lg:col-span-5">
               <div className="sticky top-8 p-8 rounded-[40px] bg-white dark:bg-[#0B1120]/50 border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl rounded-full"></div>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-8 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    </span>
                    {editingVehicleId ? 'Edit vehicle' : 'Add a vehicle'}
                  </h2>

                  <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                    <SearchableDropdown
                      label="Vehicle brand"
                      placeholder="e.g. Maruti Suzuki, Toyota..."
                      items={companies}
                      displayKey="company_name"
                      valueKey="company_id"
                      value={selectedCompany}
                      onSelect={handleSelectCompany}
                      onSearch={loadCompanies}
                      emptyText="No brands found"
                    />

                    <SearchableDropdown
                      label="Vehicle Model"
                      placeholder={selectedCompany ? `Select a model from ${selectedCompany.company_name}` : 'Select a brand first'}
                      items={models}
                      displayKey="model_name"
                      valueKey="model_id"
                      value={selectedModel}
                      onSelect={handleSelectModel}
                      onSearch={selectedCompany ? (q) => loadModels(selectedCompany.company_id, q) : undefined}
                      disabled={!selectedCompany}
                      emptyText="NO MODELS DEPLOYED"
                    />

                    <div className="space-y-1">
                    <SearchableDropdown
                      label="Variant"
                      required
                      placeholder={selectedModel ? `Select your ${selectedModel.model_name} variant` : 'Select a model first'}
                        items={variantItems}
                        displayKey="displayName"
                        valueKey="variant_id"
                        value={selectedVariant ? { ...selectedVariant, displayName: selectedVariant.displayName || getVDisplayName(selectedVariant) } : null}
                        onSelect={handleSelectVariant}
                        disabled={!selectedModel}
                        emptyText="No variants found"
                        inputRef={registerField('variant_id')}
                        onBlur={() => validateField('variant_id')}
                      />
                      {errors.variant_id && <p className="text-[9px] font-black text-red-500 uppercase tracking-widest pl-2">⚠ {errors.variant_id}</p>}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">
                        Registration number
                        <RequiredAsterisk />
                      </label>
                      <input 
                        ref={registerField('registration_number')} 
                        value={form.registration_number} 
                        onChange={(e) => { const v = sanitizeUppercaseRegistration(e.target.value); setForm(p => ({ ...p, registration_number: v })); setErrors(p => ({ ...p, registration_number: '', form: '' })) }} 
                        onBlur={() => validateField('registration_number')} 
                        maxLength={20} 
                        placeholder="DL01AB1234"
                        className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 text-[11px] font-bold outline-none focus:border-blue-500 transition-all uppercase placeholder:normal-case font-mono" 
                      />
                      {errors.registration_number && <p className="text-[9px] font-black text-red-500 uppercase tracking-widest pl-2">⚠ {errors.registration_number}</p>}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Chassis / VIN number</label>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">OPTIONAL</span>
                      </div>
                      <input 
                        ref={registerField('vin_number')} 
                        value={form.vin_number} 
                        onChange={(e) => { const v = sanitizeUppercaseAlphaNumeric(e.target.value, 17); setForm(p => ({ ...p, vin_number: v })); setErrors(p => ({ ...p, vin_number: '', form: '' })) }} 
                        onBlur={() => validateField('vin_number')} 
                        maxLength={17} 
                        placeholder="17 ALPHANUMERIC CHARS"
                        className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 text-[11px] font-bold outline-none focus:border-blue-500 transition-all font-mono" 
                      />
                      {errors.vin_number && <p className="text-[9px] font-black text-red-500 uppercase tracking-widest pl-2">⚠ {errors.vin_number}</p>}
                    </div>

                    <div className="pt-8 flex flex-col gap-3">
                       <button 
                         type="submit" 
                         disabled={isSubmitting || !canSubmit} 
                         className="w-full h-14 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 shadow-xl shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-30"
                       >
                         {isSubmitting ? 'Saving vehicle...' : editingVehicleId ? 'SAVE VEHICLE' : 'ADD VEHICLE'}
                       </button>
                       {editingVehicleId && (
                         <button 
                           type="button" 
                           onClick={resetForm} 
                           className="w-full h-14 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                         >
                           CANCEL
                         </button>
                       )}
                    </div>
                  </form>
               </div>
            </section>

            {/* Fleet List Panel */}
            <section className="lg:col-span-7 space-y-6">
               <div className="flex items-center justify-between px-4">
                  <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Saved vehicles</h2>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{vehicles.length} vehicles</span>
               </div>

               {vehicles.length === 0 ? (
                 <div className="py-32 text-center rounded-[40px] border border-dashed border-slate-200 dark:border-slate-800 bg-white/30 dark:bg-slate-900/10">
                    <div className="text-6xl mb-6 opacity-20">🚗</div>
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">No vehicles added yet</h3>
                    <p className="text-xs text-slate-500 mt-2 font-medium">Add your first vehicle to start requesting service assistance.</p>
                 </div>
               ) : (
                 <div className="grid gap-6">
                   {vehicles.map((v) => (
                     <article 
                        key={v.vehicle_id} 
                        className={`p-8 rounded-[40px] bg-white dark:bg-[#0B1120]/50 border transition-all duration-300 relative overflow-hidden group hover:scale-[1.01] ${editingVehicleId === v.vehicle_id ? 'border-blue-500 shadow-blue-500/10' : 'border-slate-200 dark:border-slate-800 shadow-xl'}`}
                     >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-500/5 group-hover:bg-blue-600/5 blur-3xl rounded-full transition-colors"></div>
                        
                        <div className="flex flex-wrap items-start justify-between gap-6 relative z-10">
                           <div className="space-y-4">
                              <div>
                                 <p className="text-[10px] font-black text-blue-600 dark:text-blue-500 uppercase tracking-[0.2em] mb-1">VEHICLE</p>
                                 <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                                    {(v.variant?.model?.company?.company_name || 'GENERIC').toUpperCase()} {(v.variant?.model?.model_name || '').toUpperCase()}
                                 </h3>
                                 <p className="text-[11px] font-bold text-slate-500 uppercase opacity-80">{v.variant?.variant_name} {v.variant?.year && `(${v.variant.year})`}</p>
                              </div>
                              
                              <div className="flex gap-8">
                                 <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">REGISTRATION</p>
                                    <p className="text-sm font-black text-slate-900 dark:text-white font-mono">{v.registration_number}</p>
                                 </div>
                                 {v.vin_number && (
                                    <div>
                                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">VIN NO</p>
                                       <p className="text-sm font-black text-slate-900 dark:text-white font-mono tracking-tighter">{v.vin_number}</p>
                                    </div>
                                 )}
                              </div>

                              <div className="flex flex-wrap gap-2 pt-2">
                                 {v.variant?.fuel_type && <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500 uppercase">{v.variant.fuel_type}</span>}
                                 {v.variant?.transmission && <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500 uppercase">{v.variant.transmission}</span>}
                              </div>
                           </div>

                           <div className="flex flex-col gap-2">
                              <button 
                                onClick={() => startEdit(v)} 
                                className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 hover:text-blue-600 hover:border-blue-500 transition-all active:scale-90"
                                title="Edit Configuration"
                              >
                                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button 
                                onClick={() => handleDelete(v.vehicle_id)} 
                                className="w-12 h-12 rounded-2xl bg-red-500/5 border border-red-500/20 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-90"
                                title="Delete from Fleet"
                              >
                                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                           </div>
                        </div>

                        {editingVehicleId === v.vehicle_id && (
                           <div className="mt-6 pt-6 border-t border-blue-500/20 flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">YOU ARE EDITING THIS VEHICLE</span>
                           </div>
                        )}
                     </article>
                   ))}
                 </div>
               )}
            </section>

          </div>
        )}
      </div>
    </div>
  )
}

export default UserVehiclesPage
