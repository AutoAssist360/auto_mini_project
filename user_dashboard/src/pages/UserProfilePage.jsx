import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { ApiError, getMyProfile, updateMyProfile, deleteMyAccount, userLogout } from '../lib/api'
import { clearAuth, setAuthUser } from '../store/authSlice'
import { ListSkeleton } from '../components/Skeleton'
import MobileNav from '../components/MobileNav'
import RequiredAsterisk from '../components/RequiredAsterisk'
import { useToast } from '../components/toastContext'
import {
  createEmptyErrors,
  IFSC_REGEX,
  PHONE_REGEX,
  UPI_REGEX,
  sanitizeDigits,
  useFirstErrorFocus,
} from '../lib/formValidation'

const PROFILE_FIELD_ORDER = ['full_name', 'phone_number', 'upi_id', 'bank_account_number', 'bank_ifsc', 'bank_holder_name']

function UserProfilePage({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { toast } = useToast()
  const fieldOrder = PROFILE_FIELD_ORDER
  const { registerField, focusFirst } = useFirstErrorFocus(fieldOrder)

  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({ full_name: '', phone_number: '', upi_id: '', bank_account_number: '', bank_ifsc: '', bank_holder_name: '' })
  const [errors, setErrors] = useState(createEmptyErrors(fieldOrder))
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadProfile = useCallback(async () => {
    setIsLoading(true); setErrors(createEmptyErrors(fieldOrder))
    try {
      const response = await getMyProfile()
      const user = response?.user || null
      setProfile(user)
      setForm({
        full_name: user?.full_name || '',
        phone_number: user?.phone_number || '',
        upi_id: user?.upi_id || '',
        bank_account_number: user?.bank_account_number || '',
        bank_ifsc: user?.bank_ifsc || '',
        bank_holder_name: user?.bank_holder_name || '',
      })
    } catch { setErrorMsg('Unable to load your profile.') }
    finally { setIsLoading(false) }
  }, [fieldOrder])

  const setErrorMsg = (msg) => setErrors(p => ({ ...p, form: msg }))

  useEffect(() => { loadProfile() }, [loadProfile])

  const handleChange = (field) => (event) => {
    const rawValue = event.target.value; let value = rawValue
    if (field === 'phone_number') value = sanitizeDigits(rawValue, 10)
    if (field === 'bank_ifsc') value = rawValue.toUpperCase().slice(0, 20)
    if (field === 'bank_account_number') value = rawValue.replace(/[^\d]/g, '').slice(0, 30)
    if (field === 'upi_id') value = rawValue.trimStart().slice(0, 100)
    if (field === 'bank_holder_name') value = rawValue.slice(0, 200)

    setForm(p => ({ ...p, [field]: value })); setErrors(p => ({ ...p, [field]: '', form: '' })); setMessage('')
  }

  const getErrors = (values = form) => {
    const nextErrors = createEmptyErrors(fieldOrder)
    if (!values.full_name.trim()) nextErrors.full_name = 'Full name is required'
    if (values.phone_number && !PHONE_REGEX.test(values.phone_number)) nextErrors.phone_number = 'Enter a valid 10-digit phone number'
    if (values.upi_id && !UPI_REGEX.test(values.upi_id.trim())) nextErrors.upi_id = 'Enter a valid UPI ID'
    if (values.bank_account_number && (values.bank_account_number.length < 6 || values.bank_account_number.length > 30)) nextErrors.bank_account_number = 'Enter a valid account number'
    if (values.bank_ifsc && !IFSC_REGEX.test(values.bank_ifsc.trim().toUpperCase())) nextErrors.bank_ifsc = 'Enter a valid IFSC code'
    if (values.bank_holder_name && !values.bank_holder_name.trim()) nextErrors.bank_holder_name = 'Account holder name is required'
    return nextErrors
  }

  const validateField = (field, values = form) => {
    const nextErrors = getErrors(values)
    setErrors(p => ({ ...p, [field]: nextErrors[field], form: '' }))
  }

  const validateForm = () => {
    const nextErrors = getErrors(form); setErrors(nextErrors)
    const isValid = !Object.values(nextErrors).some(Boolean)
    if (!isValid) focusFirst(nextErrors)
    return isValid
  }

  const handleSave = async (event) => {
    event.preventDefault()
    if (!validateForm()) return
    setIsSaving(true); setErrors(p => ({ ...p, form: '' })); setMessage('')
    try {
      const response = await updateMyProfile({
        full_name: form.full_name.trim(),
        phone_number: form.phone_number || undefined,
        upi_id: form.upi_id.trim() || null,
        bank_account_number: form.bank_account_number.trim() || null,
        bank_ifsc: form.bank_ifsc.trim().toUpperCase() || null,
        bank_holder_name: form.bank_holder_name.trim() || null,
      })
      const user = response?.user || null
      setProfile(user); dispatch(setAuthUser(user))
      setMessage(response?.message || 'Profile updated successfully.')
      toast.success('Profile updated')
    } catch (err) { setErrorMsg(err instanceof ApiError ? err.message : 'Unable to save profile changes.') }
    finally { setIsSaving(false) }
  }

  const handleLogout = async () => { await userLogout().catch(() => null); dispatch(clearAuth()); navigate('/auth/user/signin') }
  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    try { await deleteMyAccount(); toast.success('Account deleted'); dispatch(clearAuth()); navigate('/auth/user/signin') }
    catch (err) { toast.error(err instanceof ApiError ? err.message : 'Could not delete account'); setShowDeleteConfirm(false) }
    finally { setIsDeleting(false) }
  }

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
                 <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">MY ACCOUNT</span>
                 <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-tight">Profile Settings</h1>
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

        {errors.form && <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-top-4">⚠️ {errors.form}</div>}
        {message && <div className="mb-6 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-top-4">ℹ️ {message}</div>}

        {isLoading ? (
          <ListSkeleton rows={8} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Account Insight Panel */}
            <section className="lg:col-span-4 space-y-6">
               <div className="p-8 rounded-[40px] bg-white dark:bg-[#0B1120]/50 border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl rounded-full"></div>
                  
                  <div className="relative z-10 text-center mb-8">
                     <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-blue-600 to-indigo-700 mx-auto flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-blue-600/20 mb-4">
                        {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                     </div>
                     <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{profile?.full_name || 'Anonymous User'}</h2>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{profile?.email}</p>
                  </div>

                  <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                     <div className="flex justify-between items-center group/item hover:bg-slate-50 dark:hover:bg-slate-800/30 p-2 rounded-xl transition-all">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ACCOUNT ID</span>
                        <span className="text-[11px] font-bold font-mono opacity-60">#{profile?.user_id?.slice(0, 12)}...</span>
                     </div>
                     <div className="flex justify-between items-center group/item hover:bg-slate-50 dark:hover:bg-slate-800/30 p-2 rounded-xl transition-all">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ROLE</span>
                        <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[9px] font-black uppercase tracking-widest rounded-full">{profile?.role}</span>
                     </div>
                     <div className="flex justify-between items-center group/item hover:bg-slate-50 dark:hover:bg-slate-800/30 p-2 rounded-xl transition-all">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ACCOUNT STATUS</span>
                        <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[9px] font-black uppercase tracking-widest rounded-full">{profile?.is_active ? 'ACTIVE' : 'INACTIVE'}</span>
                     </div>
                     <div className="flex justify-between items-center group/item hover:bg-slate-50 dark:hover:bg-slate-800/30 p-2 rounded-xl transition-all">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MEMBER SINCE</span>
                        <span className="text-[11px] font-bold">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-GB') : 'N/A'}</span>
                     </div>
                  </div>

                  <div className="mt-10">
                    <Link to="/change-password" title="Change password" className="w-full h-14 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest hover:border-blue-500 hover:text-blue-500 transition-all active:scale-[0.98]">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                      Change password
                    </Link>
                  </div>
               </div>
            </section>

            {/* Profile Modification Panel */}
            <section className="lg:col-span-8 space-y-8">
               <div className="p-8 lg:p-12 rounded-[40px] bg-white dark:bg-[#0B1120]/50 border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden">
                  <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-10 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </span>
                    Profile details
                  </h2>

                  <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-8" noValidate>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Full name<RequiredAsterisk /></label>
                       <input ref={registerField('full_name')} value={form.full_name} onChange={handleChange('full_name')} onBlur={() => validateField('full_name')} className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 text-[11px] font-bold outline-none focus:border-blue-500 transition-all" />
                       {errors.full_name && <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">⚠ {errors.full_name}</p>}
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Phone number</label>
                       <input ref={registerField('phone_number')} value={form.phone_number} onChange={handleChange('phone_number')} onBlur={() => validateField('phone_number')} inputMode="numeric" maxLength={10} placeholder="10-digit phone number" className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 text-[11px] font-bold outline-none focus:border-blue-500 transition-all font-mono" />
                       {errors.phone_number && <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">⚠ {errors.phone_number}</p>}
                    </div>

                    <div className="md:col-span-2 py-4">
                       <div className="flex items-center gap-4">
                          <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800"></div>
                          <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.3em]">PAYMENT DETAILS</span>
                          <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800"></div>
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">UPI ID</label>
                       <input ref={registerField('upi_id')} value={form.upi_id} onChange={handleChange('upi_id')} onBlur={() => validateField('upi_id')} maxLength={100} placeholder="handle@bank_id" className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 text-[11px] font-bold outline-none focus:border-blue-500 transition-all" />
                       {errors.upi_id && <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">⚠ {errors.upi_id}</p>}
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Bank account number</label>
                       <input ref={registerField('bank_account_number')} value={form.bank_account_number} onChange={handleChange('bank_account_number')} onBlur={() => validateField('bank_account_number')} inputMode="numeric" maxLength={30} placeholder="Account number" className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 text-[11px] font-bold outline-none focus:border-blue-500 transition-all font-mono" />
                       {errors.bank_account_number && <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">⚠ {errors.bank_account_number}</p>}
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">IFSC code</label>
                       <input ref={registerField('bank_ifsc')} value={form.bank_ifsc} onChange={handleChange('bank_ifsc')} onBlur={() => validateField('bank_ifsc')} maxLength={20} placeholder="IFSC code" className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 text-[11px] font-bold outline-none focus:border-blue-500 transition-all font-mono" />
                       {errors.bank_ifsc && <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">⚠ {errors.bank_ifsc}</p>}
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Account holder name</label>
                       <input ref={registerField('bank_holder_name')} value={form.bank_holder_name} onChange={handleChange('bank_holder_name')} onBlur={() => validateField('bank_holder_name')} maxLength={200} placeholder="Name on the bank account" className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 text-[11px] font-bold outline-none focus:border-blue-500 transition-all" />
                       {errors.bank_holder_name && <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">⚠ {errors.bank_holder_name}</p>}
                    </div>

                    <div className="md:col-span-2 pt-6">
                       <button type="submit" disabled={isSaving} className="w-full md:w-auto px-10 h-14 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 shadow-xl shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-30">
                          {isSaving ? 'SAVING...' : 'SAVE PROFILE CHANGES'}
                       </button>
                    </div>
                  </form>
               </div>

               {/* Danger Deletion Protocol */}
               <div className="p-8 rounded-[40px] bg-red-500/5 dark:bg-red-500/10 border border-red-500/10 dark:border-red-500/20 relative overflow-hidden group">
                  <div className="flex flex-wrap items-center justify-between gap-6">
                     <div className="flex-1 min-w-0 sm:min-w-[300px]">
                        <h2 className="text-sm font-black text-red-600 dark:text-red-500 uppercase tracking-widest flex items-center gap-2">
                           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                           Delete account
                        </h2>
                        <p className="text-[11px] font-medium text-slate-500 mt-2">This will permanently delete your account and related records. This action cannot be undone.</p>
                     </div>

                     {!showDeleteConfirm ? (
                       <button onClick={() => setShowDeleteConfirm(true)} className="h-12 px-6 rounded-2xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 text-red-600 text-[9px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all">
                         DELETE ACCOUNT
                       </button>
                     ) : (
                       <div className="flex items-center gap-3 animate-in fade-in zoom-in-95">
                         <span className="text-[10px] font-black text-red-600 uppercase hidden sm:inline">ARE YOU SURE?</span>
                         <button onClick={handleDeleteAccount} disabled={isDeleting} className="h-12 px-6 rounded-2xl bg-red-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-red-700 active:scale-95 shadow-lg shadow-red-600/20">
                           {isDeleting ? 'DELETING...' : 'YES, DELETE'}
                         </button>
                         <button onClick={() => setShowDeleteConfirm(false)} className="h-12 px-6 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-black uppercase tracking-widest active:scale-95">
                           CANCEL
                         </button>
                       </div>
                     )}
                  </div>
               </div>
            </section>

          </div>
        )}
      </div>
    </div>
  )
}

export default UserProfilePage
