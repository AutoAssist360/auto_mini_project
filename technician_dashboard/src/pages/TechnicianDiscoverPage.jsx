import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  ApiError,
  createOffer,
  getEntityFiles,
  getOpenRequestDetail,
  getOpenRequests,
} from '../lib/api'
import { ListSkeleton } from '../components/Skeleton'
import { useSocket } from '../lib/useSocket'
import { formatLabel } from '../lib/displayText'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const NAGPUR_CENTER = [21.1458, 79.0882]
const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')

const ISSUE_LABELS = {
  mechanical_failure: 'Mechanical Failure',
  electrical_issue: 'Electrical Issue',
  tire_related: 'Tire Related',
  battery_issue: 'Battery Issue',
  engine_problem: 'Engine Problem',
  brake_issue: 'Brake Issue',
  other: 'Other',
}

const LOCATION_LABELS = {
  roadside: 'Roadside',
  home: 'Home',
  office: 'Office',
  parking: 'Parking',
  highway: 'Highway',
  other: 'Other',
}

function TechnicianDiscoverPage({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState('list')
  const [expandedMapId, setExpandedMapId] = useState(null)

  const [offerTarget, setOfferTarget] = useState(null)
  const [requestDetail, setRequestDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [requestFiles, setRequestFiles] = useState([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [showFiles, setShowFiles] = useState(false)
  const [offerForm, setOfferForm] = useState({
    repair_mode: 'onsite',
    estimated_cost: '',
    estimated_time: '',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [toastMsg, setToastMsg] = useState({ text: '', type: '' })
  const { on, off } = useSocket(null)

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getOpenRequests(page, 12)
      setRequests(res?.requests ?? [])
      setTotal(res?.total ?? 0)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load open requests.')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  useEffect(() => {
    const reload = () => {
      loadRequests().catch(() => null)
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        reload()
      }
    }

    on('technician:discover_refresh', reload)
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      off('technician:discover_refresh', reload)
      window.removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [loadRequests, off, on])

  const totalPages = Math.ceil(total / 12) || 1

  const resetModalState = () => {
    setOfferTarget(null)
    setRequestDetail(null)
    setDetailError('')
    setDetailLoading(false)
    setRequestFiles([])
    setFilesLoading(false)
    setShowFiles(false)
  }

  const openOfferModal = async (request) => {
    setExpandedMapId(null)   // collapse any open card map so it doesn't bleed through the modal
    setOfferTarget(request)
    setRequestDetail(null)
    setDetailError('')
    setDetailLoading(true)
    setRequestFiles([])
    setFilesLoading(true)
    setShowFiles(false)
    setOfferForm({
      repair_mode: 'onsite',
      estimated_cost: '',
      estimated_time: '',
      message: '',
    })
    setToastMsg({ text: '', type: '' })

    const [detailResult, filesResult] = await Promise.allSettled([
      getOpenRequestDetail(request.request_id),
      getEntityFiles('request', request.request_id),
    ])

    if (detailResult.status === 'fulfilled') {
      setRequestDetail(detailResult.value?.request ?? null)
    } else {
      const detailReason = detailResult.reason
      setDetailError(detailReason instanceof ApiError ? detailReason.message : 'Failed to load request details.')
    }

    if (filesResult.status === 'fulfilled') {
      setRequestFiles(filesResult.value?.files ?? [])
    } else if (detailResult.status === 'fulfilled') {
      const filesReason = filesResult.reason
      setDetailError(filesReason instanceof ApiError ? filesReason.message : 'Failed to load uploaded files.')
    }

    setDetailLoading(false)
    setFilesLoading(false)
  }

  const closeOfferModal = () => {
    resetModalState()
  }

  const handleSubmitOffer = async () => {
    if (!offerTarget) return

    setSubmitting(true)
    setToastMsg({ text: '', type: '' })

    try {
      await createOffer({
        request_id: offerTarget.request_id,
        repair_mode: offerForm.repair_mode,
        estimated_cost: Number(offerForm.estimated_cost),
        estimated_time: Number(offerForm.estimated_time),
        ...(offerForm.message.trim() ? { message: offerForm.message.trim() } : {}),
      })

      setToastMsg({ text: 'Offer sent successfully.', type: 'success' })
      resetModalState()
      await loadRequests()
    } catch (err) {
      setToastMsg({
        text: err instanceof ApiError ? err.message : 'Failed to submit offer.',
        type: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const vehicleLabel = (vehicle) => {
    if (!vehicle) return 'Unknown Vehicle'

    const company = vehicle.variant?.model?.company?.company_name || ''
    const model = vehicle.variant?.model?.model_name || ''
    const variant = vehicle.variant?.variant_name || ''
    const year = vehicle.year ? ` (${vehicle.year})` : ''

    return `${company} ${model} ${variant}${year}`.trim() || 'Vehicle'
  }

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)

    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`

    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`

    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'Unknown'

    try {
      return new Date(dateStr).toLocaleString()
    } catch {
      return dateStr
    }
  }

  const activeRequest = requestDetail || offerTarget
  const imageFiles = useMemo(
    () => requestFiles.filter((file) => file.mime_type?.startsWith('image/')),
    [requestFiles],
  )
  const uploadButtonLabel = imageFiles.length > 0
    ? `See Uploaded Images (${imageFiles.length})`
    : requestFiles.length > 0
      ? `See Uploaded Files (${requestFiles.length})`
      : 'No Uploads'

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-[#030712] text-slate-100' : 'bg-slate-50 text-slate-900'} font-['Outfit',_sans-serif] transition-colors duration-500 relative overflow-x-hidden pb-20`}>
      {/* Background Blurs */}
      <div className="fixed top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-5%] left-[-10%] w-[45%] h-[45%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-5%] right-[-10%] w-[45%] h-[45%] bg-indigo-600/5 dark:bg-indigo-600/15 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Floating Header */}
        <header className="mb-10 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-4 py-3 shadow-xl dark:shadow-2xl flex items-center justify-between transition-all sticky top-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex flex-col">
              <h1 className="text-lg font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">Today's Open Requests</h1>
                <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-1 opacity-80">{total} requests available today</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-full p-1 border border-slate-200 dark:border-slate-700">
               <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>List</button>
               <button onClick={() => setViewMode('map')} className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'map' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Map</button>
            </div>
            <button onClick={loadRequests} disabled={loading} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50">
               <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <button onClick={onToggleTheme} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
               {theme === 'dark' ? '🌞' : '🌙'}
            </button>
          </div>
        </header>

        {toastMsg.text && (
          <div className={`mb-6 rounded-2xl border px-6 py-4 text-xs font-black uppercase tracking-widest text-center animate-in fade-in slide-in-from-top-4 ${
            toastMsg.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400'
          }`}>
            {toastMsg.text}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-4 text-xs font-black uppercase tracking-widest text-red-600 dark:text-red-400 text-center animate-in fade-in slide-in-from-top-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12"><ListSkeleton /></div>
        ) : requests.length === 0 ? (
          <div className="py-32 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-700">
             <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-800/50 flex items-center justify-center mb-6 text-4xl opacity-50 grayscale">📡</div>
             <h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 uppercase tracking-tighter">No open requests right now</h2>
             <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400 max-w-md">Only requests created today appear here. Older unfinished requests are closed automatically.</p>
             <button onClick={loadRequests} className="mt-8 px-8 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl">Refresh list</button>
          </div>
        ) : (
          <>
            {viewMode === 'list' ? (
              <>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {requests.map((req, idx) => (
                    <div key={req.request_id} className="group relative flex flex-col justify-between rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-8 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-8 overflow-hidden" style={{ animationDelay: `${idx * 50}ms` }}>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-blue-600/10 transition-colors"></div>
                      
                      <div>
                        <div className="flex items-center justify-between mb-6">
                           <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest leading-none">
                              {ISSUE_LABELS[req.issue_type] || req.issue_type}
                           </span>
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{timeAgo(req.created_at)}</span>
                        </div>

                        <div className="mb-6">
                           <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed min-h-[3rem] line-clamp-3">
                             {req.issue_description}
                           </p>
                        </div>

                        <div className="space-y-3 mb-8">
                           <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/50">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vehicle</span>
                              <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase truncate max-w-[120px]">{vehicleLabel(req.vehicle)}</span>
                           </div>
                           <div className="flex flex-wrap gap-2 pt-2">
                              <span className="px-2.5 py-1 rounded-lg bg-slate-200/50 dark:bg-slate-800/50 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                {LOCATION_LABELS[req.service_location_type] || req.service_location_type}
                              </span>
                              {req.distance_km != null && (
                                <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                             {req.distance_km} km away
                                </span>
                              )}
                              {req.car_match && (
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-[9px] font-black text-emerald-600 uppercase tracking-widest">Good fit</span>
                              )}
                        {req.requires_towing && (
                                <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-[9px] font-black text-amber-600 uppercase tracking-widest">Needs towing</span>
                              )}
                           </div>
                        </div>

                        {req.breakdown_latitude && req.breakdown_longitude && (
                          <div className={`transition-all duration-500 overflow-hidden ${expandedMapId === req.request_id ? 'h-48 mb-6' : 'h-0'}`}>
                             <div className="h-full w-full rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-inner">
                                <MapContainer key={req.request_id} center={[req.breakdown_latitude, req.breakdown_longitude]} zoom={15} className="h-full w-full" attributionControl={false} dragging={false} zoomControl={false}>
                                   <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                   <Marker position={[req.breakdown_latitude, req.breakdown_longitude]} icon={redIcon} />
                                </MapContainer>
                             </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {req.breakdown_latitude && req.breakdown_longitude && (
                          <button onClick={() => setExpandedMapId(expandedMapId === req.request_id ? null : req.request_id)} className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex-shrink-0">
                             <span className="text-lg">{expandedMapId === req.request_id ? '✕' : '📍'}</span>
                          </button>
                        )}
                        <button onClick={() => openOfferModal(req)} className="flex-1 h-12 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden group/btn">
                           <span className="relative z-10">Review and offer</span>
                           <div className="absolute inset-0 bg-blue-600 dark:bg-blue-400 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500"></div>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-12 flex items-center justify-center gap-4">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="w-12 h-12 rounded-2xl bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30">{'<'}</button>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Page {page} of {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="w-12 h-12 rounded-2xl bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30">{'>'}</button>
                  </div>
                )}
              </>
            ) : (
              <section className="mt-5 rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-4 shadow-xl dark:shadow-2xl h-[700px] relative overflow-hidden animate-in fade-in zoom-in-95 duration-1000">
                <div className="h-full w-full rounded-[30px] overflow-hidden border border-slate-200 dark:border-slate-800">
                  <MapContainer center={NAGPUR_CENTER} zoom={12} className="h-full w-full" scrollWheelZoom>
                    <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {requests
                      .filter((req) => req.breakdown_latitude && req.breakdown_longitude)
                      .map((req) => (
                        <Marker key={req.request_id} position={[req.breakdown_latitude, req.breakdown_longitude]} icon={redIcon}>
                          <Popup minWidth={240}>
                            <div className="p-2 font-['Outfit']">
                              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-1">{ISSUE_LABELS[req.issue_type] || req.issue_type}</h3>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">{vehicleLabel(req.vehicle)}</p>
                              <p className="text-xs text-slate-600 line-clamp-3 mb-4 leading-relaxed">{req.issue_description}</p>
                              <button onClick={() => openOfferModal(req)} className="w-full py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20">View details</button>
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                  </MapContainer>
                </div>
                <div className="absolute bottom-10 left-10 z-[1000] px-6 py-2 rounded-full bg-slate-900/80 dark:bg-white/90 backdrop-blur-md text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest shadow-2xl">
                   {requests.filter(r => r.breakdown_latitude).length} active locations
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {offerTarget && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#030712]/60 backdrop-blur-sm animate-in fade-in" onClick={closeOfferModal}></div>
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[40px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120] p-8 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 group/modal">
            <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-100 dark:border-slate-800">
               <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-2xl shadow-blue-500/20 rotate-3 transition-transform group-hover/modal:rotate-0">
                     <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div>
                     <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mb-1">Request details</h2>
                     <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Review the request and send your offer to the customer.</p>
                  </div>
               </div>
               <button onClick={closeOfferModal} className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm">✕</button>
            </div>

            {detailError && (
              <div className="mb-8 p-4 rounded-2xl border border-red-500/20 bg-red-500/10 text-xs font-black uppercase text-red-500 tracking-widest text-center animate-pulse">
                {detailError}
              </div>
            )}

            <div className="grid gap-10 lg:grid-cols-2">
               {/* DOSSIER COLUMN */}
               <div className="space-y-8">
                  <section className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                     {detailLoading && (
                       <div className="mb-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                         Loading request details...
                       </div>
                     )}
                     <div className="mb-4">
                        <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-2">Customer note</span>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed italic border-l-4 border-blue-500 pl-4 py-2 bg-blue-500/5 rounded-r-xl">{activeRequest?.issue_description}</p>
                     </div>
                     <div className="grid grid-cols-2 gap-4 mt-6">
                         {[
                            { l: 'Vehicle', v: vehicleLabel(activeRequest?.vehicle) },
                            { l: 'Location', v: formatLabel(activeRequest?.service_location_type) || 'N/A' },
                            { l: 'Reported', v: activeRequest?.created_at ? timeAgo(activeRequest.created_at) : 'N/A' },
                            { l: 'Reported at', v: formatDateTime(activeRequest?.created_at) },
                            { l: 'Customer', v: activeRequest?.user?.full_name?.toUpperCase() || 'ANON' }
                         ].map((it, i) => (
                           <div key={i} className="space-y-1">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{it.l}</span>
                              <p className="text-[11px] font-black text-slate-800 dark:text-slate-200 truncate">{it.v}</p>
                           </div>
                         ))}
                     </div>
                  </section>

                  {activeRequest?.parts?.length > 0 && (
                    <section>
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-1">Suggested parts</h4>
                       <div className="flex flex-wrap gap-2">
                          {activeRequest.parts.map((p, i) => (
                            <span key={i} className="px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest">
                               {p.part?.part_name} {p.quantity ? `×${p.quantity}` : ''}
                            </span>
                          ))}
                       </div>
                    </section>
                  )}

                  {activeRequest?.breakdown_latitude && (
                    <section>
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-1">Location on map</h4>
                       <div className="h-56 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl">
                          <MapContainer center={[activeRequest.breakdown_latitude, activeRequest.breakdown_longitude]} zoom={15} className="h-full w-full" attributionControl={false} scrollWheelZoom={false}>
                             <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                             <Marker position={[activeRequest.breakdown_latitude, activeRequest.breakdown_longitude]} icon={redIcon} />
                          </MapContainer>
                       </div>
                    </section>
                  )}

                  <section>
                      <button onClick={() => setShowFiles(!showFiles)} disabled={filesLoading || requestFiles.length === 0} className="w-full h-14 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 hover:bg-slate-50 dark:hover:bg-white/5 transition-all group/filebtn disabled:opacity-50">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover/filebtn:text-blue-500 transition-colors">
                             {filesLoading ? 'Loading uploads...' : uploadButtonLabel}
                          </span>
                          <span className="text-xl">{showFiles ? '▲' : '▼'}</span>
                      </button>
                      {showFiles && (
                         <div className="grid grid-cols-2 gap-4 mt-6 animate-in slide-in-from-top-4 duration-500">
                            {requestFiles.map((file, i) => {
                               const isImg = file.mime_type?.startsWith('image/')
                               const url = file.url?.startsWith('http') ? file.url : `${API_BASE}${file.url}`
                               return (
                                 <a key={i} href={url} target="_blank" rel="noreferrer" className="block p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition-all">
                                    {isImg ? <img src={url} className="w-full h-24 object-cover rounded-xl mb-3" /> : <div className="h-24 flex items-center justify-center text-4xl mb-3">📁</div>}
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 truncate">{file.original_name}</p>
                                 </a>
                               )
                            })}
                         </div>
                      )}
                  </section>
               </div>

               {/* TRANSMISSION COLUMN */}
               <div className="space-y-8">
                  <div className="rounded-[35px] border border-blue-200 dark:border-blue-900/30 bg-blue-600/5 p-8 relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                     <h3 className="text-sm font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-8">Your offer</h3>
                     
                     <div className="space-y-6">
                        <div className="group/input relative">
                           <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block ml-1">Service type</label>
                           <select value={offerForm.repair_mode} onChange={e => setOfferForm(p => ({ ...p, repair_mode: e.target.value }))} className="w-full h-14 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 px-5 text-sm font-black outline-none focus:border-blue-500 appearance-none cursor-pointer group-hover/input:border-blue-500/30 transition-all">
                              <option value="onsite">Visit customer location</option>
                              <option value="tow_to_garage">Tow to workshop</option>
                           </select>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                           <div className="group/input relative">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block ml-1">Estimated price (INR)</label>
                              <input type="number" min="1" value={offerForm.estimated_cost} onChange={e => setOfferForm(p => ({ ...p, estimated_cost: e.target.value }))} placeholder="e.g. 2500" className="w-full h-14 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 px-5 text-sm font-black outline-none focus:border-blue-500 group-hover/input:border-blue-500/30 transition-all" />
                           </div>
                           <div className="group/input relative">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block ml-1">Arrival time (minutes)</label>
                              <input type="number" min="1" value={offerForm.estimated_time} onChange={e => setOfferForm(p => ({ ...p, estimated_time: e.target.value }))} placeholder="e.g. 45" className="w-full h-14 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 px-5 text-sm font-black outline-none focus:border-blue-500 group-hover/input:border-blue-500/30 transition-all" />
                           </div>
                        </div>

                        <div className="group/input relative">
                           <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block ml-1">Message (optional)</label>
                           <textarea value={offerForm.message} onChange={e => setOfferForm(p => ({ ...p, message: e.target.value }))} rows={4} placeholder="Add a short note for the customer..." className="w-full bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 text-sm font-bold outline-none focus:border-blue-500 group-hover/input:border-blue-500/30 transition-all" />
                        </div>

                        <div className="pt-4">
                           <button onClick={handleSubmitOffer} disabled={submitting || !offerForm.estimated_cost || !offerForm.estimated_time} className="w-full h-16 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale">
                              {submitting ? 'Sending offer...' : 'Send offer'}
                           </button>
                           <p className="mt-4 text-[9px] font-black text-blue-500/60 text-center uppercase tracking-widest leading-relaxed px-4">This will be sent to the customer as your official offer.</p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TechnicianDiscoverPage
