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
    if (selectedCompanyId && (activeView === 'company-profile' || activeView === 'companies')) {
      setContext({ companyId: selectedCompanyId })
    } else if (selectedContactId && (activeView === 'contact-profile' || activeView === 'contacts')) {
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
      el.style.height = Math.min(el.scrollHeight, 96) + 'px'
    }
  }, [input])

  const resolveContextLabel = useCallback(() => {
    if (selectedCompanyId && (activeView === 'company-profile' || activeView === 'companies')) {
      return 'Company context active'
    }
    if (selectedContactId && (activeView === 'contact-profile' || activeView === 'contacts')) {
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
            className="fixed inset-0 bg-black/20 z-40"
            onClick={onClose}
          />

          {/* Panel — dark glassmorphism to match app */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-[400px] max-w-[calc(100vw-1rem)] z-50 flex flex-col border-l"
            style={{
              background: 'rgba(255, 255, 255, 0.97)',
              backdropFilter: 'blur(24px) saturate(1.5)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-bright))' }}>
                  <Sparkles className="size-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground leading-tight">AI Assistant</h2>
                  <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>DeepMindQ</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close AI Assistant"
              >
                <X className="size-4" style={{ color: 'var(--color-muted-foreground)' }} />
              </button>
            </div>

            {/* ── Context Bar ── */}
            {currentContextLabel && (
              <div className="px-4 py-2 border-b flex items-center gap-2 shrink-0" style={{ background: 'color-mix(in oklch, var(--color-gold) 8%, transparent)', borderColor: 'color-mix(in oklch, var(--color-gold) 12%, transparent)' }}>
                {context?.companyId && <Building2 className="size-3.5 shrink-0" style={{ color: 'var(--color-gold)' }} />}
                {context?.contactId && <User className="size-3.5 shrink-0" style={{ color: 'var(--color-gold)' }} />}
                {context?.opportunityId && <Target className="size-3.5 shrink-0" style={{ color: 'var(--color-gold)' }} />}
                <span className="text-xs font-medium truncate" style={{ color: 'var(--color-gold)' }}>
                  Context: {currentContextLabel}
                </span>
                <button
                  onClick={clearContext}
                  className="ml-auto p-0.5 rounded hover:bg-gray-100 transition-colors shrink-0"
                  aria-label="Clear context"
                >
                  <RotateCcw className="size-3" style={{ color: 'var(--color-gold-dim)' }} />
                </button>
              </div>
            )}

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {messages.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center h-full text-center px-2">
                  <div className="size-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'color-mix(in oklch, var(--color-gold) 12%, transparent)' }}>
                    <MessageSquare className="size-6" style={{ color: 'var(--color-gold)' }} />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">How can I help?</h3>
                  <p className="text-xs mb-6 max-w-[260px]" style={{ color: 'var(--color-muted-foreground)' }}>
                    Ask about your companies, contacts, deals, or get help with any CRM task.
                  </p>

                  {/* Suggested Questions */}
                  <div className="w-full space-y-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s.text}
                        onClick={() => sendMessage(s.text)}
                        className="w-full text-left px-3.5 py-2.5 rounded-xl border transition-all text-sm flex items-center gap-2.5 group"
                        style={{
                          borderColor: 'var(--border-subtle)',
                          background: 'transparent',
                          color: 'var(--color-muted-foreground)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'color-mix(in oklch, var(--color-gold) 6%, transparent)';
                          e.currentTarget.style.borderColor = 'color-mix(in oklch, var(--color-gold) 20%, transparent)';
                          e.currentTarget.style.color = 'var(--color-foreground)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = 'var(--border-subtle)';
                          e.currentTarget.style.color = 'var(--color-muted-foreground)';
                        }}
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
                        ? 'rounded-br-md text-white'
                        : 'rounded-bl-md',
                    )}
                    style={
                      msg.role === 'user'
                        ? { background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-dim))' }
                        : { background: '#F9FAFB', border: '1px solid #E5E7EB', color: 'var(--color-foreground)' }
                    }
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
                        msg.role === 'user' ? 'text-white/60 text-right' : '',
                      )}
                      style={msg.role !== 'user' ? { color: 'var(--text-dim)' } : undefined}
                    >
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md px-4 py-3" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full animate-bounce [animation-delay:0ms]" style={{ background: 'var(--color-gold)' }} />
                      <span className="size-2 rounded-full animate-bounce [animation-delay:150ms]" style={{ background: 'var(--color-gold)' }} />
                      <span className="size-2 rounded-full animate-bounce [animation-delay:300ms]" style={{ background: 'var(--color-gold)' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ── Input Area ── */}
            <div className="border-t px-4 py-3 shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
              <div
                className="flex items-end gap-2 rounded-2xl px-3 py-2 transition-all"
                style={{
                  background: '#F3F4F6',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about any company, contact, or deal..."
                  disabled={isLoading}
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground resize-none outline-none min-h-[20px] max-h-[96px] py-0.5 disabled:opacity-50"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={isLoading || !input.trim()}
                  className={cn(
                    'p-1.5 rounded-xl transition-all shrink-0',
                    input.trim() && !isLoading
                      ? 'text-white shadow-sm hover:shadow-md active:scale-95'
                      : 'cursor-not-allowed',
                  )}
                  style={
                    input.trim() && !isLoading
                      ? { background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-dim))' }
                      : { background: '#E5E7EB', color: 'var(--text-dim)' }
                  }
                  aria-label="Send message"
                >
                  <Send className="size-4" />
                </button>
              </div>
              <p className="text-[10px] mt-1.5 text-center" style={{ color: 'var(--text-dim)' }}>
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}