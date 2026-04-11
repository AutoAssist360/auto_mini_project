import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { ApiError, getInvoiceById, payInvoice, getInvoiceQrData, userLogout } from '../lib/api'
import { clearAuth } from '../store/authSlice'
import generateInvoicePDF from '../lib/generateInvoicePDF'
import MobileNav from '../components/MobileNav'
import Breadcrumbs from '../components/Breadcrumbs'
import { QRCodeSVG } from 'qrcode.react'
import RequiredAsterisk from '../components/RequiredAsterisk'
import { formatLabel } from '../lib/displayText'

const PAYMENT_COLORS = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  refunded: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20',
}

function formatCurrency(value) {
  if (value == null) return 'N/A'
  return `₹${Number(value).toLocaleString('en-IN')}`
}

function UserInvoiceDetailPage({ theme, onToggleTheme }) {
  const { invoiceId } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const [invoice, setInvoice] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [payment, setPayment] = useState({ payment_method: 'upi', transaction_id: '' })
  const [isPaying, setIsPaying] = useState(false)
  const [message, setMessage] = useState('')
  const [manualId, setManualId] = useState('')
  const [qrData, setQrData] = useState(null)
  const [qrLoading, setQrLoading] = useState(false)
  const invoiceDate = invoice?.issued_at || invoice?.created_at

  const loadInvoice = useCallback(async (targetInvoiceId = invoiceId) => {
    if (!targetInvoiceId?.trim()) return

    setIsLoading(true)
    setError('')
    setMessage('')

    try {
      const response = await getInvoiceById(targetInvoiceId.trim())
      setInvoice(response?.invoice || null)
    } catch (err) {
      setInvoice(null)
      if (err instanceof ApiError) setError(err.message)
      else setError('Unable to load invoice details.')
    } finally {
      setIsLoading(false)
    }
  }, [invoiceId])

  useEffect(() => {
    if (invoiceId) {
      loadInvoice(invoiceId)
    }
  }, [invoiceId, loadInvoice])

  const loadQr = useCallback(async (inv) => {
    if (!inv || inv.payment_status === 'completed' || inv.payment_status === 'refunded') return
    setQrLoading(true)
    try {
      const data = await getInvoiceQrData(inv.invoice_id)
      setQrData(data)
    } catch {
      setQrData(null)
    } finally {
      setQrLoading(false)
    }
  }, [])

  useEffect(() => {
    if (invoice) loadQr(invoice)
  }, [invoice, loadQr])

  const handlePay = async (event) => {
    event.preventDefault()
    const activeInvoiceId = invoice?.invoice_id || invoiceId
    if (!activeInvoiceId || !payment.transaction_id.trim()) return

    setIsPaying(true)
    setError('')
    setMessage('')

    try {
      await payInvoice(activeInvoiceId, {
        payment_method: payment.payment_method,
        transaction_id: payment.transaction_id.trim(),
      })

      setMessage('Invoice payment successful.')
      setPayment((prev) => ({ ...prev, transaction_id: '' }))
      await loadInvoice(activeInvoiceId)
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError('Unable to complete invoice payment.')
    } finally {
      setIsPaying(false)
    }
  }

  const handleLogout = async () => {
    await userLogout().catch(() => null)
    dispatch(clearAuth())
    navigate('/auth/user/signin')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] transition-colors duration-500">
      {/* Background Orbs */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] right-[5%] w-[35%] h-[35%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[10%] left-[5%] w-[35%] h-[35%] bg-emerald-600/5 dark:bg-emerald-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Navigation / Header */}
        <header className="mb-6 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-6 py-3 shadow-xl flex items-center justify-between transition-all">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="group w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:border-blue-500/50 transition-all">
              <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="hidden sm:block">
              <span className="text-[10px] font-black tracking-widest text-blue-600 dark:text-blue-400 uppercase leading-none">INVOICE</span>
              <h1 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mt-0.5">Invoice Details</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <MobileNav>
              <button onClick={onToggleTheme} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm shadow-sm transition-all">{theme === 'dark' ? '🌞' : '🌙'}</button>
              <button onClick={() => navigate('/dashboard')} className="px-5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-all">Dashboard</button>
              <button onClick={handleLogout} className="px-5 py-2.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg">LOGOUT</button>
            </MobileNav>
          </div>
        </header>

        <div className="mb-6">
          <Breadcrumbs items={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Invoices', to: '/invoices' }, { label: 'Invoice Details' }]} />
        </div>

        {/* Global Controls & Status */}
        <section className="mb-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120]/50 p-6 shadow-xl relative overflow-hidden group">
          <div className="relative z-10">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Find an invoice</h2>
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-0 sm:min-w-[280px]">
                <input
                  value={manualId}
                  onChange={(event) => setManualId(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter' && manualId.trim()) navigate(`/invoices/${manualId.trim()}`) }}
                  className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-5 text-sm font-semibold outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all"
                  placeholder="Enter an invoice ID..."
                />
              </div>
              <button 
                type="button" 
                onClick={() => { if (manualId.trim()) navigate(`/invoices/${manualId.trim()}`) }} 
                className="h-12 px-8 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-50"
                disabled={isLoading || !manualId.trim()}
              >
                {isLoading ? 'SEARCHING...' : 'OPEN INVOICE'}
              </button>
            </div>
          </div>
          
          {/* Status Indicators */}
          {(error || message) && (
             <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 duration-300">
                {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-widest">⚠️ {error}</div>}
                {message && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest">✅ {message}</div>}
             </div>
          )}
        </section>

        {invoice && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            
            {/* Main Content Area */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Core Information Card */}
              <section className="rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120]/50 p-8 shadow-xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-600/10 transition-colors"></div>
                 
                 <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
                    <div className="flex items-center gap-4">
                       <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
                          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice</p>
                          <h3 className="text-xl font-bold font-mono tracking-tight text-slate-900 dark:text-white uppercase truncate">#{invoice.invoice_id?.slice(0, 16)}...</h3>
                       </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => generateInvoicePDF(invoice, {
                        technicianName: invoice.job?.technician?.user?.full_name,
                        issueType: invoice.job?.request?.issue_type,
                      })}
                      className="group flex items-center gap-2 rounded-2xl border border-blue-600/30 dark:border-blue-400/30 px-5 py-3 text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest transition-all hover:bg-blue-600 hover:text-white dark:hover:bg-blue-500 dark:hover:text-white active:scale-95 shadow-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:-translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" /></svg>
                      Download PDF
                    </button>
                 </div>

                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Payment status</p>
                       <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border inline-block ${PAYMENT_COLORS[invoice.payment_status] || ''}`}>
                         {formatLabel(invoice.payment_status)}
                       </span>
                    </div>
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Invoice date</p>
                       <p className="text-sm font-bold text-slate-900 dark:text-white">{invoiceDate ? new Date(invoiceDate).toLocaleDateString('en-GB') : 'N/A'}</p>
                    </div>
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Total amount</p>
                       <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">{formatCurrency(invoice.total)}</p>
                    </div>
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Technician</p>
                       <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{invoice.job?.technician?.user?.full_name || 'Not assigned'}</p>
                    </div>
                 </div>
              </section>

              {/* Itemized Table */}
              <section className="rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120]/50 shadow-xl overflow-hidden">
                 <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                    <h3 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Bill details</h3>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                       <thead>
                          <tr className="bg-slate-50/20 dark:bg-slate-900/10">
                             <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest w-24">Type</th>
                             <th className="px-4 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                             <th className="px-4 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center w-20">Qty</th>
                             <th className="px-4 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right w-28">Unit Price</th>
                             <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right w-32">Amount</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50 dark:divide-slate-900">
                          {(invoice.items || []).map((item) => (
                             <tr key={item.item_id || item.invoice_item_id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                                <td className="px-8 py-4">
                                   <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{formatLabel(item.item_type) || 'N/A'}</span>
                                </td>
                                <td className="px-4 py-4 text-sm font-semibold text-slate-700 dark:text-slate-200">{item.description || 'Service line item'}</td>
                                <td className="px-4 py-4 text-sm font-bold text-slate-500 dark:text-slate-400 text-center uppercase tracking-tighter">{item.quantity ?? '1'}</td>
                                <td className="px-4 py-4 text-sm font-semibold text-slate-500 dark:text-slate-400 text-right uppercase tracking-tighter">{formatCurrency(item.unit_price)}</td>
                                <td className="px-8 py-4 text-sm font-black text-slate-900 dark:text-white text-right uppercase tracking-tighter">{formatCurrency(item.total_price)}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </section>
            </div>

            {/* Payment & Sidebar */}
            <div className="space-y-8">
               {invoice.payment_status !== 'completed' && (
                 <section className="rounded-[32px] border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-[#0B1120]/80 p-8 shadow-xl relative overflow-hidden group border-2">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
                    
                    <div className="flex items-center gap-3 mb-8">
                       <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                       </div>
                       <div>
                          <h3 className="text-sm font-black text-blue-700 dark:text-blue-300 uppercase tracking-widest">Pay invoice</h3>
                          <p className="text-[10px] font-bold text-blue-600 dark:text-blue-500 uppercase tracking-widest">Use UPI to complete your payment</p>
                       </div>
                    </div>

                    <div className="space-y-6">
                       <div className="rounded-3xl border-2 border-dashed border-blue-400/30 bg-white dark:bg-slate-900 p-6 flex flex-col items-center gap-4 transition-all hover:border-blue-500/50">
                          {qrLoading ? (
                            <div className="h-[220px] w-full flex items-center justify-center">
                               <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                            </div>
                          ) : qrData?.upi_url ? (
                             <>
                                <div className="rounded-2xl bg-white p-3 shadow-inner ring-1 ring-slate-100">
                                   <QRCodeSVG value={qrData.upi_url} size={200} level="H" includeMargin className="dark:bg-white p-1 rounded-sm" />
                                </div>
                                <div className="text-center">
                                   <p className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">₹{qrData.amount}</p>
                                   <p className="mt-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">{qrData.admin_upi_id}</p>
                                </div>
                             </>
                          ) : (
                             <div className="py-12 text-center text-[10px] font-black text-red-400 uppercase tracking-widest">Could not load QR code</div>
                          )}
                       </div>

                       <form className="space-y-4" onSubmit={handlePay}>
                          <div>
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                               UPI transaction ID
                               <RequiredAsterisk />
                             </label>
                             <input 
                                value={payment.transaction_id} 
                                onChange={(event) => setPayment((prev) => ({ ...prev, transaction_id: event.target.value }))}
                                className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900 px-5 text-sm font-bold font-mono outline-none focus:border-blue-500 transition-all placeholder:text-slate-300"
                                placeholder="Enter transaction ID..."
                             />
                             <p className="mt-2 text-[9px] font-bold text-slate-400 leading-tight">Enter the UPI transaction ID after you pay.</p>
                          </div>
                          <button 
                             type="submit" 
                             disabled={isPaying || !payment.transaction_id.trim()} 
                             className="w-full h-14 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 active:scale-95 disabled:opacity-50"
                          >
                             {isPaying ? 'PROCESSING...' : 'CONFIRM PAYMENT'}
                          </button>
                       </form>
                    </div>
                 </section>
               )}

               {/* Associated Details */}
               <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120]/50 p-6 shadow-xl">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Related job</h3>
                  <div className="space-y-4">
                     <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Issue Reported</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 capitalize">{invoice.job?.request?.issue_type?.replace(/_/g, ' ') || 'GENERAL SERVICE'}</p>
                        <Link to={`/jobs/${invoice.job_id}`} className="mt-3 text-[9px] font-black text-blue-600 dark:text-blue-400 flex items-center gap-1 uppercase tracking-widest hover:translate-x-1 transition-transform">
                           View job 
                           <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </Link>
                     </div>
                  </div>
               </section>
            </div>
          </div>
        )}
        
        {/* Loading Overlay */}
        {isLoading && (
           <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/80 dark:bg-[#030712]/80 backdrop-blur-sm">
             <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-600 rounded-full animate-spin"></div>
             <p className="mt-4 text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest animate-pulse">Loading invoice...</p>
           </div>
        )}
      </div>
    </div>
  )
}

export default UserInvoiceDetailPage
