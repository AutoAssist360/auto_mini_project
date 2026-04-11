/**
 * JobStepper — visual step-by-step progress timeline for technician jobs.
 * Props:
 *   jobStatus      — job status string (assigned | in_progress | completed | verified)
 *   hasInvoice     — boolean, whether an invoice has been created
 *   paymentStatus  — invoice payment_status string (pending | completed | failed | refunded) or null
 */

const STEPS = [
  { key: 'assigned', label: 'Assigned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Job Completed' },
  { key: 'invoiced', label: 'Invoice Created' },
  { key: 'paid', label: 'Payment Done' },
]

function getActiveIndex(jobStatus, hasInvoice, paymentStatus) {
  if (paymentStatus === 'completed') return 4 // paid
  if (hasInvoice) return 3 // invoiced
  if (jobStatus === 'completed' || jobStatus === 'verified') return 2
  if (jobStatus === 'in_progress') return 1
  return 0 // assigned
}

function JobStepper({ jobStatus, hasInvoice = false, paymentStatus = null }) {
  const activeIdx = getActiveIndex(jobStatus, hasInvoice, paymentStatus)

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Job Progress</h3>

      {/* Desktop stepper */}
      <div className="hidden sm:block">
        <div className="relative flex items-start justify-between">
          {STEPS.map((step, idx) => {
            const isCompleted = idx < activeIdx
            const isCurrent = idx === activeIdx

            return (
              <div key={step.key} className="relative z-10 flex flex-1 flex-col items-center">
                {/* connector line */}
                {idx > 0 && (
                  <div className="absolute top-4 right-1/2 left-[-50%] h-0.5">
                    <div className={`h-full w-full ${isCompleted || isCurrent ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  </div>
                )}

                {/* circle */}
                <div className="relative">
                  {isCurrent && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-blue-400 opacity-30" style={{ animationDuration: '2s' }} />
                  )}
                  <div
                    className={`relative flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
                      isCompleted
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : isCurrent
                          ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'border-slate-300 bg-slate-100 text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500'
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-xs font-bold">{idx + 1}</span>
                    )}
                  </div>
                </div>

                {/* label */}
                <p
                  className={`mt-2 text-center text-xs font-medium ${
                    isCompleted
                      ? 'text-blue-600 dark:text-blue-400'
                      : isCurrent
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {step.label}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Mobile stepper (vertical) */}
      <div className="sm:hidden">
        <div className="space-y-3">
          {STEPS.map((step, idx) => {
            const isCompleted = idx < activeIdx
            const isCurrent = idx === activeIdx
            return (
              <div key={step.key} className="flex items-center gap-3">
                <div className="relative shrink-0">
                  {isCurrent && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-blue-400 opacity-30" style={{ animationDuration: '2s' }} />
                  )}
                  <div
                    className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold ${
                      isCompleted
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : isCurrent
                          ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'border-slate-300 bg-slate-100 text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500'
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      idx + 1
                    )}
                  </div>
                </div>
                <span
                  className={`text-sm font-medium ${
                    isCompleted
                      ? 'text-blue-600 dark:text-blue-400'
                      : isCurrent
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Payment failure banner */}
      {paymentStatus === 'failed' && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-900/20 dark:text-red-300">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Payment failed. Customer may need to retry.
        </div>
      )}

      {paymentStatus === 'refunded' && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          Payment has been refunded.
        </div>
      )}
    </div>
  )
}

export default JobStepper
