import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { io } from 'socket.io-client'
import { getRequestMessages, sendRequestMessage, ApiError } from '../lib/api'
import { ListSkeleton } from '../components/Skeleton'
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

function TechnicianMessagesPage({ theme, onToggleTheme }) {
  const { requestId } = useParams()
  const navigate = useNavigate()
  const dark = theme === 'dark'
  const myUserId = useSelector((state) => state.auth.user?.user?.user_id || state.auth.user?.user_id)

  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [receiverId, setReceiverId] = useState('')
  const [typingUser, setTypingUser] = useState(null)
  const messagesEndRef = useRef(null)
  const pollRef = useRef(null)
  const socketRef = useRef(null)
  const typingTimerRef = useRef(null)
  const composerRef = useRef(null)

  const loadMessages = useCallback(async () => {
    try {
      const res = await getRequestMessages(requestId, 1, 100)
      setMessages(sortMessagesChronologically(res?.messages ?? []))
      setError('')
      if (res?.other_party_id) {
        setReceiverId(res.other_party_id)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [requestId])

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => {
      socket.emit('chat:join', requestId)
    })

    socket.on('chat:new_message', (msg) => {
      if (msg.requestId === requestId) {
        const normalized = normalizeIncomingMessage(msg)
        if (!normalized) return

        setMessages((prev) => {
          if (prev.some((message) => message.message_id === normalized.message_id)) {
            return prev
          }

          return sortMessagesChronologically([...prev, normalized])
        })
      }
    })

    socket.on('chat:error', (payload) => {
      setError(payload?.message || 'Unable to join the chat room.')
    })

    socket.on('chat:typing', ({ userName }) => {
      setTypingUser(userName)
    })

    socket.on('chat:stop_typing', () => {
      setTypingUser(null)
    })

    socketRef.current = socket

    return () => {
      socket.emit('chat:leave', requestId)
      socket.disconnect()
    }
  }, [requestId])

  useEffect(() => {
    loadMessages()
    pollRef.current = setInterval(loadMessages, 30000)
    return () => clearInterval(pollRef.current)
  }, [loadMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const composer = composerRef.current
    if (!composer) return

    composer.style.height = '0px'
    composer.style.height = `${Math.min(composer.scrollHeight, 160)}px`
  }, [newMessage])

  const handleSend = async () => {
    if (!newMessage.trim() || !receiverId) return
    socketRef.current?.emit('chat:stop_typing', { requestId })
    setSending(true)

    try {
      const response = await sendRequestMessage(requestId, receiverId, newMessage.trim())
      const savedMessage = normalizeIncomingMessage(response?.data)
      if (savedMessage) {
        setMessages((prev) => {
          if (prev.some((message) => message.message_id === savedMessage.message_id)) {
            return prev
          }

          return sortMessagesChronologically([...prev, savedMessage])
        })
      }
      setNewMessage('')
      setError('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleInputChange = (e) => {
    setNewMessage(e.target.value)
    if (socketRef.current) {
      socketRef.current.emit('chat:typing', { requestId })
      clearTimeout(typingTimerRef.current)
      typingTimerRef.current = setTimeout(() => {
        socketRef.current?.emit('chat:stop_typing', { requestId })
      }, 2000)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={`flex min-h-[100dvh] flex-col ${dark ? 'dark bg-[#030712] text-slate-100' : 'bg-slate-50 text-slate-900'} font-['Outfit',_sans-serif] transition-colors duration-500 relative overflow-hidden pb-24`}>
       {/* Background Blurs */}
       <div className="fixed top-0 left-0 w-full h-screen overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-5%] left-[-10%] w-[45%] h-[45%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-5%] right-[-10%] w-[45%] h-[45%] bg-indigo-600/5 dark:bg-indigo-600/15 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Floating Header */}
        <header className="mb-6 rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-md px-4 py-3 shadow-xl dark:shadow-2xl flex items-center justify-between transition-all shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/jobs')} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex flex-col">
              <h1 className="text-lg font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">Customer Chat</h1>
              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-1 opacity-80">Request {requestId?.slice(-8).toUpperCase()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onToggleTheme} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-lg">
               {dark ? '🌞' : '🌙'}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 animate-in slide-in-from-top-2">
            {error}
          </div>
        )}

        {/* Chat */}
        <div className="flex-1 overflow-hidden relative rounded-[32px] border border-slate-200 dark:border-slate-800/50 bg-white/70 dark:bg-white/5 backdrop-blur-xl shadow-2xl flex flex-col mb-4">
          <div className="flex-1 overflow-y-auto p-6 scrollbar-hide space-y-6">
            {loading ? (
              <ListSkeleton rows={4} />
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-40 grayscale pointer-events-none">
                 <div className="text-6xl mb-4">💬</div>
                 <h2 className="text-xl font-black uppercase tracking-tighter">No messages yet</h2>
                 <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em]">Start the conversation when you are ready.</p>
              </div>
            ) : (
              <>
                <div className="flex justify-center mb-8">
                   <span className="px-4 py-1 rounded-full bg-slate-200/50 dark:bg-white/10 text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em]">Chat started</span>
                </div>
                {messages.map((message) => {
                  const isMe = message.sender_id === myUserId
                  return (
                    <div key={message.message_id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} group`}>
                      <div className={`relative max-w-[85%] sm:max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className={`px-5 py-3.5 rounded-[24px] shadow-sm transform transition-all duration-300 ${isMe ? 'rounded-tr-none bg-blue-600 text-white' : 'rounded-tl-none bg-white dark:bg-white/10 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800'}`}>
                          <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed">{message.message}</p>
                        </div>
                        <div className={`mt-2 flex items-center gap-2 text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-60 transition-opacity ${isMe ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                           <span>{message.sender?.full_name || (isMe ? 'You' : 'Customer')}</span>
                           <span>•</span>
                           <span>{new Date(message.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 bg-slate-100/30 dark:bg-black/20 border-t border-slate-200 dark:border-slate-800/50 shrink-0">
            {typingUser && (
              <div className="absolute bottom-[80px] left-6 flex items-center gap-2">
                 <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                 </div>
                 <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest italic">{typingUser} is typing...</span>
              </div>
            )}
            
            <div className="flex items-end gap-3">
              <textarea
                ref={composerRef}
                value={newMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={receiverId ? 'Type a message...' : 'Messaging will open when the customer can chat'}
                disabled={!receiverId && messages.length === 0}
                rows={1}
                className="flex-1 max-h-32 min-h-[48px] resize-none rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 px-5 py-3 text-sm font-medium outline-none focus:border-blue-600 dark:focus:border-blue-500 transition-all shadow-inner scrollbar-hide"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !newMessage.trim() || !receiverId}
                className="h-[48px] w-[48px] sm:w-auto sm:px-6 rounded-2xl bg-blue-600 text-white shadow-lg hover:scale-[1.05] active:scale-[0.95] disabled:opacity-40 disabled:scale-100 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">SEND</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TechnicianMessagesPage
