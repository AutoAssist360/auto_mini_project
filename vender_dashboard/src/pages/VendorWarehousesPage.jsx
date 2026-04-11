import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  ApiError,
} from '../lib/api'
import LocationPicker from '../components/LocationPicker'
import { ListSkeleton } from '../components/Skeleton'
import RequiredAsterisk from '../components/RequiredAsterisk'

function VendorWarehousesPage({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const [warehouses, setWarehouses] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMsg, setActionMsg] = useState('')

  // Create form
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actingWarehouseId, setActingWarehouseId] = useState(null)
  const [editId, setEditId] = useState(null)
  const emptyForm = { name: '', address: '', city: '', state: '', postal_code: '', latitude: '', longitude: '', phone: '' }
  const [form, setForm] = useState(emptyForm)

  const limit = 10

  const loadWarehouses = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getWarehouses(page, limit)
      setWarehouses(res?.warehouses ?? [])
      setTotal(res?.total ?? 0)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load locations')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { loadWarehouses() }, [loadWarehouses])

  const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const openCreate = () => { setEditId(null); setForm(emptyForm); setShowForm(true) }
  const openEdit = (w) => {
    setEditId(w.warehouse_id)
    setForm({
      name: w.name || '', address: w.address || '', city: w.city || '', state: w.state || '',
      postal_code: w.postal_code || '', latitude: w.latitude ?? '', longitude: w.longitude ?? '', phone: w.phone || '',
    })
    setShowForm(true)
  }
  const cancelForm = () => { setShowForm(false); setEditId(null); setForm(emptyForm) }

  const handleSave = async () => {
    setSaving(true)
    setActionMsg('')
    try {
      const payload = {
        name: form.name,
        address: form.address,
        city: form.city,
        state: form.state,
        postal_code: form.postal_code,
        ...(form.latitude ? { latitude: Number(form.latitude) } : {}),
        ...(form.longitude ? { longitude: Number(form.longitude) } : {}),
        ...(form.phone ? { phone: form.phone } : {}),
      }
      if (editId) {
        await updateWarehouse(editId, payload)
        setActionMsg('Location updated!')
        cancelForm()
        await loadWarehouses()
      } else {
        const newWarehouse = await createWarehouse(payload)
        setActionMsg('Location added! Taking you to stock...')
        // Immediate redirect to add parts
        if (newWarehouse && newWarehouse.warehouse && newWarehouse.warehouse.warehouse_id) {
          navigate(`/warehouses/${newWarehouse.warehouse.warehouse_id}/inventory`)
        } else {
          cancelForm()
          await loadWarehouses()
        }
      }
    } catch (err) {
      setActionMsg(err instanceof ApiError ? err.message : 'Could not save location')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (warehouseId) => {
    setActionMsg('')
    setActingWarehouseId(warehouseId)
    try {
      await deleteWarehouse(warehouseId)
      setActionMsg('Location deactivated!')
      await loadWarehouses()
    } catch (err) {
      setActionMsg(err instanceof ApiError ? err.message : 'Failed to deactivate')
    } finally {
      setActingWarehouseId(null)
    }
  }

  const handleReactivate = async (warehouseId) => {
    setActionMsg('')
    setActingWarehouseId(warehouseId)
    try {
      await updateWarehouse(warehouseId, { is_active: true })
      setActionMsg('Location reactivated!')
      await loadWarehouses()
    } catch (err) {
      setActionMsg(err instanceof ApiError ? err.message : 'Failed to reactivate')
    } finally {
      setActingWarehouseId(null)
    }
  }

  const totalPages = Math.ceil(total / limit) || 1

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 overflow-x-hidden relative transition-colors duration-500">
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[30%] -right-[5%] w-[30%] h-[30%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-6 py-3 shadow-xl dark:shadow-2xl flex flex-wrap items-center justify-between gap-4 mt-6">
          <div className="flex items-center gap-3 w-full sm:w-auto">
             <Link to="/dashboard" className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all shadow-sm border border-slate-200/50 dark:border-slate-700/50" title="Back to Dashboard">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
               </svg>
             </Link>
             <h1 className="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase flex items-center gap-2">
               <span className="text-blue-500 text-2xl">🏢</span> Locations
             </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={openCreate} className="rounded-full bg-blue-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 active:scale-95 transition-all">
              + Add Location
            </button>
            <button type="button" onClick={onToggleTheme} className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-600 dark:text-slate-300 active:scale-95">
              {theme === 'dark' ? '☀ Light' : '☾ Dark'}
            </button>
          </div>
        </header>

        {actionMsg && (
          <div className={`mb-6 flex items-center gap-3 rounded-[24px] border px-5 py-4 text-sm font-bold shadow-sm animate-in fade-in ${
            actionMsg.includes('!') || actionMsg.includes('deactivated') || actionMsg.includes('reactivated')
              ? 'border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
              : 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
          }`}>
             <span className="text-xl">{actionMsg.includes('!') || actionMsg.includes('deactivated') || actionMsg.includes('reactivated') ? '✅' : '❌'}</span> {actionMsg}
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-[24px] border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-5 py-4 text-sm font-bold text-red-600 dark:text-red-400 shadow-sm animate-in fade-in">
             <span className="text-xl">❌</span> {error}
          </div>
        )}

        {/* Create/Edit Form */}
        {showForm && (
          <section className="mb-8 rounded-[32px] border border-blue-200/60 bg-blue-50/60 p-8 shadow-xl backdrop-blur-md dark:border-blue-800/40 dark:bg-blue-900/10 animate-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-blue-100 dark:border-blue-800/30">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xl shadow-inner">
                {editId ? '✏️' : '➕'}
              </div>
              <h2 className="text-base font-black uppercase tracking-widest text-blue-900 dark:text-blue-300">
                {editId ? 'Edit location' : 'Add location'}
              </h2>
            </div>
            
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {[
                { field: 'name', label: 'Name', type: 'text', placeholder: 'Location name' },
                { field: 'address', label: 'Address', type: 'text', placeholder: 'Full address' },
                { field: 'city', label: 'City', type: 'text', placeholder: 'City' },
                { field: 'state', label: 'State', type: 'text', placeholder: 'State' },
                { field: 'postal_code', label: 'Postal Code', type: 'text', placeholder: '6 digits' },
                { field: 'phone', label: 'Phone', type: 'text', placeholder: '10 digits (optional)' },
              ].map((f) => (
                <div key={f.field}>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {f.label}
                    {['name', 'address', 'city', 'state', 'postal_code'].includes(f.field) && <RequiredAsterisk />}
                  </label>
                  <input type={f.type} value={form[f.field]} onChange={handleChange(f.field)} placeholder={f.placeholder} className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0F172A]/50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm shadow-inner placeholder:font-normal placeholder:text-slate-400" />
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-[24px] border border-slate-200/60 bg-white/50 p-6 shadow-sm backdrop-blur-md dark:border-slate-700/60 dark:bg-[#0F172A]/50">
              <label className="mb-4 block text-[10px] font-black uppercase tracking-widest text-slate-500">Map location</label>
              <LocationPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onChange={({ latitude, longitude, address, city, state, postal_code }) => {
                  setForm((prev) => ({
                    ...prev,
                    latitude,
                    longitude,
                    address: address || prev.address,
                    city: city || prev.city,
                    state: state || prev.state,
                    postal_code: postal_code || prev.postal_code,
                  }))
                }}
                label=""
              />
            </div>
            <div className="mt-8 flex flex-wrap gap-3 pt-6 border-t border-blue-100 dark:border-blue-800/30">
              <button type="button" onClick={handleSave} disabled={saving || !form.name || !form.address || !form.city || !form.state || !form.postal_code} className="rounded-xl bg-blue-600 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-500 disabled:opacity-50 shadow-lg shadow-blue-500/20 active:scale-95 transition-all w-full sm:w-auto">
                {saving ? 'Saving...' : editId ? 'Save Location' : 'Add Location'}
              </button>
              <button type="button" onClick={cancelForm} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm active:scale-95 transition-all w-full sm:w-auto">Cancel</button>
            </div>
          </section>
        )}

        {/* Warehouse list */}
        {loading ? (
          <div className="relative z-10"><ListSkeleton /></div>
        ) : warehouses.length === 0 ? (
          <div className="mt-10 rounded-[32px] border border-dashed border-slate-300/60 bg-white/40 p-16 text-center dark:border-slate-700/60 dark:bg-slate-900/40 backdrop-blur-md relative z-10 shadow-sm animate-in zoom-in-95 duration-700">
            <div className="flex h-24 w-24 mx-auto items-center justify-center rounded-[32px] bg-white/80 dark:bg-slate-800/80 text-5xl shadow-xl shadow-slate-200/20 dark:shadow-none mb-6 border border-slate-100 dark:border-slate-800">
               🏢
            </div>
            <p className="mt-4 text-lg font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">No locations yet</p>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              Click <span className="text-blue-600 dark:text-blue-400 font-black">+ Add Location</span> to get started.
            </p>
          </div>
        ) : (
          <section className="mt-5 space-y-4 relative z-10">
            {warehouses.map((w) => (
              <div key={w.warehouse_id} className="group rounded-[32px] border border-slate-200/60 bg-white/80 p-6 sm:p-8 shadow-xl backdrop-blur-md dark:border-slate-700/60 dark:bg-[#0B1120]/80 transition-all hover:shadow-2xl hover:-translate-y-1">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div className="flex gap-4 items-start">
                    <div className="hidden sm:flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50 shadow-inner">
                      🏢
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{w.name}</h3>
                        <span className={`rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${w.is_active ? 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800/50' : 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800/50'}`}>
                          {w.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg">{w.address}, {w.city}, {w.state} {w.postal_code}</p>
                      {w.phone && <p className="mt-1 text-xs font-mono font-semibold text-slate-500">📞 {w.phone}</p>}
                      <div className="mt-4 flex flex-wrap gap-4 items-center">
                        <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400">
                          <span className="text-blue-500">📦</span> Stock items: <span className="font-black text-slate-900 dark:text-white ml-0.5">{w._count?.inventories ?? '?'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400">
                          <span className="text-indigo-500">📋</span> Orders: <span className="font-black text-slate-900 dark:text-white ml-0.5">{w._count?.orders ?? '?'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end w-full sm:w-auto">
                    <Link to={`/warehouses/${w.warehouse_id}/inventory`} className="flex-1 sm:flex-none text-center rounded-xl bg-blue-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 active:scale-95 transition-all">
                      View stock
                    </Link>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button type="button" onClick={() => openEdit(w)} className="flex-1 sm:flex-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-5 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm text-slate-600 dark:text-slate-300 active:scale-95">Edit</button>
                      {w.is_active ? (
                        <button type="button" onClick={() => handleDeactivate(w.warehouse_id)} disabled={actingWarehouseId === w.warehouse_id} className="flex-1 sm:flex-none rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 shadow-sm active:scale-95 transition-all disabled:opacity-60">
                          {actingWarehouseId === w.warehouse_id ? 'Working...' : 'Deactivate'}
                        </button>
                      ) : (
                        <button type="button" onClick={() => handleReactivate(w.warehouse_id)} disabled={actingWarehouseId === w.warehouse_id} className="flex-1 sm:flex-none rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 shadow-sm active:scale-95 transition-all disabled:opacity-60">
                          {actingWarehouseId === w.warehouse_id ? 'Working...' : 'Reactivate'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-4 relative z-10 pt-4">
                <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 backdrop-blur px-5 py-2.5 text-[10px] font-black uppercase tracking-widest disabled:opacity-40 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95">
                  ← Prev
                </button>
                <div className="rounded-xl bg-white/60 dark:bg-slate-800/60 backdrop-blur border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 shadow-sm">
                  Page {page} <span className="opacity-50 mx-1">/</span> {totalPages}
                </div>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 backdrop-blur px-5 py-2.5 text-[10px] font-black uppercase tracking-widest disabled:opacity-40 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95">
                  Next →
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

export default VendorWarehousesPage
