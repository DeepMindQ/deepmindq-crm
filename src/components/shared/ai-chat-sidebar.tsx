'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { tokens } from '@/components/intelligence-os/design-tokens';
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Send, Building2, User, Target, RotateCcw, MessageSquare, AlertTriangle, Wifi, WifiOff, RefreshCw, CheckCircle2, Database, Loader2 } from 'lucide-react'
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
  /** True while content is still streaming in */
  isStreaming?: boolean
  /** Error detail if the message is an error */
  errorDetail?: string
  /** Tool-use status: shows when AI is querying CRM data */
  toolStatus?: string
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

/** Provider health status shown in the header */
interface ProviderStatus {
  available: boolean
  providerName?: string
  lastChecked: Date
}

// ---------------------------------------------------------------------------
// Suggested questions (shown when conversation is empty)
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  { text: 'What are my hottest leads?', icon: '🔥' },
  { text: 'Which contacts need follow-up?', icon: '🔄' },
  { text: 'Show me recent buying signals', icon: '⚡' },
  { text: 'Get pipeline summary', icon: '📊' },
] as const

// ---------------------------------------------------------------------------
// Helper: Check AI provider health
// ---------------------------------------------------------------------------

async function checkProviderHealth(): Promise<ProviderStatus> {
  try {
    const res = await fetch('/api/ai/providers-status', { credentials: 'include' })
    if (!res.ok) return { available: false, lastChecked: new Date() }
    const data = await res.json()
    const activeProvider = data.providers?.find((p: { status: string }) => p.status === 'active')
    return {
      available: data.overallReady ?? false,
      providerName: activeProvider?.label || (data.activeSource === 'zai-sdk' ? 'DeepMindQ AI' : undefined),
      lastChecked: new Date(),
    }
  } catch {
    return { available: false, lastChecked: new Date() }
  }
}

// ---------------------------------------------------------------------------
// Helper: Parse SSE stream from /api/ai/chat-stream
// ---------------------------------------------------------------------------

function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (msg: string) => void,
  onToolStatus?: (status: string) => void,
): { cancel: () => void } {
  const decoder = new TextDecoder()
  let buffer = ''
  let cancelled = false

  async function pump() {
    try {
      while (!cancelled) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith(':') || !trimmed.startsWith('data:')) continue
          const dataStr = trimmed.slice(5).trim()

          if (dataStr === '[DONE]') {
            onDone()
            return
          }

          try {
            const parsed = JSON.parse(dataStr)
            if (parsed.event === 'error') {
              onError(typeof parsed.data === 'string' ? parsed.data : JSON.stringify(parsed.data))
              return
            }
            if (parsed.event === 'done') {
              onDone()
              return
            }
            if (parsed.event === 'chunk' && typeof parsed.data === 'string' && parsed.data) {
              onChunk(parsed.data)
            }
            if (parsed.event === 'tool_status' && typeof parsed.data === 'string' && onToolStatus) {
              onToolStatus(parsed.data)
            }
          } catch {
            // Malformed JSON — try to use raw text
            if (dataStr && dataStr !== '[DONE]') {
              onChunk(dataStr)
            }
          }
        }
      }
      onDone()
    } catch (err) {
      if (!cancelled) {
        onError(err instanceof Error ? err.message : 'Stream connection lost')
      }
    }
  }

  pump()

  return {
    cancel: () => {
      cancelled = true
      reader.cancel().catch(() => {})
    },
  }
}

// ---------------------------------------------------------------------------
// Simple Markdown Renderer (bold, lists, code)
// ---------------------------------------------------------------------------

