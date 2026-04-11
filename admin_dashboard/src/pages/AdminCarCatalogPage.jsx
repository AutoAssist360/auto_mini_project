import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import MobileNav from '../components/MobileNav'
import {
  createCategory,
  createCompany,
  createModel,
  createPart,
  createPartPrice,
  createVariant,
  deleteCategory,
  deleteCompany,
  deleteModel,
  deletePart,
  deletePartPrice,
  deleteVariant,
  getApiErrorMessage,
  getCategories,
  getCompanies,
  getModels,
  getPartPrices,
  getParts,
  getVariants,
  updateCategory,
  updateCompany,
  updateModel,
  updatePart,
  updatePartPrice,
  updateVariant,
} from '../lib/api'
import RequiredAsterisk from '../components/RequiredAsterisk'

const TABS = ['Companies', 'Models', 'Variants', 'Categories', 'Parts', 'Prices']
const PAGE_SIZE = 20

const card = 'rounded-[32px] border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl shadow-xl'
const input = 'w-full rounded-2xl bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-blue-500 px-6 py-4 text-[11px] font-black uppercase tracking-widest outline-none transition-all shadow-inner placeholder:text-slate-400 dark:placeholder:text-slate-600'
const primaryBtn = 'rounded-2xl bg-blue-600 px-8 py-4 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-blue-700 hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 shadow-xl shadow-blue-600/20'
const secondaryBtn = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3 text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 transition-all hover:border-blue-500 hover:text-blue-600 active:scale-95'
const dangerBtn = 'rounded-2xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-900 px-5 py-3 text-[9px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 transition-all hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95 shadow-lg shadow-red-500/5'
const idBadge = 'inline-flex rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400'

const initialVariantForm = {
  model_id: '',
  variant_name: '',
  year: '',
  fuel_type: 'petrol',
  transmission: 'manual',
}

const initialPriceForm = {
  part_id: '',
  variant_id: '',
  price: '',
}

function formatError(error, fallback) {
  return getApiErrorMessage(error, fallback)
}

function getRequiredTextError(value, label) {
  return value.trim() ? '' : `${label} is required.`
}

function parsePositiveId(value, label) {
  const numericValue = Number(value)
  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    return { error: `${label} is required.` }
  }

  return { value: numericValue }
}

function parseYear(value) {
  const numericValue = Number(value)
  if (!Number.isInteger(numericValue) || numericValue < 1900 || numericValue > 2100) {
    return { error: 'Year must be between 1900 and 2100.' }
  }

  return { value: numericValue }
}

function parsePrice(value) {
  const normalizedValue = value.trim()
  if (!normalizedValue) {
    return { error: 'Price is required.' }
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalizedValue)) {
    return { error: 'Price must be a valid amount with up to 2 decimal places.' }
  }

  const numericValue = Number(normalizedValue)
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return { error: 'Price must be greater than 0.' }
  }

  return { value: Number(numericValue.toFixed(2)) }
}

function Alert({ error, success }) {
  if (!error && !success) return null

  const tone = error
    ? 'border-red-500 bg-red-600 text-white shadow-lg shadow-red-500/20'
    : 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-500/20'

  return <div className={`rounded-2xl border-2 px-6 py-4 text-[10px] font-black uppercase tracking-widest animate-pulse ${tone}`}>{error || success}</div>
}

function Label({ label, children, hint, required = false }) {
  return (
    <label className="block text-slate-700 dark:text-slate-200">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1">
        {label}
        {required && <RequiredAsterisk />}
      </span>
      {children}
      {hint && <span className="mt-2 block text-[9px] font-bold text-slate-400 dark:text-slate-600 px-1 italic">{hint}</span>}
    </label>
  )
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <input
      className={`${input} max-w-sm`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  )
}

function Tabs({ activeTab, setActiveTab }) {
  return (
    <section className="mt-8 overflow-hidden rounded-[40px] border border-white/20 dark:border-slate-800/50 bg-white/40 dark:bg-[#0B1120]/40 backdrop-blur-xl p-2 shadow-2xl transition-all duration-500">
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 min-w-0 rounded-[32px] px-4 py-4 text-[10px] font-black uppercase tracking-widest transition-all duration-500 sm:min-w-[120px] sm:px-6 ${
              activeTab === tab
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xl scale-[1.02]'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </section>
  )
}

function ActionButtons({ onEdit, onDelete, busy }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={onEdit} className={secondaryBtn}>
        Edit
      </button>
      <button type="button" onClick={onDelete} disabled={busy} className={dangerBtn}>
        {busy ? 'Deleting...' : 'Delete'}
      </button>
    </div>
  )
}

