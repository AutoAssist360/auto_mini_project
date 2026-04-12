import { useState, useEffect } from 'react'
import { getAllFeedback, updateFeedbackStatus, replyToFeedback } from '../lib/api'

function AdminFeedbackPage({ theme }) {
  const [feedbackList, setFeedbackList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [selectedItem, setSelectedItem] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)
  
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')

  useEffect(() => {
    fetchFeedback()
  }, [filterStatus, filterType])

  const fetchFeedback = async () => {
    try {
      setLoading(true)
      const params = {}
      if (filterStatus) params.status = filterStatus
      if (filterType) params.type = filterType

      const res = await getAllFeedback(params)
      setFeedbackList(res.feedbackList || [])
    } catch (err) {
      setError(err.message || 'Failed to fetch feedback')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateFeedbackStatus(id, newStatus)
      setFeedbackList(list => list.map(item => item.id === id ? { ...item, status: newStatus } : item))
      if (selectedItem?.id === id) {
        setSelectedItem(prev => ({ ...prev, status: newStatus }))
      }
    } catch (err) {
      alert(err.message || 'Failed to update status')
    }
  }

  const handleReplySubmit = async (e) => {
    e.preventDefault()
    if (!replyText.trim()) return

    try {
      setReplying(true)
      // Automatically marking as resolved if it was pending or under review and they reply
      // or we can allow the admin to keep it under review. Let's send a status if we want, currently just replying.
      const res = await replyToFeedback(selectedItem.id, replyText.trim(), 'resolved')
      
      setFeedbackList(list => list.map(item => item.id === selectedItem.id ? res.feedback : item))
      setSelectedItem(null)
      setReplyText('')
      
      // refresh just in case
      fetchFeedback()
    } catch (err) {
      alert(err.message || 'Failed to send reply')
    } finally {
      setReplying(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-['Outfit',_sans-serif] text-slate-900 transition-colors dark:bg-[#030712] dark:text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              User Feedback & Complaints
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Review platform suggestions, bug reports, and resolve user complaints.
            </p>
          </div>
          <div className="flex gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">All Types</option>
              <option value="suggestion">Suggestion</option>
              <option value="complaint">Complaint</option>
              <option value="bug_report">Bug Report</option>
              <option value="other">Other</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* Main List column */}
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#0B1120]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                  <thead className="bg-slate-50 text-xs font-black uppercase text-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                    <tr>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Subject</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-sm">Loading...</td>
                      </tr>
                    ) : feedbackList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-sm">No feedback found.</td>
                      </tr>
                    ) : (
                      feedbackList.map(item => (
                        <tr 
                          key={item.id} 
                          className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selectedItem?.id === item.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                        >
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900 dark:text-white">{item.user?.full_name || 'Unknown'}</div>
                            <div className="text-xs">{item.user?.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                              item.type === 'complaint' ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' :
                              item.type === 'bug_report' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' :
                              item.type === 'suggestion' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' :
                              'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              {item.type.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="max-w-[200px] truncate font-medium text-slate-900 dark:text-slate-200">
                              {item.subject}
                            </div>
                            <div className="text-xs">
                              {new Date(item.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                             <select
                                value={item.status}
                                onChange={(e) => handleStatusChange(item.id, e.target.value)}
                                className={`rounded-xl border border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 ${
                                  item.status === 'pending' ? 'bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300' :
                                  item.status === 'under_review' ? 'bg-purple-50 text-purple-900 dark:bg-purple-900/30 dark:text-purple-300' :
                                  'bg-green-50 text-green-900 dark:bg-green-900/30 dark:text-green-300'
                                }`}
                              >
                                <option value="pending">Pending</option>
                                <option value="under_review">Under Review</option>
                                <option value="resolved">Resolved</option>
                              </select>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setSelectedItem(item)}
                              className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold tracking-wide text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Details Sidebar */}
          <div className="lg:col-span-1">
            {selectedItem ? (
              <div className="sticky top-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-[#0B1120]">
                <div className="mb-4 flex items-start justify-between">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">Feedback Details</h3>
                  <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-slate-600">
                    ✕
                  </button>
                </div>
                
                <div className="mb-6 space-y-4">
                  <div>
                    <div className="text-xs font-bold uppercase text-slate-500">User</div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-200">{selectedItem.user?.full_name}</div>
                    <div className="text-sm text-slate-500">{selectedItem.user?.email}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase text-slate-500">Subject</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{selectedItem.subject}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase text-slate-500">Message</div>
                    <div className="mt-1 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                      {selectedItem.message}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-6 dark:border-slate-800">
                  {selectedItem.admin_reply ? (
                    <div>
                      <div className="mb-2 text-xs font-black uppercase text-green-600 dark:text-green-400">Replied on {new Date(selectedItem.admin_reply_at).toLocaleDateString()}</div>
                      <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-100">
                        {selectedItem.admin_reply}
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleReplySubmit}>
                      <label className="mb-2 block text-xs font-bold uppercase text-slate-500">Send reply to user</label>
                      <textarea
                        required
                        rows={4}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        placeholder="Write your response here..."
                      />
                      <button
                        type="submit"
                        disabled={replying}
                        className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50"
                      >
                        {replying ? 'Sending...' : 'Send Reply & Resolve'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
                <p className="text-sm font-bold text-slate-400">Select a feedback entry to view details.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

export default AdminFeedbackPage
