import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { ApiError, cancelPendingTechnicianBooking, cancelServiceRequest, closePendingTechnicianBooking, getRankedTechnicians, bookTechnician, getServiceRequestById, getRequestOffers, acceptOffer, rejectOffer, userLogout, getPlatformFeeQr, createServiceRequest } from '../lib/api'
import { clearAuth } from '../store/authSlice'
import RequestStepper from '../components/RequestStepper'
import { QRCodeSVG } from 'qrcode.react'
import { useSocket } from '../lib/useSocket'
import { formatLabel } from '../lib/displayText'

const STATUS_COLORS = {
  created: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  pending_offers: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  offer_accepted: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  accepted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

const DIRECT_SELECTION_MESSAGE = 'User selected you directly.'

function getAssignmentDeadlineMs(request) {
  if (request?.status !== 'offer_accepted' || request?.job?.status !== 'assigned') return null

  const expiresAt = request?.job?.assignment_expires_at
  const parsed = expiresAt ? Date.parse(expiresAt) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

function getOpenRequestDeadlineMs(request, offers) {
  if (!request || (request.status !== 'created' && request.status !== 'pending_offers')) return null

  const activeOffers = offers?.filter(o => ['pending', 'accepted'].includes(o.status)) || []
  if (activeOffers.length > 0) return null

  const requestCreatedMs = request.created_at ? Date.parse(request.created_at) : 0
  const closedOffers = offers?.filter(o => ['rejected', 'withdrawn', 'cancelled'].includes(o.status)) || []
  
  let baseTime = requestCreatedMs
  if (closedOffers.length > 0) {
    const latestClosed = Math.max(...closedOffers.map(o => Date.parse(o.updated_at)))
    if (latestClosed > baseTime) {
      baseTime = latestClosed
    }
  }

  return baseTime > 0 ? baseTime + 5 * 60 * 1000 : null
}

function formatCountdown(ms) {
  const safeMs = Math.max(0, ms)
  const totalSeconds = Math.ceil(safeMs / 1000)
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

/* ── Platform Fee QR Section ─────────────────────────────────── */
function PlatformFeeQR() {
  const [qrData, setQrData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getPlatformFeeQr()
      .then(setQrData)
      .catch(() => setError('Could not load the QR code. Please try again.'))
      .finally(() => setLoading(false))
  }, [])

  const handleCopy = () => {
    if (!qrData?.upi_id) return
    navigator.clipboard.writeText(qrData.upi_id).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <section className="mt-8 overflow-hidden rounded-[40px] border border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/10 backdrop-blur-md shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl shadow-inner">
            💳
          </div>
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-tight">PLATFORM FEE — ₹99</h2>
            <p className="text-xs font-bold text-blue-100 uppercase tracking-widest opacity-80">
              Pay this fee to confirm your technician
            </p>
          </div>
        </div>
      </div>

      <div className="p-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <span className="text-[10px] font-black tracking-widest text-blue-500 uppercase">Loading QR code...</span>
          </div>
        )}

        {error && (
          <div className="py-10 text-center">
             <p className="text-sm font-bold text-red-500 uppercase tracking-tight">{error}</p>
          </div>
        )}

        {qrData && !loading && (
          <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center">
            <div className="relative group">
              <div className="absolute -inset-4 bg-blue-500/20 rounded-[40px] blur-xl opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
              <div className="relative rounded-3xl border-4 border-white dark:border-slate-800 bg-white p-4 shadow-2xl">
                <QRCodeSVG
                  value={qrData.upi_url}
                  size={200}
                  level="H"
                  marginSize={2}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                />
              </div>
              <p className="mt-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                SCAN WITH ANY UPI APP
              </p>
            </div>

            <div className="flex-1 w-full space-y-4">
              <div className="rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-6 text-center lg:text-left shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">AMOUNT TO PAY</p>
                <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">₹{qrData.amount}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 px-5 py-4 group">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">UPI ID</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black text-slate-900 dark:text-white font-mono truncate">{qrData.upi_id}</p>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                      title="Copy UPI ID"
                    >
                      {copied ? '✓' : '📋'}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 px-5 py-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">PAY TO</p>
                  <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{qrData.upi_name}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-5 py-4">
                <p className="text-[9px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest mb-1">REFERENCE ID</p>
                <p className="text-[10px] font-mono font-bold text-amber-700 dark:text-amber-400 break-all">{qrData.reference}</p>
              </div>

              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                Payment is usually updated quickly after you pay.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

/* ── Main Page ───────────────────────────────────────────────── */
function UserRequestDetailPage({ theme, onToggleTheme }) {
  const { requestId } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const [request, setRequest] = useState(null)
  const [offers, setOffers] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [actionMessage, setActionMessage] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [bookingTechId, setBookingTechId] = useState(null)
  const [showManualSelection, setShowManualSelection] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const { on, off } = useSocket(null)

  const loadRequestData = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const requestResponse = await getServiceRequestById(requestId)
      const reqData = requestResponse?.serviceRequest || null
      setRequest(reqData)
      if (reqData && reqData.status !== 'cancelled' && reqData.status !== 'rejected') {
        try {
          const offersResponse = await getRequestOffers(requestId)
          setOffers(offersResponse?.offers || [])
        } catch { setOffers([]) }
      } else { setOffers([]) }
      if (reqData && (reqData.status === 'created' || reqData.status === 'pending_offers')) {
        const techsResponse = await getRankedTechnicians(requestId)
        setTechnicians(techsResponse?.technicians || [])
      } else { setTechnicians([]) }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load request details.')
    } finally { setIsLoading(false) }
  }, [requestId])

  useEffect(() => { loadRequestData() }, [loadRequestData])

  useEffect(() => {
    const assignmentDeadlineMs = getAssignmentDeadlineMs(request)
    const openRequestDeadlineMs = getOpenRequestDeadlineMs(request, offers)

    if (!assignmentDeadlineMs && !openRequestDeadlineMs) return undefined

    setNow(Date.now())
    const timerId = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timerId)
  }, [request, offers])

  useEffect(() => {
    const reload = () => { loadRequestData().catch(() => null) }
    const handleVisibility = () => { if (document.visibilityState === 'visible') reload() }
    on('notification:new', reload)
    on('user:requests_refresh', reload)
    on('user:jobs_refresh', reload)
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      off?.('notification:new', reload)
      off?.('user:requests_refresh', reload)
      off?.('user:jobs_refresh', reload)
      window.removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [loadRequestData, off, on])

  const handleBookTechnician = async (techId) => {
    setBookingTechId(techId)
    setActionLoading(true)
    setError('')
    try {
      await bookTechnician(requestId, techId)
      setActionMessage('Request sent. Waiting for the technician to confirm.')
      await loadRequestData()
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to select this technician.') }
    finally { setActionLoading(false); setBookingTechId(null) }
  }

  const handleAcceptOffer = async (offerId) => {
    setActionLoading(true)
    try {
      await acceptOffer(offerId)
      setActionMessage('Offer accepted. Please pay the platform fee below to continue.')
      await loadRequestData()
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to accept offer.') }
    finally { setActionLoading(false) }
  }

  const handleRejectOffer = async (offerId) => {
    if (!window.confirm('Do you want to reject this offer?')) return
    setActionLoading(true)
    try {
      await rejectOffer(offerId)
      setActionMessage('Offer rejected.')
      await loadRequestData()
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to reject offer.') }
    finally { setActionLoading(false) }
  }

  const handleCancelRequest = async () => {
    if (!window.confirm('Do you want to cancel this request?')) return
    setActionLoading(true)
    try {
      await cancelServiceRequest(requestId)
      setActionMessage('Request cancelled.')
      await loadRequestData()
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to cancel request.') }
    finally { setActionLoading(false) }
  }

  const handleCancelPendingBooking = async () => {
    if (!window.confirm('Do you want to re-ping this technician with a new assignment?')) return
    setActionLoading(true)
    try {
      const techId = request?.job?.technician_id
      await cancelPendingTechnicianBooking(requestId)
      if (techId) {
         await bookTechnician(requestId, techId)
         setActionMessage('Technician re-pinged successfully.')
      } else {
         setActionMessage('Issue resent.')
      }
      await loadRequestData()
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to re-ping technician.') }
    finally { setActionLoading(false) }
  }

  const handleClosePendingBooking = async () => {
    if (!window.confirm('Do you want to close this issue?')) return
    setActionLoading(true)
    try {
      await closePendingTechnicianBooking(requestId)
      setActionMessage('Request closed.')
      await loadRequestData()
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to close this request.') }
    finally { setActionLoading(false) }
  }

  const handleResendIssue = async () => {
    if (!window.confirm('Do you want to close this request and generate a new one?')) return
    setActionLoading(true)
    setError('')
    try {
      await cancelServiceRequest(requestId)
      const payload = {
        vehicle_id: request.vehicle_id || request?.vehicle?.vehicle_id,
        issue_description: request.issue_description,
        issue_type: request.issue_type,
        breakdown_latitude: request.breakdown_latitude,
        breakdown_longitude: request.breakdown_longitude,
        service_location_type: request.service_location_type,
        requires_towing: request.requires_towing
      }
      const newReq = await createServiceRequest(payload)
      setActionMessage('Issue resent! Redirecting...')
      setTimeout(() => navigate(`/requests/${newReq.serviceRequest.request_id}`), 1000)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to resend issue.')
      setActionLoading(false)
    }
  }

  const handleLogout = async () => {
    await userLogout().catch(() => null)
    dispatch(clearAuth())
    navigate('/auth/user/signin')
  }

  const isDirectSelectionOffer = (offer) => offer.message?.includes(DIRECT_SELECTION_MESSAGE)
  const canCancelRequest = request && ['created', 'pending_offers'].includes(request.status)
  const canCancelPendingBooking = request?.status === 'offer_accepted' && request?.job?.status === 'assigned'
  const assignmentDeadlineMs = getAssignmentDeadlineMs(request)
  const assignmentRemainingMs = assignmentDeadlineMs != null ? assignmentDeadlineMs - now : null
  const isAssignmentTimerExpired = canCancelPendingBooking && assignmentDeadlineMs != null && assignmentRemainingMs <= 0
  const canResolvePendingBooking = canCancelPendingBooking && (assignmentDeadlineMs == null || isAssignmentTimerExpired)

  const openRequestDeadlineMs = getOpenRequestDeadlineMs(request, offers)
  const isWaitingForOffers = openRequestDeadlineMs !== null
  const openRequestRemainingMs = openRequestDeadlineMs != null ? openRequestDeadlineMs - now : null
  const isOpenRequestTimerExpired = openRequestRemainingMs !== null && openRequestRemainingMs <= 0

  const statusBadge = STATUS_COLORS[request?.status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
  const formatCurrency = (v) => (v != null ? `Rs ${Number(v).toLocaleString('en-IN')}` : 'N/A')
  const showPlatformFeeQr = request && ['offer_accepted', 'in_progress', 'completed'].includes(request.status)
  const jobStatusLabel = request?.job?.status === 'assigned' ? 'Technician getting ready' : formatLabel(request?.job?.status)
  const requestCreatedLabel = request?.created_at ? new Date(request.created_at).toLocaleString() : 'Not available'
  const showManualSelectionToggle = (request?.status === 'created' || request?.status === 'pending_offers') && technicians.length > 0
  const isRejectedRequest = request?.status === 'rejected'
  const canOpenMessages = ['offer_accepted', 'in_progress', 'completed'].includes(request?.status) && request?.job?.status !== 'assigned'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 transition-colors duration-500">
      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Floating Header */}
        <header className="mb-8 flex items-center justify-between">
           <Link to="/requests" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center group-hover:border-blue-500 transition-all shadow-sm">
                <svg className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </div>
              <span className="text-xs font-black tracking-widest uppercase text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">BACK TO REQUESTS</span>
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

        {error && <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold animate-in fade-in zoom-in">{error}</div>}
        {actionMessage && <div className="mb-6 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold animate-in fade-in zoom-in">✅ {actionMessage}</div>}

        {isLoading ? (
          <div className="space-y-6 animate-pulse">
            <div className="h-24 bg-white dark:bg-slate-900 rounded-[40px]"></div>
            <div className="h-64 bg-white dark:bg-slate-900 rounded-[40px]"></div>
          </div>
        ) : !request ? (
          <div className="text-center py-20 px-8 rounded-[40px] bg-white dark:bg-[#0B1120]/50 border border-slate-200 dark:border-slate-800">
             <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-3xl mx-auto mb-6">🚫</div>
             <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Request Not Found</h2>
             <p className="text-slate-500 text-sm mt-2">This request may have been removed, or the link may be incorrect.</p>
             <Link to="/requests" className="mt-8 inline-block px-8 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-500 transition-all">Back to Requests</Link>
          </div>
        ) : (
          <div className="space-y-8 pb-20">
            <RequestStepper status={request.status} />

            {isRejectedRequest && (
              <section className="rounded-[32px] border border-red-500/20 bg-red-500/10 p-5 text-sm font-semibold text-red-700 shadow-lg dark:text-red-300">
                This request was automatically closed because no technician accepted it before the day ended. Please raise a new issue if you still need help.
              </section>
            )}

            {/* Open Request Timer Banner */}
            {!request.job && isWaitingForOffers && (
              <section className="rounded-[40px] border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent p-6 md:p-10 shadow-2xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-3xl rounded-full"></div>
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-8">
                   <div className="max-w-md">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500 text-white text-[9px] font-black tracking-widest uppercase mb-4 shadow-lg shadow-amber-500/20">
                         Looking for technicians
                      </div>
                      <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Finding a nearby technician</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">We have sent your issue to technicians in your area.</p>

                      <div className={`mt-5 rounded-3xl border p-5 ${isOpenRequestTimerExpired ? 'border-red-500/30 bg-red-500/10' : 'border-amber-500/20 bg-amber-500/10'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isOpenRequestTimerExpired ? 'text-red-600 dark:text-red-300' : 'text-amber-600 dark:text-amber-300'}`}>
                          Waiting time
                        </p>
                        <p className="mt-2 text-4xl font-black tracking-tighter text-slate-900 dark:text-white">
                           {openRequestRemainingMs == null ? 'Timer unavailable' : formatCountdown(openRequestRemainingMs)}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                           {isOpenRequestTimerExpired
                              ? '5 minutes have passed. You can resend the request or close it entirely.'
                              : 'Waiting for technicians to accept your issue...'}
                        </p>
                      </div>
                   </div>
                   <div className="flex flex-col gap-3 w-full sm:w-auto">
                      {isOpenRequestTimerExpired ? (
                        <>
                          <button onClick={handleResendIssue} disabled={actionLoading} className="h-14 px-10 bg-amber-500 text-white hover:bg-amber-400 font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all active:scale-95 disabled:opacity-60 shadow-lg shadow-amber-500/20">
                             Resend issue
                          </button>
                          <button onClick={handleCancelRequest} disabled={actionLoading} className="h-14 px-10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all active:scale-95 disabled:opacity-60">
                             Close request
                          </button>
                        </>
                      ) : (
                        <button type="button" disabled className="h-14 px-10 border border-slate-200 dark:border-slate-800 text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl cursor-not-allowed opacity-70">
                           Wait for technicians
                        </button>
                      )}
                   </div>
                </div>
              </section>
            )}

            {/* Core Details Panel */}
            <section className="rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#0B1120]/50 p-6 md:p-10 shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full"></div>
               
               <div className="relative z-10">
                 <div className="flex flex-wrap items-center justify-between gap-4 mb-10 pb-6 border-b border-slate-100 dark:border-slate-800/50">
                    <div>
                      <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Request details</span>
                      <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{formatLabel(request.issue_type)}</h2>
                      <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Created on {requestCreatedLabel}</p>
                    </div>
                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${statusBadge}`}>
                       {formatLabel(request.status)}
                    </div>
                 </div>

                 <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                    <div className="space-y-1">
                       <span className="text-[9px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase">Problem</span>
                       <p className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-tight">{formatLabel(request.issue_type)}</p>
                    </div>
                    <div className="space-y-1">
                       <span className="text-[9px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase">Help needed at</span>
                       <p className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">{formatLabel(request.service_location_type)}</p>
                    </div>
                    <div className="space-y-1">
                       <span className="text-[9px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase">Towing</span>
                       <p className={`text-xs font-extrabold uppercase tracking-tight ${request.requires_towing ? 'text-amber-500' : 'text-slate-400'}`}>{request.requires_towing ? 'Needed' : 'Not needed'}</p>
                    </div>
                    <div className="space-y-1">
                       <span className="text-[9px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase">Vehicle</span>
                       <p className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">{request.vehicle?.registration_number || 'UNKNOWN'}</p>
                    </div>
                 </div>

                 <div className="mt-10 p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50">
                    <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase block mb-3">What happened</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">{request.issue_description}</p>
                 </div>

                 <div className="mt-8 flex flex-wrap gap-4">
                    {canCancelRequest && (
                      <button onClick={handleCancelRequest} disabled={actionLoading} className="px-6 py-2.5 bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest border border-red-500/20 transition-all active:scale-95">
                        {actionLoading ? 'Processing...' : 'Cancel request'}
                      </button>
                    )}
                    {canOpenMessages ? (
                      <button onClick={() => navigate(`/requests/${requestId}/messages`)} className="px-6 py-2.5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all active:scale-95">
                        Open messages
                      </button>
                    ) : (
                      <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                        You can message the technician after they accept
                      </div>
                    )}
                 </div>
               </div>
            </section>

            {showPlatformFeeQr && <PlatformFeeQR />}

            {/* Technician Offers Section */}
            {offers.length > 0 && (request.status === 'created' || request.status === 'pending_offers' || request.status === 'offer_accepted') && (
              <section className="space-y-6">
                 <div className="flex items-center gap-3 px-2">
                    <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1"></div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Technician offers ({offers.length})</h3>
                    <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1"></div>
                 </div>

                 <div className="grid md:grid-cols-2 gap-6">
                    {offers.map(offer => (
                      <div key={offer.offer_id} className="group relative rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900/40 p-6 shadow-xl hover:border-blue-500/30 transition-all">
                        <div className="flex items-start justify-between gap-4 mb-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-xl font-black text-blue-600">
                               {offer.technician?.user?.full_name?.[0] || 'T'}
                            </div>
                            <div>
                               <h4 className="font-black text-slate-900 dark:text-white tracking-tight uppercase">{offer.technician?.user?.full_name || 'Technician'}</h4>
                               <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">{formatLabel(offer.repair_mode)}</p>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${STATUS_COLORS[offer.status] || 'bg-slate-100 text-slate-700'}`}>
                             {formatLabel(offer.status)}
                          </span>
                        </div>

                        {!isDirectSelectionOffer(offer) && (
                          <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 text-center">
                               <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Estimated cost</p>
                               <p className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(offer.estimated_cost)}</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 text-center">
                               <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Estimated time</p>
                               <p className="text-lg font-black text-slate-900 dark:text-white">{offer.estimated_time} min</p>
                            </div>
                          </div>
                        )}

                        {offer.message && (
                          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 italic text-xs text-slate-600 dark:text-slate-400 mb-6 font-medium">
                            "{offer.message}"
                          </div>
                        )}

                        {offer.status === 'pending' && request.status !== 'offer_accepted' && (
                          <div className="flex gap-3">
                             <button onClick={() => handleAcceptOffer(offer.offer_id)} disabled={actionLoading} className="flex-1 h-12 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all">
                                Accept offer
                             </button>
                             <button onClick={() => handleRejectOffer(offer.offer_id)} disabled={actionLoading} className="px-6 h-12 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white font-black text-[10px] uppercase tracking-widest rounded-2xl active:scale-95 transition-all">
                                Reject
                             </button>
                          </div>
                        )}
                      </div>
                    ))}
                 </div>
              </section>
            )}

            {/* Assigned Job Status Banner */}
            {request.job && (
              <section className="rounded-[40px] border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 to-transparent p-6 md:p-10 shadow-2xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-3xl rounded-full"></div>
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-8">
                   <div className="max-w-md">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-600 text-white text-[9px] font-black tracking-widest uppercase mb-4 shadow-lg shadow-indigo-600/20">
                         Assigned
                      </div>
                      <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Your technician is getting ready</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Current status: <span className="text-indigo-600 dark:text-indigo-400 font-black uppercase">{jobStatusLabel}</span>.</p>
                      {canCancelPendingBooking && (
                        <div className={`mt-5 rounded-3xl border p-5 ${canResolvePendingBooking ? 'border-red-500/30 bg-red-500/10' : 'border-indigo-500/20 bg-indigo-500/10'}`}>
                          <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${canResolvePendingBooking ? 'text-red-600 dark:text-red-300' : 'text-indigo-600 dark:text-indigo-300'}`}>
                            Technician confirmation timer
                          </p>
                          <p className="mt-2 text-4xl font-black tracking-tighter text-slate-900 dark:text-white">
                            {assignmentDeadlineMs == null ? 'Timer unavailable' : formatCountdown(assignmentRemainingMs)}
                          </p>
                          <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {assignmentDeadlineMs == null
                              ? 'Timer details are unavailable. You can resend the issue or close it.'
                              : isAssignmentTimerExpired
                              ? 'The 5 minute window is over. You can resend the issue or close it.'
                              : 'Please wait while the technician confirms. Options unlock if they do not respond in time.'}
                          </p>
                        </div>
                      )}
                   </div>
                   <div className="flex flex-col gap-3 w-full sm:w-auto">
                      {request.job.status !== 'assigned' && (
                        <button onClick={() => navigate(`/jobs/${request.job.job_id}`)} className="h-14 px-10 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-2xl shadow-indigo-600/30 transition-all active:scale-95">
                           View job details
                        </button>
                      )}
                      {canResolvePendingBooking ? (
                        <>
                          <button onClick={handleCancelPendingBooking} disabled={actionLoading} className="h-14 px-10 bg-amber-500 text-white hover:bg-amber-400 font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all active:scale-95 disabled:opacity-60">
                             Resend issue
                          </button>
                          <button onClick={handleClosePendingBooking} disabled={actionLoading} className="h-14 px-10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all active:scale-95 disabled:opacity-60">
                             Close request
                          </button>
                        </>
                      ) : canCancelPendingBooking ? (
                        <button type="button" disabled className="h-14 px-10 border border-slate-200 dark:border-slate-800 text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl cursor-not-allowed opacity-70">
                           Wait for timer
                        </button>
                      ) : null}
                   </div>
                </div>
              </section>
            )}

            {showManualSelectionToggle && (
              <section className="rounded-[32px] border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900/30 p-6 shadow-xl">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Choose a technician yourself</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Open the list if you want to compare nearby technicians and pick one yourself.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowManualSelection((current) => !current)}
                    className="rounded-2xl border border-blue-500/20 bg-blue-600 px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 active:scale-95"
                  >
                    {showManualSelection ? 'Hide technicians' : `Show technicians (${technicians.length})`}
                  </button>
                </div>
              </section>
            )}

            {/* Recommended Section - Only if created/pending */}
            {(request.status === 'created' || request.status === 'pending_offers') && technicians.length > 0 && showManualSelection && (
               <section className="space-y-6">
                 <div className="flex items-center gap-3 px-2">
                    <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1"></div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Available technicians</h3>
                    <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1"></div>
                 </div>

                 <div className="grid md:grid-cols-2 gap-6">
                    {technicians.map((tech, i) => (
                      <div key={tech.technician_id} className="group relative rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900/40 p-6 shadow-xl hover:border-blue-500/30 transition-all">
                        {i === 0 && <div className="absolute top-6 right-6 px-3 py-1 bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-amber-500/20">Top match</div>}
                        
                        <div className="flex items-center gap-4 mb-8">
                           <div className="w-14 h-14 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl font-black text-blue-600">
                              {tech.user?.full_name?.[0] || 'T'}
                           </div>
                           <div>
                              <h4 className="text-lg font-black text-slate-900 dark:text-white tracking-tight uppercase">{tech.business_name || tech.user?.full_name || 'Technician'}</h4>
                              <p className="text-xs font-black text-blue-600 tracking-tight">{tech.matchScore}% match</p>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-8">
                           <div className="space-y-1 px-1">
                              <span className="text-[9px] font-black text-slate-400 uppercase">Distance</span>
                              <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100">{tech.distance_km != null ? `${tech.distance_km} km` : 'Nearby'}</p>
                           </div>
                           <div className="space-y-1 px-1">
                              <span className="text-[9px] font-black text-slate-400 uppercase">Rating</span>
                              <div className="flex items-center gap-1">
                                 <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100">{tech.rating > 0 ? tech.rating : 'New'}</p>
                                 <span className="text-amber-500 text-xs">★</span>
                                 <span className="text-[9px] font-bold text-slate-400">({tech.total_reviews})</span>
                              </div>
                           </div>
                        </div>

                        <button 
                          onClick={() => handleBookTechnician(tech.technician_id)}
                          disabled={Boolean(bookingTechId) || actionLoading} 
                          className="w-full h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-blue-600 dark:hover:bg-blue-500 dark:hover:text-white transition-all active:scale-95 shadow-lg disabled:opacity-50"
                        >
                          {bookingTechId === tech.technician_id ? 'Sending request...' : 'Choose this technician'}
                        </button>
                      </div>
                    ))}
                 </div>
               </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default UserRequestDetailPage