function Table({ columns, rows, loading, page, total, onPageChange, emptyText }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (loading) {
    return (
      <div className="space-y-4 py-8">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50" />
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[32px] border border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/20">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[11px] font-bold uppercase tracking-tight">
          <thead className="bg-slate-100 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-slate-400">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-6 py-5 font-black uppercase tracking-widest">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 font-['Outfit']">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-20 text-center">
                   <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 dark:bg-slate-900 mb-6 font-black text-slate-200 dark:text-slate-800 text-2xl tracking-tighter shadow-inner uppercase">! CAT</div>
                   <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600">{emptyText}</p>
                </td>
              </tr>
            ) : (
              rows.map((cells, rowIndex) => (
                <tr key={rowIndex} className="group/row hover:bg-white dark:hover:bg-slate-800/30 transition-all font-['Outfit']">
                  {cells.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-6 py-5 align-middle text-slate-900 dark:text-slate-200 group-hover/row:text-blue-600 transition-colors">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-6 border-t border-slate-100 dark:border-slate-800/50 px-8 py-6">
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600">
            Total records <span className="text-blue-600 dark:text-blue-400">{total}</span>
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800 transition-all disabled:opacity-30"
            >
              Previous
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">
              Page {page} <span className="text-slate-400 mx-2">OF</span> {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-6 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-30 shadow-xl"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, description, toolbar, alert, form, table }) {
  return (
    <div className="space-y-6">
      <div className={`${card} p-8 overflow-hidden relative`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full"></div>
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white leading-none mb-3">{title}</h2>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-loose">{description}</p>
          </div>
          {toolbar && <div className="w-full lg:w-auto flex flex-wrap gap-4">{toolbar}</div>}
        </div>
      </div>
      
      {alert}
      
      <div className={`${card} p-8 font-['Outfit']`}>
        <div className="flex items-center gap-3 mb-8">
           <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
           <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Add or edit details</h3>
        </div>
        {form}
      </div>
      
      <div className={`${card} p-8`}>
        <div className="flex items-center gap-3 mb-8">
           <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
           <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Saved records</h3>
        </div>
        {table}
      </div>
    </div>
  )
}

function CompaniesTab() {
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ company_name: '' })
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getCompanies({ page, limit: PAGE_SIZE, search: search || undefined })
      setItems(res?.companies || [])
      setTotal(res?.total || 0)
    } catch (err) {
      setError(formatError(err, 'Failed to load companies'))
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    load()
  }, [load])

  const reset = () => {
    setEditId(null)
    setForm({ company_name: '' })
  }

  const save = async (event) => {
    event.preventDefault()
    const companyNameError = getRequiredTextError(form.company_name, 'Company name')
    if (companyNameError) {
      setError(companyNameError)
      setSuccess('')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const payload = { company_name: form.company_name.trim() }
      if (editId) {
        await updateCompany(editId, payload)
        setSuccess('Company updated successfully.')
      } else {
        await createCompany(payload)
        setSuccess('Company created successfully.')
      }
      reset()
      await load()
    } catch (err) {
      setError(formatError(err, 'Unable to save company'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this company?')) return

    setDeletingId(id)
    setError('')
    setSuccess('')

    try {
      await deleteCompany(id)
      setSuccess('Company deleted successfully.')
      await load()
    } catch (err) {
      setError(formatError(err, 'Unable to delete company'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Section
      title="Car Companies"
      description="Manage the master list of vehicle brands before creating models and variants."
      toolbar={
        <SearchBox
          value={search}
          onChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          placeholder="Search companies..."
        />
      }
      alert={<Alert error={error} success={success} />}
      form={
        <form onSubmit={save} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
          <Label label="Company Name" required>
            <input
              className={input}
              value={form.company_name}
              onChange={(event) => setForm({ company_name: event.target.value })}
              placeholder="e.g. Maruti Suzuki"
              required
            />
          </Label>
          <button type="submit" disabled={saving} className={primaryBtn}>
            {saving ? 'Saving...' : editId ? 'Update Company' : 'Add Company'}
          </button>
          {editId && (
            <button type="button" onClick={reset} className={secondaryBtn}>
              Cancel
            </button>
          )}
        </form>
      }
      table={
        <Table
          loading={loading}
          columns={['ID', 'Company', 'Models', 'Actions']}
          rows={items.map((item) => [
            <span key={`id-${item.company_id}`} className={idBadge}>
              #{item.company_id}
            </span>,
            item.company_name,
            item.model_count,
            <ActionButtons
              key={`actions-${item.company_id}`}
              busy={deletingId === item.company_id}
              onEdit={() => {
                setEditId(item.company_id)
                setForm({ company_name: item.company_name })
                setError('')
                setSuccess('')
              }}
              onDelete={() => remove(item.company_id)}
            />,
          ])}
          page={page}
          total={total}
          onPageChange={setPage}
          emptyText="No companies found yet."
        />
      }
    />
  )
}

function ModelsTab() {
  const [items, setItems] = useState([])
  const [companies, setCompanies] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ company_id: '', model_name: '' })
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [modelsRes, companiesRes] = await Promise.all([
        getModels({ page, limit: PAGE_SIZE, search: search || undefined }),
        getCompanies({ page: 1, limit: 100 }),
      ])
      setItems(modelsRes?.models || [])
      setTotal(modelsRes?.total || 0)
      setCompanies(companiesRes?.companies || [])
    } catch (err) {
      setError(formatError(err, 'Failed to load models'))
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    load()
  }, [load])

  const reset = () => {
    setEditId(null)
    setForm({ company_id: '', model_name: '' })
  }

  const save = async (event) => {
    event.preventDefault()
    const companyIdResult = parsePositiveId(form.company_id, 'Company')
    if (companyIdResult.error) {
      setError(companyIdResult.error)
      setSuccess('')
      return
    }

    const modelNameError = getRequiredTextError(form.model_name, 'Model name')
    if (modelNameError) {
      setError(modelNameError)
      setSuccess('')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        company_id: companyIdResult.value,
        model_name: form.model_name.trim(),
      }

      if (editId) {
        await updateModel(editId, payload)
        setSuccess('Model updated successfully.')
      } else {
        await createModel(payload)
        setSuccess('Model created successfully.')
      }

      reset()
      await load()
    } catch (err) {
      setError(formatError(err, 'Unable to save model'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this model?')) return

    setDeletingId(id)
    setError('')
    setSuccess('')

    try {
      await deleteModel(id)
      setSuccess('Model deleted successfully.')
      await load()
    } catch (err) {
      setError(formatError(err, 'Unable to delete model'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Section
      title="Car Models"
      description="Each model belongs to one company and becomes the parent for multiple variants."
      toolbar={
        <SearchBox
          value={search}
          onChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          placeholder="Search models..."
        />
      }
      alert={<Alert error={error} success={success} />}
      form={
        <form onSubmit={save} className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto_auto] lg:items-end">
          <Label label="Company" required>
            <select
              className={input}
              value={form.company_id}
              onChange={(event) => setForm((prev) => ({ ...prev, company_id: event.target.value }))}
              required
            >
              <option value="">Select company</option>
              {companies.map((company) => (
                <option key={company.company_id} value={company.company_id}>
                  {company.company_name}
                </option>
              ))}
            </select>
          </Label>
          <Label label="Model Name" required>
            <input
              className={input}
              value={form.model_name}
              onChange={(event) => setForm((prev) => ({ ...prev, model_name: event.target.value }))}
              placeholder="e.g. Swift"
              required
            />
          </Label>
          <button type="submit" disabled={saving} className={primaryBtn}>
            {saving ? 'Saving...' : editId ? 'Update Model' : 'Add Model'}
          </button>
          {editId && (
            <button type="button" onClick={reset} className={secondaryBtn}>
              Cancel
            </button>
          )}
        </form>
      }
      table={
        <Table
          loading={loading}
          columns={['ID', 'Model', 'Company', 'Variants', 'Actions']}
          rows={items.map((item) => [
            <span key={`id-${item.model_id}`} className={idBadge}>
              #{item.model_id}
            </span>,
            item.model_name,
            item.company?.company_name || '--',
            item.variant_count,
            <ActionButtons
              key={`actions-${item.model_id}`}
              busy={deletingId === item.model_id}
              onEdit={() => {
                setEditId(item.model_id)
                setForm({
                  company_id: String(item.company?.company_id || ''),
                  model_name: item.model_name,
                })
                setError('')
                setSuccess('')
              }}
              onDelete={() => remove(item.model_id)}
            />,
          ])}
          page={page}
          total={total}
          onPageChange={setPage}
          emptyText="No models found yet."
        />
      }
    />
  )
}

function VariantsTab() {
  const [items, setItems] = useState([])
  const [models, setModels] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(initialVariantForm)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [variantsRes, modelsRes] = await Promise.all([
        getVariants({ page, limit: PAGE_SIZE, search: search || undefined }),
        getModels({ page: 1, limit: 100 }),
      ])
      setItems(variantsRes?.variants || [])
      setTotal(variantsRes?.total || 0)
      setModels(modelsRes?.models || [])
    } catch (err) {
      setError(formatError(err, 'Failed to load variants'))
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    load()
  }, [load])

  const reset = () => {
    setEditId(null)
    setForm(initialVariantForm)
  }

  const save = async (event) => {
    event.preventDefault()
    const modelIdResult = parsePositiveId(form.model_id, 'Model')
    if (modelIdResult.error) {
      setError(modelIdResult.error)
      setSuccess('')
      return
    }

    const variantNameError = getRequiredTextError(form.variant_name, 'Variant name')
    if (variantNameError) {
      setError(variantNameError)
      setSuccess('')
      return
    }

    const yearResult = parseYear(form.year)
    if (yearResult.error) {
      setError(yearResult.error)
      setSuccess('')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        model_id: modelIdResult.value,
        variant_name: form.variant_name.trim(),
        year: yearResult.value,
        fuel_type: form.fuel_type,
        transmission: form.transmission,
      }

      if (editId) {
        await updateVariant(editId, payload)
        setSuccess('Variant updated successfully.')
      } else {
        await createVariant(payload)
        setSuccess('Variant created successfully.')
      }

      reset()
      await load()
    } catch (err) {
      setError(formatError(err, 'Unable to save variant'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this variant?')) return

    setDeletingId(id)
    setError('')
    setSuccess('')

    try {
      await deleteVariant(id)
      setSuccess('Variant deleted successfully.')
      await load()
    } catch (err) {
      setError(formatError(err, 'Unable to delete variant'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Section
      title="Car Variants"
      description="Store production year, fuel type, and transmission so part pricing can be assigned accurately."
      toolbar={
        <SearchBox
          value={search}
          onChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          placeholder="Search variants..."
        />
      }
      alert={<Alert error={error} success={success} />}
      form={
        <form onSubmit={save} className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_140px_160px_180px_auto_auto] xl:items-end">
          <Label label="Model" required>
            <select
              className={input}
              value={form.model_id}
              onChange={(event) => setForm((prev) => ({ ...prev, model_id: event.target.value }))}
              required
            >
              <option value="">Select model</option>
              {models.map((model) => (
                <option key={model.model_id} value={model.model_id}>
                  {model.model_name} ({model.company?.company_name || 'No company'})
                </option>
              ))}
            </select>
          </Label>
          <Label label="Variant Name" required>
            <input
              className={input}
              value={form.variant_name}
              onChange={(event) => setForm((prev) => ({ ...prev, variant_name: event.target.value }))}
              placeholder="e.g. ZXi Plus"
              required
            />
          </Label>
          <Label label="Year" required>
            <input
              className={input}
              type="number"
              min="1900"
              max="2100"
              value={form.year}
              onChange={(event) => setForm((prev) => ({ ...prev, year: event.target.value }))}
              placeholder="2024"
              required
            />
          </Label>
          <Label label="Fuel Type">
            <select
              className={input}
              value={form.fuel_type}
              onChange={(event) => setForm((prev) => ({ ...prev, fuel_type: event.target.value }))}
            >
              <option value="petrol">Petrol</option>
              <option value="diesel">Diesel</option>
              <option value="electric">Electric</option>
              <option value="hybrid">Hybrid</option>
              <option value="cng">CNG</option>
            </select>
          </Label>
          <Label label="Transmission">
            <select
              className={input}
              value={form.transmission}
              onChange={(event) => setForm((prev) => ({ ...prev, transmission: event.target.value }))}
            >
              <option value="manual">Manual</option>
              <option value="automatic">Automatic</option>
              <option value="semi_automatic">Semi Automatic</option>
            </select>
          </Label>
          <button type="submit" disabled={saving} className={primaryBtn}>
            {saving ? 'Saving...' : editId ? 'Update Variant' : 'Add Variant'}
          </button>
          {editId && (
            <button type="button" onClick={reset} className={secondaryBtn}>
              Cancel
            </button>
          )}
        </form>
      }
      table={
        <Table
          loading={loading}
          columns={['ID', 'Variant', 'Model', 'Specs', 'Actions']}
          rows={items.map((item) => [
            <span key={`id-${item.variant_id}`} className={idBadge}>
              #{item.variant_id}
            </span>,
            <div key={`variant-${item.variant_id}`}>
              <p className="font-medium">{item.variant_name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {item.model?.company?.company_name || '--'}
              </p>
            </div>,
            item.model?.model_name || '--',
            <div key={`specs-${item.variant_id}`} className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <div>Year: {item.year}</div>
              <div>Fuel: {item.fuel_type}</div>
              <div>Transmission: {item.transmission.replace('_', ' ')}</div>
            </div>,
            <ActionButtons
              key={`actions-${item.variant_id}`}
              busy={deletingId === item.variant_id}
              onEdit={() => {
                setEditId(item.variant_id)
                setForm({
                  model_id: String(item.model_id),
                  variant_name: item.variant_name,
                  year: String(item.year),
                  fuel_type: item.fuel_type,
                  transmission: item.transmission,
                })
                setError('')
                setSuccess('')
              }}
              onDelete={() => remove(item.variant_id)}
            />,
          ])}
          page={page}
          total={total}
          onPageChange={setPage}
          emptyText="No variants found yet."
        />
      }
    />
  )
}

function CategoriesTab() {
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ category_name: '' })
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getCategories({ page, limit: PAGE_SIZE, search: search || undefined })
      setItems(res?.categories || [])
      setTotal(res?.total || 0)
    } catch (err) {
      setError(formatError(err, 'Failed to load categories'))
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    load()
  }, [load])

  const reset = () => {
    setEditId(null)
    setForm({ category_name: '' })
  }

  const save = async (event) => {
    event.preventDefault()
    const categoryNameError = getRequiredTextError(form.category_name, 'Category name')
    if (categoryNameError) {
      setError(categoryNameError)
      setSuccess('')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const payload = { category_name: form.category_name.trim() }
      if (editId) {
        await updateCategory(editId, payload)
        setSuccess('Category updated successfully.')
      } else {
        await createCategory(payload)
        setSuccess('Category created successfully.')
      }
      reset()
      await load()
    } catch (err) {
      setError(formatError(err, 'Unable to save category'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this category?')) return

    setDeletingId(id)
    setError('')
    setSuccess('')

    try {
      await deleteCategory(id)
      setSuccess('Category deleted successfully.')
      await load()
    } catch (err) {
      setError(formatError(err, 'Unable to delete category'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Section
      title="Part Categories"
      description="Group similar parts together so the rest of the catalog stays manageable."
      toolbar={
        <SearchBox
          value={search}
          onChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          placeholder="Search categories..."
        />
      }
      alert={<Alert error={error} success={success} />}
      form={
        <form onSubmit={save} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
          <Label label="Category Name" required>
            <input
              className={input}
              value={form.category_name}
              onChange={(event) => setForm({ category_name: event.target.value })}
              placeholder="e.g. Brakes"
              required
            />
          </Label>
          <button type="submit" disabled={saving} className={primaryBtn}>
            {saving ? 'Saving...' : editId ? 'Update Category' : 'Add Category'}
          </button>
          {editId && (
            <button type="button" onClick={reset} className={secondaryBtn}>
              Cancel
            </button>
          )}
        </form>
      }
      table={
        <Table
          loading={loading}
          columns={['ID', 'Category', 'Parts', 'Actions']}
          rows={items.map((item) => [
            <span key={`id-${item.category_id}`} className={idBadge}>
              #{item.category_id}
            </span>,
            item.category_name,
            item.part_count,
            <ActionButtons
              key={`actions-${item.category_id}`}
              busy={deletingId === item.category_id}
              onEdit={() => {
                setEditId(item.category_id)
                setForm({ category_name: item.category_name })
                setError('')
                setSuccess('')
              }}
              onDelete={() => remove(item.category_id)}
            />,
          ])}
          page={page}
          total={total}
          onPageChange={setPage}
          emptyText="No categories found yet."
        />
      }
    />
  )
}

function PartsTab() {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [form, setForm] = useState({ part_name: '', category_id: '' })
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [partsRes, categoriesRes] = await Promise.all([
        getParts({
          page,
          limit: PAGE_SIZE,
          search: search || undefined,
          category_id: categoryFilter || undefined,
        }),
        getCategories({ page: 1, limit: 100 }),
      ])
      setItems(partsRes?.parts || [])
      setTotal(partsRes?.total || 0)
      setCategories(categoriesRes?.categories || [])
    } catch (err) {
      setError(formatError(err, 'Failed to load parts'))
    } finally {
      setLoading(false)
    }
  }, [categoryFilter, page, search])

  useEffect(() => {
    load()
  }, [load])

  const reset = () => {
    setEditId(null)
    setForm({ part_name: '', category_id: '' })
  }

  const save = async (event) => {
    event.preventDefault()
    const categoryIdResult = parsePositiveId(form.category_id, 'Category')
    if (categoryIdResult.error) {
      setError(categoryIdResult.error)
      setSuccess('')
      return
    }

    const partNameError = getRequiredTextError(form.part_name, 'Part name')
    if (partNameError) {
      setError(partNameError)
      setSuccess('')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        part_name: form.part_name.trim(),
        category_id: categoryIdResult.value,
      }

      if (editId) {
        await updatePart(editId, payload)
        setSuccess('Part updated successfully.')
      } else {
        await createPart(payload)
        setSuccess('Part created successfully.')
      }

      reset()
      await load()
    } catch (err) {
      setError(formatError(err, 'Unable to save part'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this part?')) return

    setDeletingId(id)
    setError('')
    setSuccess('')

    try {
      await deletePart(id)
      setSuccess('Part deleted successfully.')
      await load()
    } catch (err) {
      setError(formatError(err, 'Unable to delete part'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Section
      title="Car Parts"
      description="Create the catalog of parts that warehouses and vendors will later price and stock."
      toolbar={
        <div className="flex flex-wrap gap-3">
          <SearchBox
            value={search}
            onChange={(value) => {
              setSearch(value)
              setPage(1)
            }}
            placeholder="Search parts..."
          />
          <select
            className={`${input} min-w-0 sm:min-w-[220px]`}
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value)
              setPage(1)
            }}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.category_id} value={category.category_id}>
                {category.category_name}
              </option>
            ))}
          </select>
        </div>
      }
      alert={<Alert error={error} success={success} />}
      form={
        <form onSubmit={save} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px_auto_auto] lg:items-end">
          <Label label="Part Name" required>
            <input
              className={input}
              value={form.part_name}
              onChange={(event) => setForm((prev) => ({ ...prev, part_name: event.target.value }))}
              placeholder="e.g. Front Brake Pad"
              required
            />
          </Label>
          <Label label="Category" required>
            <select
              className={input}
              value={form.category_id}
              onChange={(event) => setForm((prev) => ({ ...prev, category_id: event.target.value }))}
              required
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.category_id} value={category.category_id}>
                  {category.category_name}
                </option>
              ))}
            </select>
          </Label>
          <button type="submit" disabled={saving} className={primaryBtn}>
            {saving ? 'Saving...' : editId ? 'Update Part' : 'Add Part'}
          </button>
          {editId && (
            <button type="button" onClick={reset} className={secondaryBtn}>
              Cancel
            </button>
          )}
        </form>
      }
      table={
        <Table
          loading={loading}
          columns={['ID', 'Part', 'Category', 'Price Entries', 'Actions']}
          rows={items.map((item) => [
            <span key={`id-${item.part_id}`} className={idBadge}>
              #{item.part_id}
            </span>,
            item.part_name,
            item.category?.category_name || '--',
            item.price_count,
            <ActionButtons
              key={`actions-${item.part_id}`}
              busy={deletingId === item.part_id}
              onEdit={() => {
                setEditId(item.part_id)
                setForm({
                  part_name: item.part_name,
                  category_id: String(item.category?.category_id || ''),
                })
                setError('')
                setSuccess('')
              }}
              onDelete={() => remove(item.part_id)}
            />,
          ])}
          page={page}
          total={total}
          onPageChange={setPage}
          emptyText="No parts found yet."
        />
      }
    />
  )
}

function PricesTab() {
  const [items, setItems] = useState([])
  const [parts, setParts] = useState([])
  const [variants, setVariants] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [partFilter, setPartFilter] = useState('')
  const [variantFilter, setVariantFilter] = useState('')
  const [form, setForm] = useState(initialPriceForm)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [pricesRes, partsRes, variantsRes] = await Promise.all([
        getPartPrices({
          page,
          limit: PAGE_SIZE,
          part_id: partFilter || undefined,
          variant_id: variantFilter || undefined,
        }),
        getParts({ page: 1, limit: 100 }),
        getVariants({ page: 1, limit: 100 }),
      ])
      setItems(pricesRes?.prices || [])
      setTotal(pricesRes?.total || 0)
      setParts(partsRes?.parts || [])
      setVariants(variantsRes?.variants || [])
    } catch (err) {
      setError(formatError(err, 'Failed to load pricing'))
    } finally {
      setLoading(false)
    }
  }, [page, partFilter, variantFilter])

  useEffect(() => {
    load()
  }, [load])

  const reset = () => {
    setEditId(null)
    setForm(initialPriceForm)
  }

  const save = async (event) => {
    event.preventDefault()
    const priceResult = parsePrice(form.price)
    if (priceResult.error) {
      setError(priceResult.error)
      setSuccess('')
      return
    }

    if (!editId) {
      const partIdResult = parsePositiveId(form.part_id, 'Part')
      if (partIdResult.error) {
        setError(partIdResult.error)
        setSuccess('')
        return
      }

      const variantIdResult = parsePositiveId(form.variant_id, 'Variant')
      if (variantIdResult.error) {
        setError(variantIdResult.error)
        setSuccess('')
        return
      }

      setSaving(true)
      setError('')
      setSuccess('')

      try {
        await createPartPrice({
          part_id: partIdResult.value,
          variant_id: variantIdResult.value,
          price: priceResult.value,
        })
        setSuccess('Price created successfully.')

        reset()
        await load()
      } catch (err) {
        setError(formatError(err, 'Unable to save price'))
      } finally {
        setSaving(false)
      }

      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await updatePartPrice(editId, { price: priceResult.value })
      setSuccess('Price updated successfully.')

      reset()
      await load()
    } catch (err) {
      setError(formatError(err, 'Unable to save price'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this price entry?')) return

    setDeletingId(id)
    setError('')
    setSuccess('')

    try {
      await deletePartPrice(id)
      setSuccess('Price deleted successfully.')
      await load()
    } catch (err) {
      setError(formatError(err, 'Unable to delete price'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Section
      title="Part Pricing"
      description="Assign a part price to a specific car variant. This is the final layer of the catalog setup."
      toolbar={
        <div className="flex flex-wrap gap-3">
          <select
            className={`${input} min-w-0 sm:min-w-[220px]`}
            value={partFilter}
            onChange={(event) => {
              setPartFilter(event.target.value)
              setPage(1)
            }}
          >
            <option value="">All parts</option>
            {parts.map((part) => (
              <option key={part.part_id} value={part.part_id}>
                {part.part_name}
              </option>
            ))}
          </select>
          <select
            className={`${input} min-w-0 sm:min-w-[280px]`}
            value={variantFilter}
            onChange={(event) => {
              setVariantFilter(event.target.value)
              setPage(1)
            }}
          >
            <option value="">All variants</option>
            {variants.map((variant) => (
              <option key={variant.variant_id} value={variant.variant_id}>
                {variant.model?.company?.company_name || 'No company'} / {variant.model?.model_name || 'No model'} /{' '}
                {variant.variant_name} ({variant.year})
              </option>
            ))}
          </select>
        </div>
      }
      alert={<Alert error={error} success={success} />}
      form={
        <form onSubmit={save} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_180px_auto_auto] xl:items-end">
          <Label label="Part" required hint={editId ? 'Part cannot be changed while editing an existing price entry.' : undefined}>
            <select
              className={input}
              value={form.part_id}
              onChange={(event) => setForm((prev) => ({ ...prev, part_id: event.target.value }))}
              required
              disabled={Boolean(editId)}
            >
              <option value="">Select part</option>
              {parts.map((part) => (
                <option key={part.part_id} value={part.part_id}>
                  {part.part_name}
                </option>
              ))}
            </select>
          </Label>
          <Label
            required
            label="Variant"
            hint={editId ? 'Variant cannot be changed while editing an existing price entry.' : undefined}
          >
            <select
              className={input}
              value={form.variant_id}
              onChange={(event) => setForm((prev) => ({ ...prev, variant_id: event.target.value }))}
              required
              disabled={Boolean(editId)}
            >
              <option value="">Select variant</option>
              {variants.map((variant) => (
                <option key={variant.variant_id} value={variant.variant_id}>
                  {variant.model?.company?.company_name || 'No company'} / {variant.model?.model_name || 'No model'} /{' '}
                  {variant.variant_name} ({variant.year})
                </option>
              ))}
            </select>
          </Label>
          <Label label="Price" required>
            <input
              className={input}
              type="number"
              min="0.01"
              step="0.01"
              value={form.price}
              onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
              placeholder="e.g. 2499.00"
              required
            />
          </Label>
          <button type="submit" disabled={saving} className={primaryBtn}>
            {saving ? 'Saving...' : editId ? 'Update Price' : 'Add Price'}
          </button>
          {editId && (
            <button type="button" onClick={reset} className={secondaryBtn}>
              Cancel
            </button>
          )}
        </form>
      }
      table={
        <Table
          loading={loading}
          columns={['ID', 'Part', 'Variant', 'Price', 'Actions']}
          rows={items.map((item) => [
            <span key={`id-${item.price_id}`} className={idBadge}>
              #{item.price_id}
            </span>,
            item.part?.part_name || '--',
            <div key={`variant-${item.price_id}`} className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <div className="font-medium text-sm text-slate-900 dark:text-slate-100">{item.variant?.variant_name || '--'}</div>
              <div>
                {item.variant?.model?.company?.company_name || '--'} / {item.variant?.model?.model_name || '--'}
              </div>
              <div>{item.variant?.year || '--'}</div>
            </div>,
            `Rs. ${Number(item.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            <ActionButtons
              key={`actions-${item.price_id}`}
              busy={deletingId === item.price_id}
              onEdit={() => {
                setEditId(item.price_id)
                setForm({
                  part_id: String(item.part_id),
                  variant_id: String(item.variant_id),
                  price: String(item.price),
                })
                setError('')
                setSuccess('')
              }}
              onDelete={() => remove(item.price_id)}
            />,
          ])}
          page={page}
          total={total}
          onPageChange={setPage}
          emptyText="No price entries found yet."
        />
      }
    />
  )
}

export default function AdminCarCatalogPage({ theme, onToggleTheme }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const activeTab = TABS.includes(requestedTab) ? requestedTab : 'Companies'

  const setActiveTab = useCallback(
    (tab) => {
      setSearchParams(tab === 'Companies' ? {} : { tab })
    },
    [setSearchParams]
  )

  const content = useMemo(() => {
    switch (activeTab) {
      case 'Models':
        return <ModelsTab />
      case 'Variants':
        return <VariantsTab />
      case 'Categories':
        return <CategoriesTab />
      case 'Parts':
        return <PartsTab />
      case 'Prices':
        return <PricesTab />
      case 'Companies':
      default:
        return <CompaniesTab />
    }
  }, [activeTab])

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] selection:bg-blue-500/30 overflow-x-hidden transition-colors duration-500">
      {/* Ambient background glows */}
      <div className="fixed top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute top-[20%] -right-[5%] w-[40%] h-[40%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full animate-pulse [animation-delay:2s]"></div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 z-10">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6 text-center md:text-left">
          <div className="flex items-center gap-6">
             <div className="w-16 h-16 rounded-[24px] bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 text-2xl font-black shadow-2xl">
               CAT
             </div>
             <div>
               <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">Car catalog</h1>
               <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] leading-none">Manage vehicle brands, models, parts, and pricing</p>
             </div>
          </div>
          
          <div className="flex items-center gap-3">
             <Link to="/admin/dashboard" className="px-6 py-3 rounded-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest hover:border-blue-500 transition-all shadow-sm">
               ← Dashboard Hub
             </Link>
             <button onClick={onToggleTheme} className="w-12 h-12 rounded-full flex items-center justify-center bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 transition-all hover:scale-110 active:scale-95">
                {theme === 'dark' ? '☼' : '☾'}
             </button>
          </div>
        </div>

        <div className="mb-8">
          <Breadcrumbs
            items={[
              { label: 'DASHBOARD', to: '/admin/dashboard' },
              { label: 'CATALOG_COMMAND' },
            ]}
          />
        </div>

        {/* intelligence cards */}
        <div className="grid gap-6 md:grid-cols-3 mb-10">
          {[
            { label: 'Catalog setup', color: 'text-blue-600', desc: 'Keep vehicle brands, models, variants, and parts organised in one place.' },
            { label: 'Clear structure', color: 'text-indigo-600', desc: 'Build data step by step from company to model, variant, category, and part.' },
            { label: 'Part pricing', color: 'text-emerald-600', desc: 'Set prices for each part and match them to the correct vehicle variant.' }
          ].map((cardInfo) => (
            <div key={cardInfo.label} className={`${card} p-8 hover:border-blue-500/50 transition-all group`}>
               <p className={`text-[10px] font-black uppercase tracking-[0.3em] mb-4 ${cardInfo.color}`}>{cardInfo.label}</p>
               <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed uppercase pr-4 font-['Inter']">{cardInfo.desc}</p>
            </div>
          ))}
        </div>

        <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />

        <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
           {content}
        </div>

        <div className="mt-20 flex flex-col items-center justify-center gap-4 py-10 border-t border-slate-100 dark:border-slate-800/30">
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-300 dark:text-slate-700">Car catalog</p>
          <div className="flex gap-4">
             <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800"></div>
             <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800"></div>
             <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800"></div>
          </div>
        </div>
      </div>
    </div>
  )
}
