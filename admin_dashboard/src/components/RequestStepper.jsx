/**
 * RequestStepper — visual step-by-step progress timeline for admin request view.
 * Props:
 *   status    — request status string (created | pending_offers | offer_accepted | in_progress | completed | cancelled)
 *   jobStatus — job status string (assigned | in_progress | completed | verified) or null
 */

const STEPS = [
  { key: 'created', label: 'Created' },
  { key: 'pending_offers', label: 'Awaiting Offers' },
  { key: 'offer_accepted', label: 'Offer Accepted' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
]

const STATUS_ORDER = STEPS.map((s) => s.key)

function RequestStepper({ status, jobStatus }) {
  const isCancelled = status === 'cancelled'
  const currentIdx = isCancelled ? -1 : STATUS_ORDER.indexOf(status)
  const activeIdx = currentIdx >= 0 ? currentIdx : 0

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Request Progress</h3>

      {/* Desktop stepper */}
      <div className="hidden sm:block">
        <div className="relative flex items-start justify-between">
          {STEPS.map((step, idx) => {
            const isCompleted = !isCancelled && idx < activeIdx
            const isCurrent = !isCancelled && idx === activeIdx

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
            const isCompleted = !isCancelled && idx < activeIdx
            const isCurrent = !isCancelled && idx === activeIdx
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

      {/* Cancelled banner */}
      {isCancelled && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-900/20 dark:text-red-300">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          This request has been cancelled.
        </div>
      )}

      {/* Job status sub-info */}
      {jobStatus && !isCancelled && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Job status: <span className="font-medium capitalize text-slate-700 dark:text-slate-300">{jobStatus.replace(/_/g, ' ')}</span>
        </div>
      )}
    </div>
  )
}

export default RequestStepper
