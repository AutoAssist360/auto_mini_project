import { useRef } from 'react'

const baseClassName =
  'admin-date-input w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 pr-10 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

function AdminDateInput({ className = '', ...props }) {
  const inputRef = useRef(null)

  const openPicker = () => {
    const input = inputRef.current
    if (!input) return

    if (typeof input.showPicker === 'function') {
      input.showPicker()
      return
    }

    input.focus()
    input.click()
  }

  return (
    <div className="relative">
      <input ref={inputRef} type="date" className={`${baseClassName} ${className}`.trim()} {...props} />
      <button
        type="button"
        aria-label="Open calendar"
        onClick={openPicker}
        className="absolute inset-y-0 right-3 flex items-center text-white transition hover:text-white/80"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
          <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm12 8H5v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8ZM6 6a1 1 0 0 0-1 1v1h14V7a1 1 0 0 0-1-1H6Z" />
        </svg>
      </button>
    </div>
  )
}

export default AdminDateInput
