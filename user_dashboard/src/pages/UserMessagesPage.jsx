import { useEffect, useState, useRef, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { getRequestMessages, sendRequestMessage, userLogout } from '../lib/api'
import { clearAuth } from '../store/authSlice'
import { ListSkeleton } from '../components/Skeleton'
import MobileNav from '../components/MobileNav'
import Breadcrumbs from '../components/Breadcrumbs'

const SOCKET_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')

function sortMessagesChronologically(items = []) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.sent_at || '') || 0
    const rightTime = Date.parse(right.sent_at || '') || 0

    if (leftTime !== rightTime) return leftTime - rightTime
    return String(left.message_id || '').localeCompare(String(right.message_id || ''))
  })
}

function normalizeIncomingMessage(message) {
  if (!message) return null

  return {
    ...message,
    message_id: message.message_id || message.messageId || `rt-${Date.now()}`,
    sender_id: message.sender_id || message.senderId,
    receiver_id: message.receiver_id || message.receiverId,
    sent_at: message.sent_at || message.sentAt || new Date().toISOString(),
    sender: message.sender || (message.senderName ? { full_name: message.senderName, role: message.senderRole } : undefined),
  }
}

function UserMessagesPage({ theme, onToggleTheme }) {
  const { requestId } = useParams()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const userId = useSelector((s) => s.auth.user?.user_id)

  const [messages, setMessages] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [typingUser, setTypingUser] = useState(null)

  const [receiverId, setReceiverId] = useState('')
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')

  const bottomRef = useRef(null)
  const socketRef = useRef(null)
  const typingTimerRef = useRef(null)
  const composerRef = useRef(null)

  const fetchMessages = useCallback(async (silent = false) => {
    try {
      const data = await getRequestMessages(requestId, { page: 1, limit: 100 })
      setMessages(sortMessagesChronologically(data.messages || []))
      setTotal(data.total || 0)
      setError('')
      if (data.other_party_id) setReceiverId(data.other_party_id)
    } catch (err) {
      setError(err.message || 'Failed to load messages')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [requestId])

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })
    socket.on('connect', () => socket.emit('chat:join', requestId))
    socket.on('chat:new_message', (msg) => {
      if (msg.requestId === requestId) {
        const normalized = normalizeIncomingMessage(msg)
        if (!normalized) return

        let wasAdded = false
        setMessages((prev) => {
          if (prev.some((m) => m.message_id === normalized.message_id)) return prev
          wasAdded = true
          return sortMessagesChronologically([...prev, normalized])
        })
        if (wasAdded) {
          setTotal((count) => count + 1)
        }
      }
    })
    socket.on('chat:error', (payload) => setSendError(payload?.message || 'Unable to join the chat room.'))
    socket.on('chat:typing', ({ userName }) => setTypingUser(userName))
    socket.on('chat:stop_typing', () => setTypingUser(null))
    socketRef.current = socket
    return () => {
      socket.emit('chat:leave', requestId)
      socket.disconnect()
    }
  }, [requestId])

  useEffect(() => {
    fetchMessages(false)
    const interval = setInterval(() => fetchMessages(true), 30000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const composer = composerRef.current
    if (!composer) return
    composer.style.height = '0px'
    composer.style.height = `${Math.min(composer.scrollHeight, 160)}px`
  }, [messageText])

  const handleLogout = async () => {
    await userLogout().catch(() => null)
    dispatch(clearAuth())
    navigate('/auth/user/signin')
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!messageText.trim()) return
    if (!receiverId) {
      setSendError('Technician not found. Ensure an offer is accepted before messaging.')
      return
    }
    setSending(true)
    setSendError('')
    socketRef.current?.emit('chat:stop_typing', { requestId })
    try {
      const response = await sendRequestMessage(requestId, { receiver_id: receiverId, message: messageText.trim() })
      const savedMessage = normalizeIncomingMessage(response?.data)
      if (savedMessage) {
        setMessages((prev) => {
          if (prev.some((message) => message.message_id === savedMessage.message_id)) return prev
          return sortMessagesChronologically([...prev, savedMessage])
        })
        setTotal((count) => count + 1)
      }
      setMessageText('')
    } catch (err) {
      setSendError(err.message || 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const handleInputChange = (e) => {
    setMessageText(e.target.value)
    if (socketRef.current) {
      socketRef.current.emit('chat:typing', { requestId })
      clearTimeout(typingTimerRef.current)
      typingTimerRef.current = setTimeout(() => {
        socketRef.current?.emit('chat:stop_typing', { requestId })
      }, 2000)
    }
  }

  const handleComposerKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 font-['Outfit',_sans-serif] transition-colors duration-500">
      <div className="mx-auto flex min-h-[100dvh] max-w-4xl flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        
        {/* Modern Header */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 shrink-0">
           <Link to={`/requests/${requestId}`} className="flex items-center gap-2 group w-full md:w-auto">
              <div className="shrink-0 w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center group-hover:border-blue-500 transition-all shadow-sm">
                 <svg className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </div>
              <div className="sm:block">
                 <span className="text-[10px] md:text-xs font-black tracking-widest uppercase text-slate-400">MESSAGES</span>
                 <h1 className="text-xs md:text-sm font-black uppercase text-slate-900 dark:text-white tracking-widest">CHAT WITH TECHNICIAN</h1>
              </div>
           </Link>

           <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
             <div className="hidden md:flex flex-col items-end px-3 py-1 bg-blue-500/5 rounded-xl border border-blue-500/10">
                <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">REQUEST ID</span>
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 font-mono">#{requestId.slice(0, 12)}...</span>
             </div>
             <button onClick={onToggleTheme} className="shrink-0 w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center transition-all">
                {theme === 'dark' ? '🌞' : '🌙'}
             </button>
             <button onClick={handleLogout} className="whitespace-nowrap px-4 py-2 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] md:text-xs font-black tracking-widest uppercase">
                LOGOUT
             </button>
           </div>
        </header>

        {/* Chat Interface */}
        <section className="flex-1 flex flex-col rounded-[40px] border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#0B1120]/50 shadow-2xl overflow-hidden backdrop-blur-sm">
          
          {/* Scrollable Messages Area */}
          <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 custom-scrollbar">
            {loading && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400 animate-pulse">
                <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-blue-500 animate-spin" />
                <span className="text-[10px] font-black tracking-widest uppercase">Loading messages...</span>
              </div>
            )}
            
            {error && (
              <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10 text-red-500 text-center text-[10px] font-bold uppercase tracking-widest mx-auto max-w-xs">{error}</div>
            )}

            {!loading && messages.length === 0 && !error && (
              <div className="flex flex-col items-center justify-center h-full gap-6 opacity-40 px-4">
                 <div className="text-6xl text-slate-200">💬</div>
                 <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-center max-w-[200px] md:max-w-[300px] leading-loose">Start the conversation by sending your first message.</p>
              </div>
            )}

            {messages.map((message) => {
              const isMine = message.sender_id === userId || message.sender?.user_id === userId
              const dateObj = new Date(message.sent_at)
              const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              
              return (
                <div key={message.message_id} className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse animate-in slide-in-from-right-4' : 'flex-row animate-in slide-in-from-left-4'}`}>
                   {!isMine && (
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-[10px] font-black text-blue-600 mb-1 border border-blue-500/10 shadow-sm">
                        {message.sender?.full_name?.[0] || 'T'}
                      </div>
                   )}
                   <div className="flex flex-col max-w-[80%] sm:max-w-md">
                      {!isMine && (
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1">
                          {message.sender?.full_name || 'Technician'}
                        </span>
                      )}
                      <div className={`px-5 py-4 rounded-[28px] shadow-sm relative group transition-all duration-300 ${
                        isMine 
                        ? 'bg-blue-600 text-white rounded-br-lg hover:shadow-blue-500/20' 
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700 rounded-bl-lg hover:border-blue-500/30'
                      }`}>
                         <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap select-text">{message.message}</p>
                         <p className={`text-[9px] font-black uppercase tracking-tighter mt-2 opacity-60 text-right ${isMine ? 'text-blue-100' : 'text-slate-400'}`}>
                           {time}
                         </p>
                      </div>
                   </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Premium Input Section */}
          <div className="p-6 bg-slate-50/50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800/50">
             {sendError && <p className="mb-3 text-[10px] font-bold text-red-500 uppercase tracking-tight text-center">{sendError}</p>}
             
             <div className="relative group">
               <form onSubmit={handleSend} className="flex gap-3 items-end p-2 bg-white dark:bg-slate-800 rounded-[32px] border border-slate-200 dark:border-slate-700 focus-within:border-blue-500 shadow-lg transition-all">
                  <textarea
                    ref={composerRef}
                    value={messageText}
                    onChange={handleInputChange}
                    onKeyDown={handleComposerKeyDown}
                    maxLength={5000}
                    rows={1}
                    placeholder="Type your message..."
                    className="flex-1 max-h-40 min-h-[44px] resize-none bg-transparent px-4 py-3 text-sm font-medium outline-none placeholder:text-slate-400 dark:text-white"
                  />
                  <button 
                    type="submit" 
                    disabled={sending || !messageText.trim()} 
                    className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white hover:bg-blue-500 disabled:opacity-50 disabled:bg-slate-200 dark:disabled:bg-slate-700 transition-all shadow-lg active:scale-90 shrink-0"
                  >
                     {sending ? (
                       <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                     ) : (
                       <svg className="w-5 h-5 translate-x-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
                     )}
                  </button>
               </form>

               <div className="mt-3 flex items-center justify-between px-2">
                 <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-pulse"></span>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{total} MESSAGES</p>
                 </div>
                 {typingUser && (
                   <div className="flex items-center gap-2">
                     <div className="flex gap-0.5">
                       <span className="w-1 h-1 bg-blue-500 animate-bounce rounded-full"></span>
                       <span className="w-1 h-1 bg-blue-500 animate-bounce delay-100 rounded-full"></span>
                       <span className="w-1 h-1 bg-blue-500 animate-bounce delay-200 rounded-full"></span>
                     </div>
                     <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{typingUser} is typing</p>
                   </div>
                 )}
               </div>
             </div>
          </div>
        </section>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; }
      `}} />
    </div>
  )
}

export default UserMessagesPage
