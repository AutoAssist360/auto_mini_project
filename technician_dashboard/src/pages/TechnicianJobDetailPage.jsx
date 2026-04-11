import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import {
  getJobById,
  updateJobStatus,
  completeJob,
  createInvoice,
  suggestParts,
  markInvoiceCash,
  getCatalogPartsWithInventory,
  getEntityFiles,
  updateLocation,
  ApiError,
} from '../lib/api'
import generateInvoicePDF from '../lib/generateInvoicePDF'
import JobStepper from '../components/JobStepper'
import { ListSkeleton } from '../components/Skeleton'
import Breadcrumbs from '../components/Breadcrumbs'
import { formatLabel } from '../lib/displayText'
import FileUploader, { FileGallery } from '../components/FileUploader'

const STATUS_CONFIG = {
  assigned: {
    label: 'Waiting to start',
    classes: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  in_progress: {
    label: 'In progress',
    classes: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
 completed: {
    label: 'Completed',
    classes: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  verified: {
    label: 'Verified',
    classes: 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400',
    dot: 'bg-purple-500',
  },
}

const PAYMENT_COLORS = {
  pending: 'text-amber-500',
  completed: 'text-emerald-500',
  failed: 'text-red-500',
  refunded: 'text-slate-500',
}

const ITEM_TYPES = ['labor', 'part', 'towing', 'diagnostic', 'other']
const STANDARD_INVOICE_TAX_RATE = 18

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
const SOCKET_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')

function formatCurrency(value) {
  return `₹${Number(value || 0).toFixed(2)}`
}

// ─── RequestFiles: shows photos the user uploaded for the request ──
function RequestFiles({ requestId }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!requestId) return
    getEntityFiles('request', requestId)
      .then(r => setFiles(r.files || []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false))
  }, [requestId])

  if (loading) return <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-4">Loading uploaded files...</p>
  if (files.length === 0) return <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mt-4 opacity-50">No files attached</p>

  return (
    <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
      {files.map(f => {
        const isImage = f.mime_type?.startsWith('image/')
        const url = f.url?.startsWith('http') ? f.url : `${API_BASE}${f.url}`
        return (
          <a key={f.file_id} href={url} target="_blank" rel="noreferrer"
            className="group relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-white/5 transition-all duration-300 hover:scale-[1.05] hover:shadow-xl shadow-sm"
          >
            {isImage ? (
              <img src={url} alt={f.original_name} className="w-full h-32 object-cover" />
            ) : (
              <div className="w-full h-32 flex items-center justify-center text-4xl bg-slate-50 dark:bg-slate-900/50">
                {f.mime_type?.includes('pdf') ? '📄' : f.mime_type?.includes('video') ? '🎬' : '📎'}
              </div>
            )}
            <div className="p-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
              <p className="text-[10px] font-bold truncate uppercase tracking-tight text-slate-700 dark:text-slate-200">{f.original_name}</p>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{(f.size / 1024).toFixed(0)} KB</p>
            </div>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-blue-600/20 backdrop-blur-[2px] transition-all">
              <span className="text-white text-[8px] font-black uppercase tracking-[0.2em] bg-slate-900 px-3 py-1 rounded-full shadow-lg">Open file</span>
            </div>
          </a>
        )
      })}
    </div>
  )
}

function JobFiles({ jobId, dark, refreshKey }) {
  const [files, setFiles] = useState([])
  useEffect(() => {
    getEntityFiles('job', jobId).then(r => setFiles(r.files || [])).catch(() => { })
  }, [jobId, refreshKey])
  if (files.length === 0) return null
  return <div className="mt-4"><FileGallery files={files} dark={dark} /></div>
}

