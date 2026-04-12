import { useCallback, useRef, useState } from 'react'
import { ToastContext } from './toastContext'

/* ────────────────────────────────────────────────────────── */
/*  Context                                                   */
/* ────────────────────────────────────────────────────────── */
/* ────────────────────────────────────────────────────────── */
/*  Provider                                                  */
/* ────────────────────────────────────────────────────────── */
let nextId = 0

/**
 * Wrap your app in <ToastProvider> and call the `toast` helpers anywhere:
 *
 *   const { toast } = useToast()
 *   toast.success('Saved!')
 *   toast.error('Something broke')
 *   toast.info('FYI …')
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const add = useCallback(
    (message, variant = 'info', duration = 4000) => {
      const id = ++nextId
      setToasts((prev) => [...prev, { id, message, variant }])
      timers.current[id] = setTimeout(() => dismiss(id), duration)
      return id
    },
    [dismiss],
  )

  const toast = {
    success: (msg, ms) => add(msg, 'success', ms),
    error: (msg, ms) => add(msg, 'error', ms),
    info: (msg, ms) => add(msg, 'info', ms),
    warn: (msg, ms) => add(msg, 'warn', ms),
    dismiss,
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* ── Toast container (bottom-right) ──────────────── */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-3 z-9999 flex flex-col-reverse gap-2 sm:inset-x-auto sm:bottom-4 sm:right-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-full items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur transition-all animate-slide-in sm:w-80 sm:max-w-[90vw] ${variantStyles[t.variant]}`}
          >
            <span className="mt-0.5">{icons[t.variant]}</span>
            <span className="min-w-0 flex-1 break-words">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="ml-2 shrink-0 whitespace-nowrap text-current opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/* ────────────────────────────────────────────────────────── */
/*  Variant styles                                            */
/* ────────────────────────────────────────────────────────── */
const variantStyles = {
  success:
    'border-blue-200 bg-blue-50/95 text-blue-800 dark:border-blue-800 dark:bg-blue-900/80 dark:text-blue-200',
  error:
    'border-red-200 bg-red-50/95 text-red-800 dark:border-red-800 dark:bg-red-900/80 dark:text-red-200',
  info:
    'border-blue-200 bg-blue-50/95 text-blue-800 dark:border-blue-800 dark:bg-blue-900/80 dark:text-blue-200',
  warn:
    'border-amber-200 bg-amber-50/95 text-amber-800 dark:border-amber-800 dark:bg-amber-900/80 dark:text-amber-200',
}

const icons = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warn: '⚠',
}
