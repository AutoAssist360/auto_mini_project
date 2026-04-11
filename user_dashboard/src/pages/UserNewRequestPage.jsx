import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { createServiceRequest, deleteFile, getMyVehicles, getRankedTechnicians, bookTechnician, userLogout } from '../lib/api'
import { clearAuth } from '../store/authSlice'
import LocationPicker from '../components/LocationPicker'
import FileUploader, { FileGallery } from '../components/FileUploader'
import MobileNav from '../components/MobileNav'
import Breadcrumbs from '../components/Breadcrumbs'
import { createEmptyErrors, useFirstErrorFocus } from '../lib/formValidation'

// ─── Step indicator ────────────────────────────────────────────
function StepBar({ step }) {
  const steps = ['DETAILS', 'CHOOSE HELP', 'DONE']
  return (
    <div className="mb-10 flex items-center justify-between max-w-md mx-auto relative px-2">
      <div className="absolute top-[14px] left-0 w-full h-0.5 bg-slate-200 dark:bg-slate-800 -z-0">
        <div 
          className="h-full bg-blue-600 transition-all duration-500" 
          style={{ width: `${(step / (steps.length - 1)) * 100}%` }}
        />
      </div>
      {steps.map((s, i) => (
        <div key={s} className="relative z-10 flex flex-col items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-black transition-all duration-500 ${
            i < step ? 'bg-blue-600 text-white' :
            i === step ? 'bg-blue-600 text-white ring-4 ring-blue-500/20' :
            'bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-400'
          }`}>
            {i < step ? '✓' : i + 1}
          </div>
          <span className={`text-[9px] font-black tracking-widest uppercase transition-colors duration-300 ${i <= step ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
            {s}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Technician card ───────────────────────────────────────────
function TechCard({ tech, onBook, isBooking }) {
  const stars = Math.round(tech.average_rating || 0)
  const dist = tech.distance_km != null ? `${tech.distance_km.toFixed(1)}km` : '?'
  
  return (
    <div className="group relative rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-5 transition-all hover:border-blue-500/50 hover:shadow-xl hover:-translate-y-1">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl font-bold text-blue-600">
          {tech.user?.full_name?.[0] || 'T'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <h4 className="font-black text-slate-900 dark:text-white truncate uppercase tracking-tight">{tech.user?.full_name || 'Technician'}</h4>
            <span className="text-[10px] font-black text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-full">{dist}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
             <div className="flex text-amber-400 text-xs">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i}>{i < stars ? '★' : '☆'}</span>
                ))}
             </div>
            <span className="text-[10px] font-bold text-slate-500">{tech.total_reviews || 0} reviews</span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
            {tech.experience_years}y experience • {tech.specializations?.[0] || 'General repair'}
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled={isBooking}
        onClick={() => onBook(tech.technician_id)}
        className="mt-4 w-full rounded-2xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white py-2.5 text-xs font-black uppercase tracking-widest hover:bg-blue-600 dark:hover:bg-blue-500 dark:hover:text-white transition-all active:scale-95 disabled:opacity-50"
      >
        {isBooking ? 'SELECTING...' : 'CHOOSE'}
      </button>
    </div>
  )
}

function UserNewRequestPage({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const fieldOrder = ['vehicle_id', 'issue_type', 'issue_description', 'location']
  const { registerField, focusFirst } = useFirstErrorFocus(fieldOrder)

  const [step, setStep] = useState(0)
  const [createdRequestId, setCreatedRequestId] = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [isVehiclesLoading, setIsVehiclesLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState(createEmptyErrors(fieldOrder))
  const [form, setForm] = useState({
    vehicle_id: '',
    issue_description: '',
    issue_type: 'mechanical_failure',
    breakdown_latitude: '',
    breakdown_longitude: '',
    service_location_type: 'roadside',
    requires_towing: false,
  })
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [attachmentError, setAttachmentError] = useState('')
  const [technicians, setTechnicians] = useState([])
  const [techLoading, setTechLoading] = useState(false)
  const [techError, setTechError] = useState('')
  const [bookingTechId, setBookingTechId] = useState(null)
  const [bookError, setBookError] = useState('')

  useEffect(() => {
    const loadVehicles = async () => {
      setIsVehiclesLoading(true)
      try {
        const response = await getMyVehicles()
        const vehicleList = response?.vehicles || []
        setVehicles(vehicleList)
        if (vehicleList.length > 0) {
          setForm(prev => ({ ...prev, vehicle_id: prev.vehicle_id || vehicleList[0].vehicle_id }))
        }
      } catch {
        setErrors(prev => ({ ...prev, form: 'Unable to load vehicles.' }))
      } finally {
        setIsVehiclesLoading(false)
      }
    }
    loadVehicles()
  }, [])

  const canSubmit = useMemo(() => {
    return !isSubmitting && form.vehicle_id && form.issue_description.trim() && form.issue_type
  }, [isSubmitting, form])

  const handleChange = (field) => (event) => {
    const value = field === 'requires_towing' ? event.target.checked : event.target.value
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: '', form: '' }))
  }

  const getErrors = (values = form) => {
    const nextErrors = createEmptyErrors(fieldOrder)
    if (!values.vehicle_id) nextErrors.vehicle_id = 'Please select a vehicle'
    if (!values.issue_type) nextErrors.issue_type = 'Issue type is required'
    if (!values.issue_description.trim()) nextErrors.issue_description = 'Issue description is required'
    if (values.breakdown_latitude === '' || values.breakdown_longitude === '') {
      nextErrors.location = 'Please select a location on the map'
    }
    return nextErrors
  }

  const validateField = (field, values = form) => {
    const nextErrors = getErrors(values)
    setErrors(prev => ({ ...prev, [field]: nextErrors[field], form: '' }))
  }

  const validate = () => {
    const nextErrors = getErrors(form)
    setErrors(nextErrors)
    const isValid = !Object.values(nextErrors).some(Boolean)
    if (!isValid) focusFirst(nextErrors)
    return isValid
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validate()) return
    setIsSubmitting(true)
    try {
      const payload = { ...form, issue_description: form.issue_description.trim() }
      if (form.breakdown_latitude !== '') payload.breakdown_latitude = Number(form.breakdown_latitude)
      if (form.breakdown_longitude !== '') payload.breakdown_longitude = Number(form.breakdown_longitude)
      if (uploadedFiles.length > 0) payload.file_ids = uploadedFiles.map(f => f.file_id)
      
      const response = await createServiceRequest(payload)
      const requestId = response?.serviceRequest?.request_id
      setCreatedRequestId(requestId)

      if (requestId && form.breakdown_latitude && form.breakdown_longitude) {
        setStep(1)
        setTechLoading(true)
        setTechError('')
        try {
          const techData = await getRankedTechnicians(requestId)
          setTechnicians(techData.technicians || [])
        } catch {
          setTechError('Could not load nearby technicians.')
        } finally {
          setTechLoading(false)
        }
      } else if (requestId) {
        navigate(`/requests/${requestId}`)
      }
    } catch (err) {
      setErrors(prev => ({ ...prev, form: err.message || 'Unable to create request.' }))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBookTech = async (technicianId) => {
    if (!createdRequestId) return
    setBookingTechId(technicianId)
    setBookError('')
    try {
      await bookTechnician(createdRequestId, technicianId)
      navigate(`/requests/${createdRequestId}`)
    } catch (err) {
      setBookError(err?.message || 'Failed to choose technician.')
      setBookingTechId(null)
    }
  }

  const handleSkipTechSelection = () => navigate(`/requests/${createdRequestId}`)

  const handleUploadComplete = (files) => {
    setAttachmentError('')
    setUploadedFiles((prev) => {
      const seen = new Set(prev.map((file) => file.file_id))
      const nextFiles = [...prev]

      for (const file of files) {
        if (!file?.file_id || seen.has(file.file_id)) continue
        seen.add(file.file_id)
        nextFiles.push(file)
      }

      return nextFiles
    })
  }

  const handleDeleteUploadedFile = async (fileId) => {
    setAttachmentError('')

    try {
      await deleteFile(fileId)
      setUploadedFiles((prev) => prev.filter((file) => file.file_id !== fileId))
    } catch (err) {
      setAttachmentError(err?.message || 'Unable to remove attachment.')
    }
  }
  
  const handleLogout = async () => {
    await userLogout().catch(() => null)
    dispatch(clearAuth())
    navigate('/auth/user/signin')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 transition-colors duration-500">
      <div className="relative mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Simplified Header */}
        <header className="mb-10 flex items-center justify-between">
           <Link to="/dashboard" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center group-hover:border-blue-500 transition-all">
                <svg className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </div>
              <span className="text-xs font-black tracking-widest uppercase text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">BACK</span>
           </Link>

           <div className="flex items-center gap-3">
             <button onClick={onToggleTheme} className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center transition-all hover:border-slate-400 dark:hover:border-slate-600">
               {theme === 'dark' ? '🌞' : '🌙'}
             </button>
             <button onClick={handleLogout} className="px-5 py-2.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black tracking-widest uppercase hover:bg-blue-600 dark:hover:bg-blue-500 dark:hover:text-white transition-all shadow-lg active:scale-95">
               LOGOUT
             </button>
           </div>
        </header>

        <section className="rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#0B1120]/50 p-6 md:p-10 shadow-2xl backdrop-blur-sm">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-2 uppercase">ASK FOR HELP</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Tell us what happened, and we will help you find a nearby technician.</p>
          </div>

          <StepBar step={step} />

          {step === 0 && (
            <form onSubmit={handleSubmit} noValidate className="space-y-8 max-w-2xl mx-auto">
              {isVehiclesLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl w-full"></div>
                  <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl w-full"></div>
                </div>
              ) : (
              <>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                      <label className="text-[10px] font-black tracking-widest text-slate-500 uppercase">
                        VEHICLE <span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => navigate('/vehicles')}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-50 px-3 text-[10px] font-black uppercase tracking-[0.22em] text-blue-600 transition-all hover:border-blue-500 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20"
                      >
                        <span className="text-sm leading-none">+</span>
                        Add vehicle
                      </button>
                    </div>
                    <select
                      ref={registerField('vehicle_id')}
                      value={form.vehicle_id}
                      onChange={handleChange('vehicle_id')}
                      onBlur={() => validateField('vehicle_id')}
                      disabled={vehicles.length === 0}
                      className="w-full h-14 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 rounded-2xl px-5 text-sm font-bold outline-none transition-all disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <option value="">
                        {vehicles.length === 0 ? 'No vehicle added yet' : 'Select a vehicle'}
                      </option>
                      {vehicles.map(v => (
                        <option key={v.vehicle_id} value={v.vehicle_id}>{v.variant?.model?.model_name} ({v.registration_number})</option>
                      ))}
                    </select>
                    {vehicles.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-blue-500/20 bg-blue-50/70 px-4 py-3 text-xs text-slate-600 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-slate-300">
                        Add your first vehicle to continue with this request. After saving it on the vehicles page, come back here and select it.
                      </div>
                    )}
                    {errors.vehicle_id && <p className="text-[10px] font-bold text-red-500 px-1">{errors.vehicle_id}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black tracking-widest text-slate-500 uppercase px-1">
                      ISSUE TYPE <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <select ref={registerField('issue_type')} value={form.issue_type} onChange={handleChange('issue_type')} onBlur={() => validateField('issue_type')} className="w-full h-14 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 rounded-2xl px-5 text-sm font-bold outline-none transition-all uppercase tracking-tight">
                      <option value="mechanical_failure">Mechanical problem</option>
                      <option value="electrical_issue">Electrical problem</option>
                      <option value="engine_problem">Engine problem</option>
                      <option value="battery_issue">Battery problem</option>
                      <option value="brake_issue">Brake problem</option>
                      <option value="tire_related">Tyre problem</option>
                      <option value="other">Other</option>
                    </select>
                    {errors.issue_type && <p className="text-[10px] font-bold text-red-500 px-1">{errors.issue_type}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black tracking-widest text-slate-500 uppercase px-1">
                    DESCRIPTION <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <textarea ref={registerField('issue_description')} rows={4} value={form.issue_description} onChange={handleChange('issue_description')} onBlur={() => validateField('issue_description')} className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 rounded-3xl px-6 py-5 text-sm font-medium outline-none transition-all placeholder:text-slate-400" placeholder="Tell us what happened, what the car is doing, or what help you need..." />
                  {errors.issue_description && <p className="text-[10px] font-bold text-red-500 px-1">{errors.issue_description}</p>}
                </div>

                <div className="rounded-3xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-6 space-y-6">
                   <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black tracking-widest text-slate-500 uppercase">
                          LOCATION TYPE <span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                           {['roadside', 'home', 'office'].map(type => (
                             <button key={type} type="button" onClick={() => setForm(f => ({...f, service_location_type: type}))} className={`min-h-11 rounded-2xl px-2 py-2 text-center text-[9px] font-black uppercase leading-tight tracking-wider transition-all sm:px-4 sm:text-[10px] ${form.service_location_type === type ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'}`}>
                               {type}
                             </button>
                           ))}
                        </div>
                      </div>
                      <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 cursor-pointer group dark:border-slate-800 dark:bg-slate-900/60 sm:min-w-[190px]">
                        <input type="checkbox" className="hidden" checked={form.requires_towing} onChange={handleChange('requires_towing')} />
                        <div className={`w-10 h-6 rounded-full p-1 transition-all ${form.requires_towing ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                           <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-md ${form.requires_towing ? 'translate-x-4' : ''}`} />
                        </div>
                        <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase group-hover:text-blue-500">TOWING REQUIRED</span>
                      </label>
                   </div>

                   <LocationPicker 
                    latitude={form.breakdown_latitude} 
                    longitude={form.breakdown_longitude} 
                    required
                    onChange={({ latitude, longitude }) => {
                      setForm(f => ({...f, breakdown_latitude: latitude, breakdown_longitude: longitude }))
                      setErrors(prev => ({ ...prev, location: '', form: '' }))
                    }} 
                   />
                   {errors.location && <p className="text-[10px] font-bold text-red-500 px-1">{errors.location}</p>}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4 px-1">
                    <label className="text-[10px] font-black tracking-widest text-slate-500 uppercase">PHOTOS</label>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                      uploadedFiles.length > 0
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                    }`}>
                      {uploadedFiles.length} added
                    </span>
                  </div>
                  <FileUploader
                    multiple
                    entityType="request"
                    accept="image/*"
                    helperText="Up to 10 MB per file • Images only"
                    dark={theme === 'dark'}
                    onUploadComplete={handleUploadComplete}
                  />
                  {attachmentError && (
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-500">
                      {attachmentError}
                    </div>
                  )}
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-3 rounded-3xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-300">
                          Uploaded photos
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {uploadedFiles.length} file{uploadedFiles.length === 1 ? '' : 's'} ready
                        </p>
                      </div>
                      <FileGallery
                        files={uploadedFiles}
                        onDelete={handleDeleteUploadedFile}
                        dark={theme === 'dark'}
                      />
                    </div>
                  )}
                </div>

                {errors.form && <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold">{errors.form}</div>}

                <button type="submit" disabled={!canSubmit} className="w-full h-16 rounded-[28px] bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/30 transition-all active:scale-95">
                  {isSubmitting ? 'SAVING...' : 'FIND TECHNICIANS →'}
                </button>
              </>
              )}
            </form>
          )}


          {step === 1 && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
               <div className="text-center space-y-2">
                 <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">TECHNICIANS FOUND</h3>
                 <p className="text-slate-500 text-sm">Review nearby technicians and choose one if you want.</p>
               </div>

               {techLoading ? (
                 <div className="flex flex-col items-center gap-4 py-20">
                    <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
                    <span className="text-[10px] font-black tracking-[0.2em] text-blue-600 animate-pulse">LOOKING FOR NEARBY TECHNICIANS...</span>
                 </div>
               ) : (
                 <>
                   {techError && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-red-500">{techError}</div>}
                   {bookError && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-red-500">{bookError}</div>}
                   <div className="grid gap-6 sm:grid-cols-2">
                     {technicians.map(tech => (
                       <TechCard key={tech.technician_id} tech={tech} onBook={handleBookTech} isBooking={bookingTechId === tech.technician_id} />
                     ))}
                     {technicians.length === 0 && (
                       <div className="col-span-full py-20 text-center space-y-4">
                          <div className="inline-flex w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-900 items-center justify-center text-3xl">🔍</div>
                          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No nearby technicians found right now.</p>
                          <button onClick={handleSkipTechSelection} className="text-blue-600 font-black text-[10px] uppercase tracking-widest hover:underline">Continue to request details</button>
                       </div>
                     )}
                   </div>
                 </>
               )}

               {!techLoading && technicians.length > 0 && (
                 <div className="text-center">
                    <button onClick={handleSkipTechSelection} className="text-slate-400 hover:text-slate-900 dark:hover:text-white text-[10px] font-black uppercase tracking-[0.2em] transition-colors">SKIP THIS STEP — I WILL WAIT FOR OFFERS</button>
                 </div>
               )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default UserNewRequestPage