function TechnicianJobDetailPage({ theme, onToggleTheme }) {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [acting, setActing] = useState(false)

  // Invoice form
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [invoiceItems, setInvoiceItems] = useState([
    { item_type: 'labor', description: '', quantity: 1, unit_price: '' },
  ])
  const [creatingInvoice, setCreatingInvoice] = useState(false)

  // Parts suggest
  const [showPartsForm, setShowPartsForm] = useState(false)
  const [partsToSuggest, setPartsToSuggest] = useState([{ part_id: '', quantity: 1 }])
  const [suggestingParts, setSuggestingParts] = useState(false)
  const [partsWithInventory, setPartsWithInventory] = useState([])
  const [loadingParts, setLoadingParts] = useState(false)

  // Payment
  const [markingCash, setMarkingCash] = useState(false)
  const [sharingLocation, setSharingLocation] = useState(false)
  const [trackingError, setTrackingError] = useState('')
  const [lastSharedAt, setLastSharedAt] = useState(null)
  const socketRef = useRef(null)
  const watchIdRef = useRef(null)
  const lastEmitAtRef = useRef(0)
  const lastPersistAtRef = useRef(0)

  const [fileRefresh, setFileRefresh] = useState(0)

  const loadJob = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getJobById(jobId)
      setJob(res?.job ?? null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load job')
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => { loadJob() }, [loadJob])

  const stopSharingLocation = useCallback((announceStop = true) => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (announceStop) {
      socketRef.current?.emit('tracking:stop', jobId)
    }
    lastEmitAtRef.current = 0
    lastPersistAtRef.current = 0
    setSharingLocation(false)
    setTrackingError('')
  }, [jobId])

  useEffect(() => {
    const canTrack = job && ['assigned', 'in_progress'].includes(job.status)
    if (!canTrack) {
      stopSharingLocation(false)
      socketRef.current?.disconnect()
      socketRef.current = null
      return undefined
    }

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('tracking:join', jobId)
      setTrackingError('')
    })

    socket.on('tracking:error', (payload) => {
      const message = payload?.message || 'Unable to share live location right now.'
      if (/unavailable when the job is|not authorized/i.test(message)) {
        stopSharingLocation(false)
      }
      setTrackingError(message)
    })

    socket.on('tracking:ended', (payload) => {
      if (payload?.jobId && payload.jobId !== jobId) return
      stopSharingLocation(false)
    })

    socket.on('job:status_update', (payload) => {
      if (payload?.jobId !== jobId) return
      if (payload?.status === 'completed') {
        stopSharingLocation(false)
      }
    })

    socket.on('disconnect', () => {
      if (watchIdRef.current !== null) {
        setTrackingError('Connection dropped. Tracking will resume when the socket reconnects.')
      }
    })

    return () => {
      socket.emit('tracking:leave', jobId)
      socket.disconnect()
      socketRef.current = null
    }
  }, [job, jobId, stopSharingLocation])

  useEffect(() => () => {
    stopSharingLocation()
  }, [stopSharingLocation])

  const startSharingLocation = async () => {
    if (!navigator.geolocation) {
      setTrackingError('Geolocation is not available in this browser.')
      return
    }

    if (watchIdRef.current !== null) {
      return
    }

    if (!job || !['assigned', 'in_progress'].includes(job.status)) {
      setTrackingError('Live tracking is available only for active jobs.')
      return
    }

    setTrackingError('')
    setSharingLocation(true)

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const latitude = position.coords.latitude
        const longitude = position.coords.longitude
        const now = Date.now()

        if (socketRef.current && now - lastEmitAtRef.current >= 5000) {
          socketRef.current.emit('tracking:update', {
            jobId,
            latitude,
            longitude,
          })
          lastEmitAtRef.current = now
          setLastSharedAt(new Date().toISOString())
        }

        if (now - lastPersistAtRef.current >= 30000) {
          lastPersistAtRef.current = now
          updateLocation(latitude, longitude).catch(() => null)
        }
      },
      (geoError) => {
        if (geoError?.code === geoError?.TIMEOUT || geoError?.code === 3) {
          setTrackingError('GPS is taking longer than expected. Tracking will keep retrying automatically.')
          return
        }

        watchIdRef.current = null
        setSharingLocation(false)
        setTrackingError(geoError?.message || 'Location permission was denied.')
      },
      {
        enableHighAccuracy: true,
        maximumAge: 15000,
        timeout: 30000,
      }
    )
  }

  const handleStatusUpdate = async (newStatus) => {
    setActing(true)
    setActionMsg('')
    try {
      if (newStatus === 'completed') {
        stopSharingLocation(false)
        await completeJob(jobId)
        setActionMsg('Job completed!')
      } else {
        await updateJobStatus(jobId, newStatus)
        setActionMsg(`Job status updated to ${formatLabel(newStatus)}`)
      }
      await loadJob()
    } catch (err) {
      setActionMsg(err instanceof ApiError ? err.message : 'Failed to update status')
    } finally {
      setActing(false)
    }
  }

  const handleCreateInvoice = async () => {
    setCreatingInvoice(true)
    setActionMsg('')
    try {
      const items = invoiceItems.map((i) => ({
        item_type: i.item_type,
        description: i.description,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
      }))
      await createInvoice(jobId, { items })
      setActionMsg('Invoice created successfully!')
      setShowInvoiceForm(false)
      await loadJob()
    } catch (err) {
      setActionMsg(err instanceof ApiError ? err.message : 'Failed to create invoice')
    } finally {
      setCreatingInvoice(false)
    }
  }

  const handleTogglePartsForm = async () => {
    const opening = !showPartsForm
    setShowPartsForm(opening)
    if (opening && partsWithInventory.length === 0) {
      setLoadingParts(true)
      try {
        const res = await getCatalogPartsWithInventory()
        setPartsWithInventory(res?.parts ?? [])
      } catch {
        // Non-critical; form still usable without prices
      } finally {
        setLoadingParts(false)
      }
    }
  }

  const handleSuggestParts = async () => {
    setSuggestingParts(true)
    setActionMsg('')
    try {
      const parts = partsToSuggest
        .filter((p) => p.part_id)
        .map((p) => ({
          part_id: Number(p.part_id),
          quantity: Number(p.quantity),
        }))
      if (parts.length === 0) {
        setActionMsg('Please select at least one part.')
        return
      }
      await suggestParts(jobId, parts)
      setActionMsg('Parts suggested successfully!')
      setShowPartsForm(false)
      setPartsToSuggest([{ part_id: '', quantity: 1 }])
      await loadJob()
    } catch (err) {
      setActionMsg(err instanceof ApiError ? err.message : 'Failed to suggest parts')
    } finally {
      setSuggestingParts(false)
    }
  }


  const handleMarkCash = async () => {
    if (!job?.invoice?.invoice_id) return

    setMarkingCash(true)
    setActionMsg('')
    try {
      await markInvoiceCash(job.invoice.invoice_id)
      setActionMsg('Invoice marked as Cash Paid. Ledger updated.')
      await loadJob()
    } catch (err) {
      setActionMsg(err instanceof ApiError ? err.message : 'Failed to mark cash payment')
    } finally {
      setMarkingCash(false)
    }
  }

  const addInvoiceRow = () => setInvoiceItems((prev) => [...prev, { item_type: 'labor', description: '', quantity: 1, unit_price: '' }])
  const removeInvoiceRow = (idx) => setInvoiceItems((prev) => prev.filter((_, i) => i !== idx))
  const updateInvoiceRow = (idx, field, value) => setInvoiceItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)))

  const addPartRow = () => setPartsToSuggest((prev) => [...prev, { part_id: '', quantity: 1 }])
  const removePartRow = (idx) => setPartsToSuggest((prev) => prev.filter((_, i) => i !== idx))
  const updatePartRow = (idx, field, value) => setPartsToSuggest((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)))

  // Helper: get vendor price hint for a selected part
  const getPartPriceHint = (partId) => {
    if (!partId) return null
    const found = partsWithInventory.find((p) => String(p.part_id) === String(partId))
    if (!found) return null
    return found
  }

  const invoicePreviewSubtotal = invoiceItems.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0)
  const invoicePreviewTax = invoicePreviewSubtotal * STANDARD_INVOICE_TAX_RATE / 100
  const invoicePreviewTotal = invoicePreviewSubtotal + invoicePreviewTax

  const req = job?.request
  const offer = job?.offer
  const invoice = job?.invoice
  const vehicle = req?.vehicle

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-[#030712] text-slate-100' : 'bg-slate-50 text-slate-900'} font-['Outfit',_sans-serif] transition-colors duration-500 relative overflow-x-hidden pb-24`}>
       {/* Background Blurs */}
       <div className="fixed top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-5%] left-[-10%] w-[45%] h-[45%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-5%] right-[-10%] w-[45%] h-[45%] bg-indigo-600/5 dark:bg-indigo-600/15 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Floating Header */}
        <header className="mb-12 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-4 py-3 shadow-xl dark:shadow-2xl flex items-center justify-between transition-all sticky top-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/jobs')} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex flex-col">
              <h1 className="text-lg font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">Job Details</h1>
              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-1 opacity-80">Job ref: {jobId.slice(-8)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={loadJob} disabled={loading} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50">
               <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <button onClick={onToggleTheme} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
               {theme === 'dark' ? '🌞' : '🌙'}
            </button>
          </div>
        </header>

        <div className="mb-6 opacity-60 hover:opacity-100 transition-opacity">
           <Breadcrumbs items={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Jobs', to: '/jobs' }, { label: 'Details' }]} />
        </div>

        {actionMsg && (
          <div className={`mb-8 rounded-2xl border px-6 py-4 text-xs font-black uppercase tracking-widest text-center animate-in fade-in slide-in-from-top-4 ${actionMsg.includes('success') || actionMsg.includes('completed') || actionMsg.includes('updated') || actionMsg.includes('suggested') || actionMsg.includes('created') ? 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400'}`}>
            {actionMsg}
          </div>
        )}

        {error && (
          <div className="mb-8 rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-4 text-xs font-black uppercase tracking-widest text-red-600 dark:text-red-400 text-center animate-in fade-in slide-in-from-top-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12"><ListSkeleton /></div>
        ) : !job ? (
          <div className="py-32 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-700">
             <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-800/50 flex items-center justify-center mb-6 text-4xl opacity-50 grayscale">🔍</div>
             <h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 uppercase tracking-tighter">Job not found</h2>
             <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400 max-w-md">This job could not be loaded. It may have been removed or reassigned.</p>
             <button onClick={() => navigate('/jobs')} className="mt-8 px-8 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl">Back to jobs</button>
          </div>
        ) : (
          <>
            <div className="mb-8 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800/50 bg-white/70 dark:bg-white/5 backdrop-blur-xl shadow-xl">
               <JobStepper
                 jobStatus={job.status}
                 hasInvoice={!!invoice}
                 paymentStatus={invoice?.payment_status || null}
               />
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              {/* Job info */}
              <section className="group relative rounded-[32px] border border-slate-200 dark:border-slate-800/50 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-6 sm:p-8 shadow-xl overflow-hidden transition-all duration-500 hover:shadow-2xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-blue-600/10 transition-colors"></div>
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em]">Job summary</h2>
                  <span className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest leading-none flex items-center gap-1.5 ${(STATUS_CONFIG[job.status] || STATUS_CONFIG.assigned).classes}`}>
                    <span className={`w-1 h-1 rounded-full ${(STATUS_CONFIG[job.status] || STATUS_CONFIG.assigned).dot}`}></span>
                    {(STATUS_CONFIG[job.status] || STATUS_CONFIG.assigned).label}
                  </span>
                </div>
                
                <div className="space-y-6">
                   <div>
                     <h3 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">
                       {formatLabel(req?.issue_type)}
                     </h3>
                     <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                       {req?.issue_description}
                     </p>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Service type</span>
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase">{offer?.repair_mode === 'onsite' ? 'On-site visit' : 'Tow to workshop'}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Estimate</span>
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase">₹{Number(offer?.estimated_cost ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Estimated time</span>
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase">{offer?.estimated_time} min</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Location type</span>
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase">{formatLabel(req?.service_location_type)}</span>
                      </div>
                   </div>

                   {req?.breakdown_latitude && (
                     <div className="p-4 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-800/50">
                        <div className="flex items-center justify-between gap-4">
                           <div className="flex flex-col gap-0.5">
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Coordinates</span>
                             <span className="text-[10px] font-black text-slate-700 dark:text-slate-300">{req.breakdown_latitude.toFixed(4)}, {req.breakdown_longitude?.toFixed(4)}</span>
                           </div>
                           <a
                             href={`https://www.google.com/maps/dir/?api=1&destination=${req.breakdown_latitude},${req.breakdown_longitude}`}
                             target="_blank"
                             rel="noreferrer"
                             className="h-10 px-4 rounded-xl bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-all flex items-center gap-2"
                           >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              Open map
                           </a>
                        </div>
                     </div>
                   )}

                   {(job.started_at || job.completed_at) && (
                     <div className="pt-4 border-t border-slate-200 dark:border-slate-800/50 flex flex-wrap gap-x-8 gap-y-4">
                        {job.started_at && (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Start time</span>
                            <span className="text-[10px] font-black text-slate-700 dark:text-slate-300">{new Date(job.started_at).toLocaleString()}</span>
                          </div>
                        )}
                        {job.completed_at && (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">End time</span>
                            <span className="text-[10px] font-black text-slate-700 dark:text-slate-300">{new Date(job.completed_at).toLocaleString()}</span>
                          </div>
                        )}
                     </div>
                   )}

                    {/* Chat action */}
                    {req?.request_id && (
                      <button
                        type="button"
                        onClick={() => navigate(`/messages/${req.request_id}`)}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 active:scale-95"
                      >
                        Open messages
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                      </button>
                    )}
                </div>
              </section>

              {/* Vehicle */}
              <section className="group relative rounded-[32px] border border-slate-200 dark:border-slate-800/50 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-6 sm:p-8 shadow-xl overflow-hidden transition-all duration-500 hover:shadow-2xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-indigo-600/10 transition-colors"></div>
                <h2 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] mb-8">Vehicle details</h2>
                
                {vehicle ? (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">
                        {vehicle.variant?.model?.company?.company_name} {vehicle.variant?.model?.model_name}
                      </h3>
                      <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {vehicle.variant?.variant_name} ({vehicle.variant?.year})
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Registration</span>
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase">{vehicle.registration_number}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Fuel and gearbox</span>
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase">{vehicle.variant?.fuel_type} / {vehicle.variant?.transmission}</span>
                      </div>
                    </div>

                    {req?.parts?.length > 0 && (
                      <div className="pt-6 border-t border-slate-200 dark:border-slate-800/50">
                        <h3 className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-4">Requested parts</h3>
                        <div className="space-y-2">
                          {req.parts.map((p) => (
                            <div key={p.request_part_id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800/50">
                               <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase">{p.part?.part_name}</span>
                               <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">X{p.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-center opacity-30">
                     <span className="text-4xl mb-2">🚗</span>
                     <p className="text-[10px] font-black uppercase tracking-widest">Vehicle details unavailable</p>
                  </div>
                )}
              </section>

              {/* Photos */}
              {req?.request_id && (
                <section className="lg:col-span-2 group relative rounded-[32px] border border-blue-500/20 bg-blue-600/5 backdrop-blur-xl p-6 sm:p-8 shadow-xl overflow-hidden transition-all duration-500 hover:shadow-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em]">Uploaded images</h2>
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest opacity-50">Customer uploads</span>
                  </div>
                  <RequestFiles requestId={req.request_id} dark={theme === 'dark'} />
                </section>
              )}

              {/* Job Photos */}
              {['in_progress', 'completed', 'verified'].includes(job.status) && (
                <section className="lg:col-span-2 p-8 rounded-[32px] border border-slate-200 dark:border-slate-800/50 bg-white/70 dark:bg-white/5 backdrop-blur-xl shadow-xl overflow-hidden transition-all duration-500 hover:shadow-2xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-9 h-9 rounded-xl bg-slate-700 dark:bg-slate-600 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <h2 className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-[0.2em]">Work Photos and Files</h2>
                  </div>
                  {job.status === 'in_progress' && (
                    <div className="mb-5 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700">
                      <FileUploader onUploadComplete={() => setFileRefresh(prev => prev + 1)} entityType="job" entityId={job.job_id} accept="image/*,video/mp4,application/pdf" multiple dark={theme === 'dark'} />
                    </div>
                  )}
                  <JobFiles jobId={job.job_id} dark={theme === 'dark'} refreshKey={fileRefresh} />
                </section>
              )}

              {/* Live tracking */}
              {req?.breakdown_latitude != null && req?.breakdown_longitude != null && ['assigned', 'in_progress'].includes(job.status) && (
                <section className="lg:col-span-2 group relative rounded-[32px] border border-blue-500/30 bg-blue-600/10 backdrop-blur-xl p-6 sm:p-8 shadow-2xl overflow-hidden transition-all duration-500">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
                  
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="flex-1">
                      <h2 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-4">Live location sharing</h2>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                        Share your live location with the customer while this job is active so they can track your arrival.
                      </p>
                    </div>
                    
                    <div className="flex min-w-0 flex-col gap-3 sm:items-end lg:min-w-[200px]">
                      {sharingLocation ? (
                        <button
                          type="button"
                          onClick={stopSharingLocation}
                          className="w-full h-12 rounded-2xl bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                           <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                           Stop sharing
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startSharingLocation}
                          className="w-full h-12 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071a9.05 9.05 0 0112.728 0m.757-3.033a12.5 12.5 0 00-17.678 0" /></svg>
                           Start live tracking
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    <div className="p-4 rounded-2xl border border-blue-500/20 bg-white/50 dark:bg-slate-900/40 backdrop-blur-md">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Customer location</span>
                      <div className="flex items-center gap-2">
                         <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                         <span className="text-[10px] font-black text-slate-700 dark:text-white">{req.breakdown_latitude.toFixed(5)}, {req.breakdown_longitude.toFixed(5)}</span>
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl border border-blue-500/20 bg-white/50 dark:bg-slate-900/40 backdrop-blur-md">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Sharing status</span>
                      <div className="flex items-center justify-between">
                         <span className={`text-[10px] font-black uppercase ${sharingLocation ? 'text-emerald-500' : 'text-slate-400'}`}>
                           {sharingLocation ? 'Sharing live' : 'Not sharing'}
                         </span>
                         {lastSharedAt && (
                           <span className="text-[9px] font-bold text-slate-400">{new Date(lastSharedAt).toLocaleTimeString()}</span>
                         )}
                      </div>
                    </div>
                  </div>

                  {trackingError && (
                    <div className="mt-4 p-4 rounded-2xl border border-red-500/20 bg-red-500/10 text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400 text-center">
                       {trackingError}
                    </div>
                  )}
                </section>
              )}

              {/* Actions */}
              <section className="lg:col-span-2 group relative rounded-[32px] border border-slate-200 dark:border-slate-800/50 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-6 sm:p-8 shadow-xl overflow-hidden transition-all duration-500 hover:shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Job actions</h2>
                  <div className="h-px flex-1 mx-6 bg-slate-200 dark:bg-slate-800/50"></div>
                </div>
                
                <div className="flex flex-wrap gap-4">
                  {job.status === 'assigned' && (
                    <button 
                      type="button" 
                      onClick={() => handleStatusUpdate('in_progress')} 
                      disabled={acting} 
                      className="h-12 px-8 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {acting ? 'Starting...' : 'Start job'}
                    </button>
                  )}
                  {job.status === 'in_progress' && (
                    <>
                      <button 
                        type="button" 
                        onClick={() => handleStatusUpdate('completed')} 
                        disabled={acting} 
                        className="h-12 px-8 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {acting ? 'Saving...' : 'Finish job'}
                      </button>
                      <button 
                        type="button" 
                        onClick={handleTogglePartsForm} 
                        className="h-12 px-8 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-50 dark:hover:bg-white/10 transition-all"
                      >
                        {showPartsForm ? 'Cancel parts list' : 'Suggest parts'}
                      </button>
                    </>
                  )}
                  {job.status === 'completed' && !invoice && (
                    <button 
                      type="button" 
                      onClick={() => setShowInvoiceForm(!showInvoiceForm)} 
                      className="h-12 px-8 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                      {showInvoiceForm ? 'Cancel invoice' : 'Create invoice'}
                    </button>
                  )}
                </div>

                {/* Parts suggest form */}
                {showPartsForm && (
                  <div className="mt-8 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-black/20 animate-in zoom-in-95 duration-500">
                    <div className="flex items-center gap-3 mb-6">
                       <div className="w-10 h-10 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-600">🛠️</div>
                       <div>
                         <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight">Suggested parts</h3>
                         <p className="text-[9px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">Choose parts from available stock</p>
                       </div>
                    </div>

                    {loadingParts ? (
                      <div className="py-12 flex flex-col items-center justify-center gap-4">
                         <div className="w-8 h-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading parts catalog...</span>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {partsToSuggest.map((p, idx) => {
                          const hint = getPartPriceHint(p.part_id)
                          return (
                            <div key={idx} className="group/row relative p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-white/5 transition-all">
                              <div className="flex flex-wrap gap-4 items-end">
                                <div className="flex-1 min-w-0 sm:min-w-[200px]">
                                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Part</label>
                                  <select
                                    value={p.part_id}
                                    onChange={(e) => updatePartRow(idx, 'part_id', e.target.value)}
                                    className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 text-[11px] font-bold text-slate-700 dark:text-white outline-none focus:border-blue-600 transition-colors cursor-pointer appearance-none"
                                  >
                                    <option value="">Select a part</option>
                                    {partsWithInventory.map((part) => (
                                      <option key={part.part_id} value={part.part_id}>
                                        {part.part_name.toUpperCase()} {part.category?.category_name ? `[${part.category.category_name.toUpperCase()}]` : ''} {part.in_stock ? '' : '— Out of stock'}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="w-24">
                                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">QUANTITY</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={p.quantity}
                                    onChange={(e) => updatePartRow(idx, 'quantity', e.target.value)}
                                    className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 text-[11px] font-bold text-slate-700 dark:text-white outline-none focus:border-blue-600 transition-colors"
                                  />
                                </div>
                                {partsToSuggest.length > 1 && (
                                  <button type="button" onClick={() => removePartRow(idx)} className="h-11 px-4 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors">
                                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                )}
                              </div>

                              {/* Vendor price hint */}
                              {hint && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                  {hint.best_price !== null && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase tracking-wider">
                                       Rs {hint.best_price.toFixed(2)} each
                                    </span>
                                  )}
                                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${hint.in_stock ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                                     {hint.total_available} in stock
                                  </span>
                                  {hint.warehouses[0] && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-500/10 text-slate-500 text-[9px] font-black uppercase tracking-wider">
                                      Stock at {hint.warehouses[0].warehouse_name.split(' ')[0]}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}

                        <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
                          <button type="button" onClick={addPartRow} className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2 hover:opacity-70 transition-opacity">
                             <span className="w-5 h-5 rounded-lg border-2 border-current flex items-center justify-center">+</span>
                             Add another part
                          </button>
                          <button
                            type="button"
                            onClick={handleSuggestParts}
                            disabled={suggestingParts || partsToSuggest.every((p) => !p.part_id)}
                            className="h-10 px-6 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-50"
                          >
                            {suggestingParts ? 'Sending...' : 'Send parts list'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Invoice create form */}
                {showInvoiceForm && (
                  <div className="mt-8 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-black/20 animate-in zoom-in-95 duration-500">
                    <div className="flex items-center gap-3 mb-6">
                       <div className="w-10 h-10 rounded-2xl bg-emerald-600/10 flex items-center justify-center text-emerald-600">📄</div>
                       <div>
                         <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight">Create invoice</h3>
                         <p className="text-[9px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">Add labor, parts, and other charges</p>
                       </div>
                    </div>

                    <div className="space-y-4">
                      {invoiceItems.map((item, idx) => (
                        <div key={idx} className="group/row relative p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-white/5">
                          <div className="flex flex-wrap gap-3 items-end">
                            <div className="w-32">
                              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">CATEGORY</label>
                              <select 
                                value={item.item_type} 
                                onChange={(e) => updateInvoiceRow(idx, 'item_type', e.target.value)} 
                                className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-[10px] font-bold text-slate-700 dark:text-white outline-none cursor-pointer"
                              >
                                {ITEM_TYPES.map((t) => <option key={t} value={t}>{formatLabel(t)}</option>)}
                              </select>
                            </div>
                            <div className="flex-1 min-w-0 sm:min-w-[150px]">
                              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">DESCRIPTION</label>
                              <input 
                                placeholder="Describe this item" 
                                value={item.description} 
                                onChange={(e) => updateInvoiceRow(idx, 'description', e.target.value)} 
                                className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-[10px] font-bold text-slate-700 dark:text-white outline-none" 
                              />
                            </div>
                            <div className="w-20">
                              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">QTY</label>
                              <input 
                                type="number" 
                                value={item.quantity} 
                                onChange={(e) => updateInvoiceRow(idx, 'quantity', e.target.value)} 
                                className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-[10px] font-bold text-slate-700 dark:text-white outline-none" 
                              />
                            </div>
                            <div className="w-24">
                              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Unit price</label>
                              <input 
                                type="number" 
                                value={item.unit_price} 
                                onChange={(e) => updateInvoiceRow(idx, 'unit_price', e.target.value)} 
                                className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-[10px] font-bold text-slate-700 dark:text-white outline-none" 
                              />
                            </div>
                            {invoiceItems.length > 1 && (
                              <button type="button" onClick={() => removeInvoiceRow(idx)} className="h-10 px-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors">✕</button>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      <div className="flex items-center justify-between">
                         <button type="button" onClick={addInvoiceRow} className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                           <span className="w-4 h-4 rounded border border-current flex items-center justify-center">+</span>
                           Add line item
                         </button>
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tax rate: {STANDARD_INVOICE_TAX_RATE}%</span>
                      </div>

                      <div className="p-6 rounded-[32px] border border-blue-600/20 bg-blue-600/5 backdrop-blur-md">
                        <div className="flex flex-col gap-3">
                           <div className="flex justify-between items-center">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SUBTOTAL</span>
                             <span className="text-sm font-bold text-slate-700 dark:text-slate-200">₹{invoicePreviewSubtotal.toFixed(2)}</span>
                           </div>
                           <div className="flex justify-between items-center">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TAX_VAL</span>
                             <span className="text-sm font-bold text-slate-700 dark:text-slate-200">₹{invoicePreviewTax.toFixed(2)}</span>
                           </div>
                           <div className="h-px bg-blue-600/20 my-1"></div>
                           <div className="flex justify-between items-center">
                             <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em]">Total amount</span>
                             <span className="text-2xl font-black text-slate-900 dark:text-white leading-none">₹{invoicePreviewTotal.toFixed(2)}</span>
                           </div>
                        </div>
                      </div>

                      <button 
                        type="button" 
                        onClick={handleCreateInvoice} 
                        disabled={creatingInvoice || invoiceItems.some((i) => !i.description || !i.unit_price)} 
                        className="w-full h-14 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
                      >
                        {creatingInvoice ? 'Creating invoice...' : 'Create invoice'}
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Existing invoice */}
              {invoice && (
                <section className="lg:col-span-2 group relative rounded-[32px] border border-slate-200 dark:border-slate-800/50 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-6 sm:p-8 shadow-xl overflow-hidden transition-all duration-500 hover:shadow-2xl">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Invoice summary</h2>
                    <div className="flex items-center gap-4">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${PAYMENT_COLORS[invoice.payment_status] || 'text-slate-500'}`}>
                        {formatLabel(invoice.payment_status)}
                      </span>
                      <button
                        type="button"
                        onClick={() => generateInvoicePDF(invoice, {
                          customerName: req?.user?.full_name,
                          issueType: req?.issue_type,
                        })}
                        className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                        title="Download invoice"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                     {invoice.items?.map((item, idx) => (
                       <div key={item.invoice_item_id || idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800/50">
                          <div className="flex flex-col gap-1">
                             <span className="text-[10px] font-bold text-slate-800 dark:text-white leading-none uppercase">{item.description}</span>
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{formatLabel(item.item_type)} × {item.quantity}</span>
                          </div>
                          <span className="text-xs font-black text-slate-700 dark:text-slate-200">₹{(item.quantity * item.unit_price).toFixed(2)}</span>
                       </div>
                     ))}

                     <div className="p-6 rounded-[32px] border border-slate-200 dark:border-slate-800/50 bg-white/50 dark:bg-transparent mt-8">
                       <div className="flex flex-col gap-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Subtotal</span>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatCurrency(invoice.subtotal)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tax</span>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatCurrency(invoice.tax)}</span>
                          </div>
                          <div className="h-px bg-slate-200 dark:bg-slate-800/50 my-1"></div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">Grand total</span>
                            <span className="text-2xl font-black text-blue-600 dark:text-blue-400 leading-none">{formatCurrency(invoice.total)}</span>
                          </div>
                       </div>
                     </div>

                     {/* Payment Actions */}
                     {invoice.payment_status !== 'completed' && (
                       <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800/50">
                          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Payment options</h3>
                          <div className="flex flex-wrap gap-4">
                            <button
                              type="button"
                              onClick={handleMarkCash}
                              disabled={markingCash}
                              className="h-12 px-6 rounded-2xl bg-blue-600/10 text-blue-600 text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all border border-blue-600/20 disabled:opacity-50"
                            >
                              {markingCash ? 'Updating...' : 'Mark as cash paid'}
                            </button>
                          </div>
                       </div>
                     )}
                  </div>
                </section>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default TechnicianJobDetailPage
