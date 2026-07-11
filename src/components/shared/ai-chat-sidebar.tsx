'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Send, Building2, User, Target, RotateCcw, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AiChatSidebarProps {
  isOpen: boolean
  onClose: () => void
}

interface ChatContext {
  companyId?: string
  contactId?: string
  opportunityId?: string
  label?: string
}

// ---------------------------------------------------------------------------
// Suggested questions (shown when conversation is empty)
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  { text: 'What are my hottest leads?', icon: '🔥' },
  { text: 'Summarize recent activity', icon: '📊' },
  { text: 'Which contacts need follow-up?', icon: '🔄' },
  { text: 'Show me companies in Technology', icon: '🏢' },
] as const

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiChatSidebar({ isOpen, onClose }: AiChatSidebarProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [context, setContext] = useState<ChatContext | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const selectedCompanyId = useAppStore((s) => s.selectedCompanyId)
  const selectedContactId = useAppStore((s) => s.selectedContactId)
  const activeView = useAppStore((s) => s.activeView)

  // Sync context from store
  useEffect(() => {
    if (selectedCompanyId && (activeView === 'company-profile')) {
      setContext({ companyId: selectedCompanyId })
      // We can't fetch the name without an API call here — we'll just show the ID indicator
      // The backend will resolve it
    } else if (selectedContactId && (activeView === 'contact-profile')) {
      setContext({ contactId: selectedContactId })
    } else {
      setContext(null)
    }
  }, [selectedCompanyId, selectedContactId, activeView])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 96) + 'px' // max ~4 lines
    }
  }, [input])

  const resolveContextLabel = useCallback(() => {
    if (selectedCompanyId && activeView === 'company-profile') {
      return 'Company context active'
    }
    if (selectedContactId && activeView === 'contact-profile') {
      return 'Contact context active'
    }
    return null
  }, [selectedCompanyId, selectedContactId, activeView])

  // Send message
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMsg])
      setInput('')
      setIsLoading(true)

      try {
        const conversationHistory = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }))

        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message: trimmed,
            context: context || undefined,
            conversationHistory,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to get response')

        const aiMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.message || 'Sorry, I could not generate a response.',
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, aiMsg])
      } catch (err) {
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMsg])
      } finally {
        setIsLoading(false)
        // Refocus textarea
        setTimeout(() => textareaRef.current?.focus(), 100)
      }
    },
    [isLoading, messages, context],
  )

  // Handle keydown (Enter to send, Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const clearContext = () => {
    setContext(null)
  }

  const currentContextLabel = resolveContextLabel()

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop (subtle) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/10 z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-[400px] max-w-[calc(100vw-1rem)] bg-white border-l border-gray-200/80 shadow-xl z-50 flex flex-col"
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
                  <Sparkles className="size-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 leading-tight">AI Assistant</h2>
                  <p className="text-[11px] text-gray-400">DeepMindQ</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close AI Assistant"
              >
                <X className="size-4 text-gray-400" />
              </button>
            </div>

            {/* ── Context Bar ── */}
            {currentContextLabel && (
              <div className="px-4 py-2 bg-amber-50/60 border-b border-amber-100/60 flex items-center gap-2 shrink-0">
                {context?.companyId && <Building2 className="size-3.5 text-amber-600 shrink-0" />}
                {context?.contactId && <User className="size-3.5 text-amber-600 shrink-0" />}
                {context?.opportunityId && <Target className="size-3.5 text-amber-600 shrink-0" />}
                <span className="text-xs text-amber-700 font-medium truncate">
                  Context: {currentContextLabel}
                </span>
                <button
                  onClick={clearContext}
                  className="ml-auto p-0.5 rounded hover:bg-amber-100/80 transition-colors shrink-0"
                  aria-label="Clear context"
                >
                  <RotateCcw className="size-3 text-amber-500" />
                </button>
              </div>
            )}

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {messages.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center h-full text-center px-2">
                  <div className="size-12 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center mb-3">
                    <MessageSquare className="size-6 text-amber-500" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">How can I help?</h3>
                  <p className="text-xs text-gray-400 mb-6 max-w-[260px]">
                    Ask about your companies, contacts, deals, or get help with any CRM task.
                  </p>

                  {/* Suggested Questions */}
                  <div className="w-full space-y-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s.text}
                        onClick={() => sendMessage(s.text)}
                        className="w-full text-left px-3.5 py-2.5 rounded-xl border border-gray-200/80 bg-gray-50/50 hover:bg-amber-50 hover:border-amber-200/80 transition-all text-sm text-gray-600 hover:text-amber-800 flex items-center gap-2.5 group"
                      >
                        <span className="text-base shrink-0">{s.icon}</span>
                        <span className="truncate group-hover:font-medium transition-colors">{s.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-br-md'
                        : 'bg-gray-50 border border-gray-200/80 text-gray-700 rounded-bl-md',
                    )}
                  >
                    {/* Render simple markdown-like formatting */}
                    <div className="whitespace-pre-wrap break-words [&>strong]:font-semibold [&_strong]:font-semibold">
                      {msg.content.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
                        part.startsWith('**') && part.endsWith('**')
                          ? <strong key={i}>{part.slice(2, -2)}</strong>
                          : <span key={i}>{part}</span>,
                      )}
                    </div>
                    <div
                      className={cn(
                        'text-[10px] mt-1.5',
                        msg.role === 'user' ? 'text-amber-100 text-right' : 'text-gray-400',
                      )}
                    >
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-50 border border-gray-200/80 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-amber-400 animate-bounce [animation-delay:0ms]" />
                      <span className="size-2 rounded-full bg-amber-400 animate-bounce [animation-delay:150ms]" />
                      <span className="size-2 rounded-full bg-amber-400 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ── Input Area ── */}
            <div className="border-t border-gray-100 px-4 py-3 shrink-0">
              <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200/80 px-3 py-2 focus-within:border-amber-300 focus-within:ring-2 focus-within:ring-amber-100 transition-all">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about any company, contact, or deal..."
                  disabled={isLoading}
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 resize-none outline-none min-h-[20px] max-h-[96px] py-0.5 disabled:opacity-50"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={isLoading || !input.trim()}
                  className={cn(
                    'p-1.5 rounded-xl transition-all shrink-0',
                    input.trim() && !isLoading
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm hover:shadow-md active:scale-95'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed',
                  )}
                  aria-label="Send message"
                >
                  <Send className="size-4" />
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 text-center">
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}