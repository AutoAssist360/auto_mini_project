import { useEffect, useState, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import { getJobById, createReview, getMyFiles, getInvoiceQrData, payInvoice, userLogout, getPartById, ApiError } from '../lib/api'
import { clearAuth } from '../store/authSlice'
import { addToCart, openCart } from '../store/cartSlice'
import { ListSkeleton } from '../components/Skeleton'
import MobileNav from '../components/MobileNav'
import Breadcrumbs from '../components/Breadcrumbs'
import LiveTracker from '../components/LiveTracker'
import FileUploader, { FileGallery } from '../components/FileUploader'
import { QRCodeSVG } from 'qrcode.react'
import { useSocket } from '../lib/useSocket'
import RequiredAsterisk from '../components/RequiredAsterisk'
import { formatLabel } from '../lib/displayText'

const STATUS_COLORS = {
  assigned: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  verified: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

function Badge({ status }) {
  const colors = {
    assigned: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    in_progress: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    completed: 'bg-green-500/10 text-green-500 border-green-500/20',
    verified: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
  }
  const style = colors[status] || 'bg-slate-500/10 text-slate-500 border-slate-500/20'
  return <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${style}`}>{formatLabel(status)}</span>
}

function InfoRow({ label, children }) {
  return (
    <div className="space-y-1">
      <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</p>
      <div className="text-[13px] font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">{children}</div>
    </div>
  )
}

function JobFiles({ jobId, dark, refreshKey }) {
  const [files, setFiles] = useState([])
  useEffect(() => {
    getMyFiles({ entity_type: 'job', entity_id: jobId }).then(r => setFiles(r.files || [])).catch(() => { })
  }, [jobId, refreshKey])
  if (files.length === 0) return null
  return <FileGallery files={files} dark={dark} />
}

// SuggestedParts: lets the user quickly add technician-suggested parts to the cart
function SuggestedParts({ parts, dispatch }) {
  const [partStatus, setPartStatus] = useState({})

  const handleAddToCart = useCallback(async (rp) => {
    const partId = rp.part?.part_id
    if (!partId) { setPartStatus(prev => ({ ...prev, [rp.request_part_id || rp.part_name]: 'error' })); return }
    const key = rp.request_part_id || partId
    setPartStatus(prev => ({ ...prev, [key]: 'loading' }))
    try {
      const data = await getPartById(partId)
      const part = data.part
      const inStock = (part.inventories || []).filter(inv => inv.in_stock)
      if (inStock.length === 0) { setPartStatus(prev => ({ ...prev, [key]: 'no_stock' })); return }
      const cheapest = inStock.reduce((a, b) => (a.unit_cost <= b.unit_cost ? a : b))
      dispatch(addToCart({ part_id: part.part_id, part_name: part.part_name, inventory_id: cheapest.inventory_id, warehouse_id: cheapest.warehouse_id, warehouse_name: cheapest.warehouse_name, unit_cost: cheapest.unit_cost, quantity: rp.quantity || 1 }))
      dispatch(openCart()); setPartStatus(prev => ({ ...prev, [key]: 'added' }))
    } catch { setPartStatus(prev => ({ ...prev, [rp.request_part_id || partId]: 'error' })) }
  }, [dispatch])

  const handleAddAllToCart = async () => {
    for (const rp of parts) { if (partStatus[rp.request_part_id || rp.part?.part_id] !== 'added') await handleAddToCart(rp) }
  }

  const allAdded = parts.every(rp => partStatus[rp.request_part_id || rp.part?.part_id] === 'added')

  return (
    <section className="p-8 lg:p-10 rounded-[40px] bg-white dark:bg-[#0B1120]/50 border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-600/5 blur-3xl rounded-full translate-x-12 -translate-y-12"></div>
      <div className="flex flex-wrap items-center justify-between gap-6 mb-8">
        <div className="w-full md:w-auto">
           <h2 className="text-sm md:text-base font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-amber-600 flex items-center justify-center text-white shrink-0">🔩</span>
              RECOMMENDED PARTS
           </h2>
           <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Buy the parts your technician recommended for this repair.</p>
        </div>
        {parts.length > 1 && !allAdded && (
           <button onClick={handleAddAllToCart} disabled={Object.values(partStatus).includes('loading')} className="w-full md:w-auto whitespace-nowrap h-11 px-6 rounded-2xl bg-amber-600 text-white text-[10px] md:text-xs font-black uppercase tracking-widest hover:bg-amber-500 shadow-lg shadow-amber-600/20 active:scale-95 transition-all">
              ADD ALL TO CART
           </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
               <th className="pb-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">PART</th>
               <th className="pb-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">QUANTITY</th>
               <th className="pb-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-900/50">
            {parts.map((rp, i) => {
              const key = rp.request_part_id || rp.part?.part_id || i
              const status = partStatus[key]
              return (
                <tr key={key}>
                  <td className="py-5 font-bold text-[12px] uppercase text-slate-900 dark:text-slate-100">{rp.part?.part_name || rp.part_name || 'Unknown part'}</td>
                  <td className="py-5 text-[12px] font-mono opacity-60">x{rp.quantity}</td>
                  <td className="py-5 text-right">
                    {status === 'added' ? <span className="text-[9px] font-black text-blue-500 uppercase italic">✓ ADDED</span> : 
                     status === 'no_stock' ? <span className="text-[9px] font-black text-red-500 uppercase">OUT OF STOCK</span> : 
                     status === 'error' ? <span className="text-[9px] font-black text-red-500 uppercase">TRY AGAIN</span> : (
                      <button disabled={status === 'loading'} onClick={() => handleAddToCart(rp)} className="whitespace-nowrap h-9 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] md:text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">
                        {status === 'loading' ? 'ADDING...' : 'ADD TO CART'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function UserJobDetailPage({ theme, onToggleTheme }) {
  const { jobId } = useParams()
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Review & Payment states
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [fileRefresh, setFileRefresh] = useState(0)
  const [reviewMsg, setReviewMsg] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [qrData, setQrData] = useState(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [payTxnId, setPayTxnId] = useState('')
  const [isPaying, setIsPaying] = useState(false)
  const [payMsg, setPayMsg] = useState('')
  const [payError, setPayError] = useState('')
  const { on, off } = useSocket(null)

  const loadJob = useCallback(async (signal) => {
    try {
      const data = await getJobById(jobId)
      if (!signal?.aborted) { setJob(data.job || data); setError('') }
    } catch (err) { if (!signal?.aborted) setError(err.message || 'Could not load job details') }
    finally { if (!signal?.aborted) setLoading(false) }
  }, [jobId])

  useEffect(() => {
    const abort = new AbortController(); loadJob(abort.signal)
    return () => abort.abort()
  }, [loadJob])

  useEffect(() => {
    const reload = () => loadJob().catch(() => null)
    const handleVisibility = () => { if (document.visibilityState === 'visible') reload() }
    on('notification:new', reload); on('user:jobs_refresh', reload); on('user:requests_refresh', reload)
    window.addEventListener('focus', reload); document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      off('notification:new', reload); off('user:jobs_refresh', reload); off('user:requests_refresh', reload)
      window.removeEventListener('focus', reload); document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [loadJob, off, on])

  const handleLogout = async () => { await userLogout().catch(() => null); dispatch(clearAuth()); navigate('/auth/user/signin') }

  const handleSubmitReview = async (e) => {
    e.preventDefault(); setReviewSubmitting(true); setReviewMsg(''); setReviewError('')
    try {
      await createReview({ job_id: jobId, rating: reviewRating, comment: reviewComment || undefined })
      setReviewMsg('Review submitted successfully.'); const data = await getJobById(jobId); setJob(data.job || data)
    } catch (err) { setReviewError(err.message || 'Could not submit your review') }
    finally { setReviewSubmitting(false) }
  }

  const invoice = job?.invoice
  useEffect(() => {
    if (!invoice || ['completed', 'refunded'].includes(invoice.payment_status)) { setQrData(null); return }
    setQrLoading(true)
    getInvoiceQrData(invoice.invoice_id).then(setQrData).catch(() => setQrData(null)).finally(() => setQrLoading(false))
  }, [invoice])

  const handlePayInvoice = async (e) => {
    e.preventDefault(); if (!payTxnId.trim() || !invoice) return
    setIsPaying(true); setPayMsg(''); setPayError('')
    try {
      await payInvoice(invoice.invoice_id, { payment_method: 'upi', transaction_id: payTxnId.trim() })
      setPayMsg('Payment confirmed.'); setPayTxnId(''); const data = await getJobById(jobId); setJob(data.job || data)
    } catch (err) { setPayError(err instanceof ApiError ? err.message : 'Payment failed') }
    finally { setIsPaying(false) }
  }

  const req = job?.request; const tech = job?.technician; const veh = req?.vehicle
  const canReview = job && ['completed', 'verified'].includes(job.status)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 transition-colors duration-500 pb-20 overflow-x-hidden">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/5 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <header className="mb-10 flex flex-wrap items-center justify-between gap-6 backdrop-blur-xl bg-white/50 dark:bg-[#0B1120]/50 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-2xl">
           <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
              <button onClick={() => navigate('/jobs')} className="shrink-0 w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-500 transition-all shadow-sm group">
                 <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="flex-1 min-w-[200px]">
                 <span className="text-[10px] md:text-xs font-black tracking-widest text-blue-600 dark:text-blue-400 uppercase">JOB DETAILS</span>
                 <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-tight flex flex-wrap items-center gap-3">
                   REPAIR JOB
                   {job?.status && <Badge status={job.status} />}
                 </h1>
              </div>
           </div>

           <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
             <button onClick={onToggleTheme} className="shrink-0 w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:border-blue-500/50 transition-all">
                {theme === 'dark' ? '🌞' : '🌙'}
             </button>
             <button onClick={handleLogout} className="whitespace-nowrap px-5 py-2.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] md:text-xs font-black tracking-widest uppercase hover:scale-105 transition-all shadow-lg active:scale-95">
                LOGOUT
             </button>
           </div>
        </header>

        <Breadcrumbs items={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'My Jobs', to: '/jobs' }, { label: 'Job Details' }]} />

        {loading ? <ListSkeleton rows={8} /> : error ? (
          <div className="mt-8 p-12 text-center rounded-3xl border border-red-500/20 bg-red-500/5">
             <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Could not load job</p>
             <p className="text-lg font-black text-slate-900 dark:text-white mt-2">{error}</p>
          </div>
        ) : job && (
          <div className="mt-8 space-y-6">

            {/* Live Tracker — Active Jobs */}
            {['assigned', 'in_progress'].includes(job.status) && (
              <div className="rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl">
                <div className="bg-blue-600 px-6 py-3 flex items-center justify-between">
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Live Technician Tracking</span>
                  <span className="flex items-center gap-2 text-[9px] font-bold text-white/80 uppercase">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping inline-block"></span>
                    Live
                  </span>
                </div>
                <LiveTracker
                  jobId={job.job_id} technicianName={tech?.user?.full_name}
                  initialLat={tech?.latitude} initialLng={tech?.longitude}
                  userLat={req?.breakdown_latitude} userLng={req?.breakdown_longitude}
                  dark={theme === 'dark'}
                />
                <div className="px-6 py-4 bg-white dark:bg-[#0B1120] border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Your technician's location updates live while they travel to you.</p>
                </div>
              </div>
            )}

            {/* Row 1: Job Overview + Technician */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Job Operational Info */}
              <div className="lg:col-span-2 p-8 rounded-3xl bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl"></div>
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <div className="shrink-0 w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <h2 className="text-sm md:text-base font-black text-slate-900 dark:text-white uppercase tracking-widest">Job Summary</h2>
                  <div className="ml-auto whitespace-nowrap"><Badge status={job.status} /></div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <InfoRow label="Job ID"><span className="font-mono text-[11px]">#{job.job_id.slice(0, 10)}…</span></InfoRow>
                  <InfoRow label="Started">{job.started_at ? new Date(job.started_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</InfoRow>
                  <InfoRow label="Completed">{job.completed_at ? new Date(job.completed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Still in progress'}</InfoRow>
                  {job.notes && <div className="col-span-2 md:col-span-3"><InfoRow label="Notes">{job.notes}</InfoRow></div>}
                </div>
              </div>

              {/* Technician Card */}
              {tech ? (
                <div className="p-8 rounded-3xl bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
                  <div className="absolute -top-8 -right-8 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl"></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5">Your Technician</p>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xl font-black flex-shrink-0">
                      {tech.user?.full_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-base font-black text-slate-900 dark:text-white leading-none">{tech.user?.full_name || '—'}</p>
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">Technician</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact</p>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{tech.user?.email || '—'}</p>
                    {req && (
                      <button onClick={() => navigate(`/requests/${req.request_id}/messages`)} className="w-full whitespace-nowrap h-11 mt-2 rounded-2xl bg-blue-600 text-white text-[10px] md:text-xs font-black uppercase tracking-widest hover:bg-blue-500 transition-all active:scale-95 shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        Message Technician
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-3xl bg-white dark:bg-[#0B1120] border border-dashed border-slate-200 dark:border-slate-800 shadow-xl flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Technician Assigned</p>
                </div>
              )}
            </div>

            {/* Row 2: Service Request + Vehicle */}
            {req && (
              <div className="p-8 rounded-3xl bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl"></div>
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <div className="shrink-0 w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                  <h2 className="text-sm md:text-base font-black text-slate-900 dark:text-white uppercase tracking-widest">Original Request</h2>
                  <button onClick={() => navigate(`/requests/${req.request_id}`)} className="whitespace-nowrap ml-auto w-full sm:w-auto mt-2 sm:mt-0 text-[10px] md:text-xs font-black text-blue-600 hover:text-blue-500 uppercase tracking-widest flex items-center justify-end gap-1">
                    View Request <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <InfoRow label="Issue Type">{formatLabel(req.issue_type) || '—'}</InfoRow>
                  <InfoRow label="Status"><Badge status={req.status} /></InfoRow>
                  <div className="md:col-span-2"><InfoRow label="Description">{req.issue_description || 'No description provided'}</InfoRow></div>
                  {veh && <>
                    <InfoRow label="Make">{veh.variant?.model?.company?.company_name || '—'}</InfoRow>
                    <InfoRow label="Model">{veh.variant?.model?.model_name || '—'} {veh.variant?.variant_name || ''}</InfoRow>
                    <InfoRow label="Registration"><span className="text-blue-600 font-black">{veh.registration_number || '—'}</span></InfoRow>
                  </>}
                </div>
              </div>
            )}

            {/* Row 3: Invoice and payment */}
            <div className="p-8 rounded-3xl bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl"></div>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="shrink-0 w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  </div>
                  <h2 className="text-sm md:text-base font-black text-slate-900 dark:text-white uppercase tracking-widest">Invoice and Payment</h2>
                </div>
                {invoice?.invoice_id && (
                  <button onClick={() => navigate(`/invoices/${invoice.invoice_id}`)} className="w-full md:w-auto whitespace-nowrap px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 transition-all">
                    Open Full Invoice ↗
                  </button>
                )}
              </div>

              {!invoice ? (
                <div className="py-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center text-slate-400">
                  <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-[10px] font-black uppercase tracking-widest">Invoice not ready yet</p>
                  <p className="text-xs mt-1 opacity-60">It will appear after the technician finishes their work report.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                  {/* Invoice Summary */}
                  <div className="space-y-4">
                    <div className="flex items-baseline justify-between p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Amount</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">₹{invoice.total}</p>
                      </div>
                      <Badge status={invoice.payment_status} />
                    </div>
                    {invoice.items && invoice.items.length > 0 && (
                      <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                              <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Item</th>
                              <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Qty</th>
                              <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Unit</th>
                              <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoice.items.map((item, i) => (
                              <tr key={item.invoice_item_id || i} className="border-b last:border-0 border-slate-50 dark:border-slate-900">
                                <td className="px-4 py-3 text-xs font-semibold text-slate-700 dark:text-slate-200">{item.description || '—'}</td>
                                <td className="px-4 py-3 text-xs font-mono text-slate-500 text-center">{item.quantity}</td>
                                <td className="px-4 py-3 text-xs font-mono text-slate-500 text-right">₹{item.unit_price}</td>
                                <td className="px-4 py-3 text-xs font-black text-slate-900 dark:text-white text-right">₹{item.total}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* UPI Payment */}
                  {invoice.payment_status !== 'completed' && invoice.payment_status !== 'refunded' ? (
                    <div className="p-6 rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 space-y-5">
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest text-center">Pay with UPI</p>
                      {qrLoading ? (
                        <div className="h-36 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
                      ) : qrData?.upi_url ? (
                        <div className="flex flex-col items-center gap-4">
                          <div className="p-3 bg-white rounded-2xl border border-blue-100 shadow-sm inline-block">
                            <QRCodeSVG value={qrData.upi_url} size={130} level="M" />
                          </div>
                          <div className="text-center space-y-1">
                            <p className="text-xs font-black text-slate-700 dark:text-slate-200">₹{qrData.amount}</p>
                            <p className="text-[9px] text-slate-400 uppercase">Pay to: {qrData.upi_name || qrData.upi_id || qrData.admin_upi_id}</p>
                            <a href={qrData.upi_url} className="text-[10px] font-black text-blue-600 hover:underline uppercase">Open UPI App ↗</a>
                          </div>
                        </div>
                      ) : null}
                      <hr className="border-blue-200 dark:border-blue-900" />
                      <form onSubmit={handlePayInvoice} className="space-y-3">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          Already paid? Add your transaction ID
                          <RequiredAsterisk className="ml-0.5" />
                        </p>
                        <input value={payTxnId} onChange={(e) => setPayTxnId(e.target.value)} placeholder="Enter UPI transaction ID" className="w-full h-11 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-700 px-4 text-xs font-semibold focus:border-blue-500 outline-none transition-all" />
                        <button type="submit" disabled={isPaying || !payTxnId.trim()} className="w-full h-11 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all disabled:opacity-40">
                          {isPaying ? 'Confirming…' : 'Confirm Payment'}
                        </button>
                        {payMsg && <p className="text-[10px] font-black text-emerald-500 uppercase text-center">{payMsg}</p>}
                        {payError && <p className="text-[10px] font-black text-red-500 uppercase text-center">{payError}</p>}
                      </form>
                    </div>
                  ) : (
                    <div className="p-6 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/10 flex flex-col items-center justify-center text-center gap-3 h-full min-h-[120px]">
                      <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Payment Complete</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Parts Suggested */}
            {req?.parts && req.parts.length > 0 && <SuggestedParts parts={req.parts} dispatch={dispatch} />}

            {/* Work photos */}
            {['in_progress', 'completed', 'verified'].includes(job.status) && (
              <div className="p-8 rounded-3xl bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-xl bg-slate-700 dark:bg-slate-600 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Work Photos and Files</h2>
                </div>
                {job.status === 'in_progress' && (
                  <div className="mb-5 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700">
                    <FileUploader onUploadComplete={() => setFileRefresh(prev => prev + 1)} entityType="job" entityId={job.job_id} accept="image/*,video/mp4,application/pdf" multiple dark={theme === 'dark'} />
                  </div>
                )}
                <JobFiles jobId={job.job_id} dark={theme === 'dark'} refreshKey={fileRefresh} />
              </div>
            )}

            {/* Review */}
            {canReview && (
              <div className="p-8 rounded-3xl bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 shadow-xl max-w-2xl mx-auto w-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white">★</div>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Rate Your Experience</h2>
                </div>
                {reviewMsg ? (
                  <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-black text-[10px] uppercase text-center tracking-widest">{reviewMsg}</div>
                ) : (
                  <form onSubmit={handleSubmitReview} className="space-y-5">
                    {reviewError && <p className="text-[10px] font-black text-red-500 uppercase">{reviewError}</p>}
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Rating</p>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button key={star} type="button" onClick={() => setReviewRating(star)} className={`text-3xl transition-all hover:scale-110 ${star <= reviewRating ? 'text-amber-400' : 'text-slate-200 dark:text-slate-700'}`}>★</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Comment <span className="opacity-50">(Optional)</span></p>
                      <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} maxLength={2000} rows={3} className="w-full rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 text-sm font-medium outline-none focus:border-blue-500 transition-all resize-none" placeholder="Share your experience…" />
                    </div>
                    <button type="submit" disabled={reviewSubmitting} className="w-full h-12 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all">
                      {reviewSubmitting ? 'Submitting…' : 'Submit Review'}
                    </button>
                  </form>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}

export default UserJobDetailPage