function renderMarkdown(text: string): React.ReactNode[] {
  if (!text) return []

  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Bullet points: "- item" or "* item" or "• item"
    if (/^[\-\*\•]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[\-\*\•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[\-\*\•]\s+/, ''))
        i++
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc pl-4 my-1 space-y-0.5">
          {items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ul>,
      )
      continue
    }

    // Numbered lists: "1. item"
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''))
        i++
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal pl-4 my-1 space-y-0.5">
          {items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ol>,
      )
      continue
    }

    // Empty line
    if (!line.trim()) {
      i++
      elements.push(<br key={`br-${i}`} />)
      continue
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${i}`} className="my-0.5">
        {renderInline(line)}
      </p>,
    )
    i++
  }

  return elements
}

/** Render inline markdown: **bold**, `code`, and plain text */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  // Match **bold** and `code`
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      parts.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>)
    }
    const token = match[0]
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={`b-${match.index}`}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code key={`c-${match.index}`} className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">
          {token.slice(1, -1)}
        </code>,
      )
    }
    lastIndex = match.index + token.length
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex)}</span>)
  }

  return parts
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiChatSidebar({ isOpen, onClose }: AiChatSidebarProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [context, setContext] = useState<ChatContext | null>(null)
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [toolThinking, setToolThinking] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const selectedCompanyId = useAppStore((s) => s.selectedCompanyId)
  const selectedContactId = useAppStore((s) => s.selectedContactId)
  const activeView = useAppStore((s) => s.activeView)

  // ── Check provider health on mount and when sidebar opens ──
  useEffect(() => {
    if (isOpen) {
      checkProviderHealth().then(setProviderStatus)
    }
  }, [isOpen])

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

  // ── Send message with streaming ──
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

      // Build messages array for proper multi-turn conversation
      const conversationMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: trimmed },
      ]

      // Create assistant placeholder for streaming
      const assistantId = crypto.randomUUID()
      setToolThinking(true)
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          isStreaming: true,
          toolStatus: 'Analyzing your question...',
        },
      ])

      const controller = new AbortController()
      abortControllerRef.current = controller

      try {
        const res = await fetch('/api/ai/chat-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify({
            messages: conversationMessages,
            context: context || undefined,
            temperature: 0.7,
            maxTokens: 4096,
          }),
        })

        // Handle non-streaming errors (4xx, 5xx that return JSON)
        const contentType = res.headers.get('content-type') ?? ''
        if (!res.ok || contentType.includes('application/json')) {
          const errorData = await res.json().catch(() => ({ error: 'Unknown error' }))
          const errorMsg = errorData.error || errorData.reason || `Error ${res.status}`

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: '',
                    isStreaming: false,
                    errorDetail: errorMsg,
                  }
                : m,
            ),
          )
          setIsLoading(false)
          return
        }

        // Handle streaming response
        if (!res.body) {
          throw new Error('No response body received')
        }

        const reader = res.body.getReader()
        const { cancel } = parseSSEStream(
          reader,
          // onChunk — append text to the streaming message
          (chunk) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + chunk } : m,
              ),
            )
          },
          // onDone — finalize the message
          () => {
            setToolThinking(false)
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, isStreaming: false, toolStatus: undefined } : m,
              ),
            )
            setIsLoading(false)
            // Re-check provider health after successful call
            checkProviderHealth().then(setProviderStatus)
          },
          // onError — show error in the message bubble
          (errMsg) => {
            setToolThinking(false)
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: m.content || '',
                      isStreaming: false,
                      errorDetail: errMsg,
                    }
                  : m,
              ),
            )
            setIsLoading(false)
          },
          // onToolStatus — show tool execution progress in the message bubble
          (status) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, toolStatus: status } : m,
              ),
            )
          },
        )

        // Store cancel handle on the controller for cleanup
        ;(controller as AbortController & { _streamCancel?: () => void })._streamCancel = cancel
      } catch (err) {
        if (controller.signal.aborted) {
          // User cancelled — don't show error
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content || 'Cancelled.', isStreaming: false }
                : m,
            ),
          )
        } else {
          const errorMsg = err instanceof Error ? err.message : 'Network error — please check your connection.'
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: '',
                    isStreaming: false,
                    errorDetail: errorMsg,
                  }
                : m,
            ),
          )
        }
        setIsLoading(false)
      } finally {
        abortControllerRef.current = null
        setToolThinking(false)
        setTimeout(() => textareaRef.current?.focus(), 100)
      }
    },
    [isLoading, messages, context],
  )

  // ── Retry last failed message ──
  const retryLastMessage = useCallback(() => {
    if (isRetrying) return
    // Find the last user message
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === 'user')
    if (lastUserIdx === -1) return

    const lastUserMsg = messages[messages.length - 1 - lastUserIdx]
    // Remove the error message and re-send
    setMessages((prev) => {
      // Remove trailing assistant error messages
      const cleaned = [...prev]
      while (cleaned.length > 0 && cleaned[cleaned.length - 1].role === 'assistant' && cleaned[cleaned.length - 1].errorDetail) {
        cleaned.pop()
      }
      // Also remove empty streaming messages
      while (cleaned.length > 0 && cleaned[cleaned.length - 1].role === 'assistant' && !cleaned[cleaned.length - 1].content) {
        cleaned.pop()
      }
      return cleaned
    })
    setIsRetrying(true)
    // Small delay to let state settle, then send
    setTimeout(() => {
      setIsRetrying(false)
      // We need to send with the cleaned message list — the sendMessage callback
      // reads from `messages` state, so we trigger a re-send by reconstructing
      const retryInput = lastUserMsg.content
      setInput(retryInput)
      // Clear input after use
      setTimeout(() => setInput(''), 50)
    }, 100)
  }, [isRetrying, messages])

  // ── Cancel in-progress request ──
  const cancelRequest = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

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

  // Check if last message has an error (for retry button visibility)
  const lastMsg = messages[messages.length - 1]
  const hasError = lastMsg?.role === 'assistant' && lastMsg?.errorDetail
  const hasContent = messages.some((m) => m.role === 'assistant' && m.content && !m.errorDetail)

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
              background: tokens.opacity.white.strong,
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
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground leading-tight">AI Assistant</h2>
                    {/* Provider status indicator */}
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{
                        background: providerStatus?.available
                          ? 'color-mix(in oklch, #22c55e 12%, transparent)'
                          : 'color-mix(in oklch, #ef4444 12%, transparent)',
                        color: providerStatus?.available ? '#16a34a' : '#dc2626',
                      }}
                    >
                      {providerStatus?.available ? (
                        <>
                          <Wifi className="size-2.5" />
                          {providerStatus?.providerName || 'AI Active'}
                        </>
                      ) : (
                        <>
                          <WifiOff className="size-2.5" />
                          No Provider
                        </>
                      )}
                    </span>
                  </div>
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

            {/* ── Provider Warning Banner ── */}
            {providerStatus && !providerStatus.available && !hasContent && (
              <div
                className="px-4 py-2.5 border-b flex items-start gap-2 shrink-0"
                style={{ background: 'color-mix(in oklch, #f59e0b 8%, transparent)', borderColor: 'color-mix(in oklch, #f59e0b 15%, transparent)' }}
              >
                <AlertTriangle className="size-4 shrink-0 mt-0.5" style={{ color: '#d97706' }} />
                <div className="text-xs leading-relaxed" style={{ color: '#92400e' }}>
                  <span className="font-semibold">No AI provider configured.</span>{' '}
                  I&apos;ll use guided help responses. For intelligent answers, add an API key in{' '}
                  <span className="font-semibold">Settings → AI Providers</span>.
                </div>
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
                          e.currentTarget.style.background = 'color-mix(in oklch, var(--color-gold) 6%, transparent)'
                          e.currentTarget.style.borderColor = 'color-mix(in oklch, var(--color-gold) 20%, transparent)'
                          e.currentTarget.style.color = 'var(--color-foreground)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.borderColor = 'var(--border-subtle)'
                          e.currentTarget.style.color = 'var(--color-muted-foreground)'
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
                        : { background: tokens.neutral['50'], border: `1px solid ${tokens.neutral['200']}`, color: 'var(--color-foreground)' }
                    }
                  >
                    {/* Error state */}
                    {msg.errorDetail ? (
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="size-4 shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium" style={{ color: '#dc2626' }}>
                            AI is unavailable
                          </p>
                          <p className="text-[11px] mt-0.5 opacity-70" style={{ color: 'var(--text-dim)' }}>
                            {msg.errorDetail.length > 150
                              ? msg.errorDetail.slice(0, 150) + '...'
                              : msg.errorDetail}
                          </p>
                          {hasError && msg === lastMsg && (
                            <button
                              onClick={retryLastMessage}
                              disabled={isRetrying}
                              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md transition-colors"
                              style={{
                                background: 'color-mix(in oklch, var(--color-gold) 12%, transparent)',
                                color: 'var(--color-gold-dim)',
                              }}
                            >
                              <RefreshCw className={cn('size-3', isRetrying && 'animate-spin')} />
                              {isRetrying ? 'Retrying...' : 'Retry'}
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Tool-use thinking indicator or normal content */
                      msg.toolStatus && (msg.isStreaming || !msg.content) ? (
                        <div className="flex items-center gap-2 py-1">
                          <Database className="size-3.5 animate-pulse shrink-0" style={{ color: 'var(--color-gold)' }} />
                          <span className="text-xs" style={{ color: 'var(--color-gold-dim)' }}>{msg.toolStatus}</span>
                          <Loader2 className="size-3 animate-spin shrink-0" style={{ color: 'var(--text-dim)' }} />
                        </div>
                      ) : (
                        /* Normal or streaming content */
                        <div className="whitespace-pre-wrap break-words [&>strong]:font-semibold [&_strong]:font-semibold">
                          {renderMarkdown(msg.content)}
                          {/* Streaming cursor */}
                          {msg.isStreaming && (
                            <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse rounded-sm" style={{ background: 'var(--color-gold)' }} />
                          )}
                        </div>
                      )
                    )}
                    <div
                      className={cn(
                        'text-[11px] mt-1.5',
                        msg.role === 'user' ? 'text-white/60 text-right' : '',
                      )}
                      style={msg.role !== 'user' ? { color: 'var(--text-dim)' } : undefined}
                    >
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading indicator (only when no streaming message is active) */}
              {isLoading && !messages.some((m) => m.isStreaming) && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md px-4 py-3" style={{ background: tokens.neutral['50'], border: `1px solid ${tokens.neutral['200']}` }}>
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
                  background: tokens.neutral['100'],
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  aria-label="Ask about any company, contact, or deal"
                  placeholder="Ask about any company, contact, or deal..."
                  disabled={isLoading}
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground resize-none outline-none min-h-[20px] max-h-[96px] py-0.5 disabled:opacity-50"
                />
                {/* Cancel button while streaming */}
                {isLoading ? (
                  <button
                    onClick={cancelRequest}
                    className="p-1.5 rounded-xl transition-all shrink-0 text-white shadow-sm hover:shadow-md active:scale-95"
                    style={{ background: '#ef4444' }}
                    aria-label="Stop generating"
                  >
                    <X className="size-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim()}
                    className={cn(
                      'p-1.5 rounded-xl transition-all shrink-0',
                      input.trim()
                        ? 'text-white shadow-sm hover:shadow-md active:scale-95'
                        : 'cursor-not-allowed',
                    )}
                    style={
                      input.trim()
                        ? { background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-dim))' }
                        : { background: tokens.neutral['200'], color: 'var(--text-dim)' }
                    }
                    aria-label="Send message"
                  >
                    <Send className="size-4" />
                  </button>
                )}
              </div>
              <p className="text-[11px] mt-1.5 text-center" style={{ color: 'var(--text-dim)' }}>
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
