import { useState, useEffect } from 'react'
import { submitFeedback, getMyFeedback } from '../lib/api'

function UserFeedbackPage({ theme, onToggleTheme }) {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const [formData, setFormData] = useState({
    type: 'suggestion',
    subject: '',
    message: ''
  })
  const [activeTab, setActiveTab] = useState('view')

  useEffect(() => {
    fetchSubmissions()
  }, [])

  const fetchSubmissions = async () => {
    try {
      setLoading(true)
      const res = await getMyFeedback()
      setSubmissions(res.feedback || [])
    } catch (err) {
      setError(err.message || 'Failed to load feedback')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (formData.message.length < 20) {
      setError('Message must be at least 20 characters long.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      setSuccess(null)
      
      const res = await submitFeedback(formData)
      setSuccess(res.message || 'Feedback submitted successfully!')
      setFormData({ type: 'suggestion', subject: '', message: '' })
      fetchSubmissions()
    } catch (err) {
      setError(err.message || 'Failed to submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-['Outfit',_sans-serif] text-slate-900 transition-colors duration-500 dark:bg-[#030712] dark:text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        
        <header className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Feedback & Complaints
          </h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            Help us improve by sharing your thoughts or reporting any issues.
          </p>
          
          <div className="mt-6 flex border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('view')}
              className={`px-4 py-3 text-sm font-bold transition-colors ${
                activeTab === 'view'
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              My Submissions
            </button>
            <button
              onClick={() => setActiveTab('submit')}
              className={`px-4 py-3 text-sm font-bold transition-colors ${
                activeTab === 'submit'
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              Share Feedback
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-2xl bg-green-50 p-4 text-sm font-bold text-green-600 dark:bg-green-500/10 dark:text-green-400">
            {success}
          </div>
        )}

        {activeTab === 'submit' && (
        <section className="mb-12 rounded-[32px] border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-[#0B1120] sm:p-8">
          <h2 className="mb-6 text-xl font-black tracking-tight text-slate-900 dark:text-white">Share your feedback</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">
                Feedback Type
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-blue-500"
              >
                <option value="suggestion">Suggestion</option>
                <option value="complaint">Complaint</option>
                <option value="bug_report">Bug Report</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">
                Subject
              </label>
              <input
                type="text"
                name="subject"
                required
                value={formData.subject}
                onChange={handleInputChange}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-blue-500"
                placeholder="Brief summary of your feedback"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">
                Message (minimum 20 characters)
              </label>
              <textarea
                name="message"
                required
                minLength={20}
                rows={5}
                value={formData.message}
                onChange={handleInputChange}
                className="w-full resize-none rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-blue-500"
                placeholder="Please describe your suggestion, issue, or general feedback in detail..."
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-blue-600 px-6 py-4 text-sm font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 active:scale-95 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
            >
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </form>
        </section>
        )}

        {activeTab === 'view' && (
        <section>
          <h2 className="mb-6 text-xl font-black tracking-tight text-slate-900 dark:text-white">My Submissions</h2>
          
          {loading ? (
            <p className="text-sm text-slate-500">Loading submissions...</p>
          ) : submissions.length === 0 ? (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-900/50">
              <p className="text-slate-500 dark:text-slate-400">You haven't submitted any feedback yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((item) => (
                <div key={item.id} className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm transition-all dark:border-slate-800 dark:bg-[#0B1120]">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{item.subject}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Submitted on {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                        item.type === 'complaint' ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' :
                        item.type === 'bug_report' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' :
                        item.type === 'suggestion' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' :
                        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {item.type.replace('_', ' ')}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                        item.status === 'resolved' ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' :
                        item.status === 'under_review' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400' :
                        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  
                  <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                    <p className="whitespace-pre-wrap">{item.message}</p>
                  </div>

                  {item.admin_reply && (
                    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20">
                      <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        Response from the team 
                        {item.admin_reply_at && ` • ${new Date(item.admin_reply_at).toLocaleDateString()}`}
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-blue-900 dark:text-blue-100">
                        {item.admin_reply}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
        )}

      </div>
    </div>
  )
}

export default UserFeedbackPage
