/**
 * RequestStepper — visual step-by-step progress timeline for service requests.
 * Props:
 *   status  — request status string (created | pending_offers | offer_accepted | in_progress | completed | cancelled)
 */

const STEPS = [
  { key: 'created', label: 'Created', icon: 'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z' },
  { key: 'pending_offers', label: 'Awaiting Offers', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { key: 'offer_accepted', label: 'Offer Accepted', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { key: 'in_progress', label: 'In Progress', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  { key: 'completed', label: 'Completed', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
]

const STATUS_ORDER = STEPS.map((s) => s.key)

function RequestStepper({ status }) {
  const isCancelled = status === 'cancelled'
  const isRejected = status === 'rejected'
  const currentIdx = isCancelled || isRejected ? -1 : STATUS_ORDER.indexOf(status)
  const activeIdx = currentIdx >= 0 ? currentIdx : 0

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Request Progress</h3>

      {/* Desktop stepper */}
      <div className="hidden sm:block">
        <div className="relative flex items-start justify-between">
          {STEPS.map((step, idx) => {
            const isCompleted = !isCancelled && !isRejected && idx < activeIdx
            const isCurrent = !isCancelled && !isRejected && idx === activeIdx

            return (
              <div key={step.key} className="relative z-10 flex flex-1 flex-col items-center">
                {/* connector line (before circle, skip first) */}
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
            const isCompleted = !isCancelled && !isRejected && idx < activeIdx
            const isCurrent = !isCancelled && !isRejected && idx === activeIdx
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
      {(isCancelled || isRejected) && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-900/20 dark:text-red-300">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          {isCancelled
            ? 'This request has been cancelled.'
            : 'This request was automatically closed because no technician accepted it before the day ended.'}
        </div>
      )}
    </div>
  )
}

export default RequestStepper
