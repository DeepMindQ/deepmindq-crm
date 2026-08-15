'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { tokens, elevation } from '@/components/intelligence-os/design-tokens';
import { Bot, Send, Trash2, Sparkles, User, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { fetchApi } from '@/lib/fetchApi';
import { toast } from 'sonner';

// ── Types ──
interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

// ── AI Response Fetcher ──
async function fetchAiResponse(userMessage: string): Promise<string | null> {
  const { data, error } = await fetchApi<{ response?: string; message?: string }>(
    '/api/advisor/chat',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage }),
    },
  );
  if (error) {
    toast.error('AI Advisor error', { description: error });
    return null;
  }
  return data?.response ?? data?.message ?? null;
}

// ── Suggested Prompts ──
const SUGGESTED_PROMPTS = [
  'Which accounts should I prioritize?',
  'Summarize recent signals',
  "What's my pipeline health?",
  'Show me competitor activity',
  'Refine my ideal customer profile',
];

// ── Component ──
export default function AiAdvisor() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const simulateStreaming = useCallback((responseText: string, messageId: string) => {
    const words = responseText.split(' ');
    let currentIndex = 0;
    const chunkSize = 3; // words per tick

    const interval = setInterval(() => {
      currentIndex += chunkSize;
      if (currentIndex >= words.length) {
        currentIndex = words.length;
        clearInterval(interval);
        setIsStreaming(false);
      }

      const partial = words.slice(0, currentIndex).join(' ');
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content: partial, isStreaming: currentIndex < words.length }
            : m,
        ),
      );
    }, 40);

    return () => clearInterval(interval);
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    const aiMsgId = `ai-${Date.now()}`;
    const aiMsg: ChatMessage = {
      id: aiMsgId,
      role: 'ai',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInput('');
    setIsStreaming(true);

    // Fetch AI response from API
    const responseText = await fetchAiResponse(trimmed);
    if (responseText) {
      simulateStreaming(responseText, aiMsgId);
    } else {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                content: 'Sorry, I could not generate a response. Please try again.',
                isStreaming: false,
              }
            : m,
        ),
      );
      setIsStreaming(false);
    }
  }, [input, isStreaming, simulateStreaming]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleSuggestedPrompt = useCallback(
    (prompt: string) => {
      setInput(prompt);
      // Auto-send after a short delay
      setTimeout(async () => {
        const userMsg: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content: prompt,
          timestamp: new Date(),
        };

        const aiMsgId = `ai-${Date.now()}`;
        const aiMsg: ChatMessage = {
          id: aiMsgId,
          role: 'ai',
          content: '',
          timestamp: new Date(),
          isStreaming: true,
        };

        setMessages((prev) => [...prev, userMsg, aiMsg]);
        setIsStreaming(true);
        setInput('');

        const responseText = await fetchAiResponse(prompt);
        if (responseText) {
          simulateStreaming(responseText, aiMsgId);
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? {
                    ...m,
                    content: 'Sorry, I could not generate a response. Please try again.',
                    isStreaming: false,
                  }
                : m,
            ),
          );
          setIsStreaming(false);
        }
      }, 100);
    },
    [simulateStreaming],
  );

  const handleClear = useCallback(() => {
    setMessages([]);
  }, []);

  // Simple markdown-like rendering
  const renderContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      // Bold
      const boldParts = line.split(/\*\*(.*?)\*\*/g);
      const rendered = boldParts.map((part, j) => {
        if (j % 2 === 1) {
          return (
            <strong key={j} style={{ color: tokens.text.primary, fontWeight: 600 }}>
              {part}
            </strong>
          );
        }
        // Italic
        const italicParts = part.split(/\*(.*?)\*/g);
        return italicParts.map((ip, k) => {
          if (k % 2 === 1) {
            return <em key={`${j}-${k}`}>{ip}</em>;
          }
          return <span key={`${j}-${k}`}>{ip}</span>;
        });
      });

      // Headers / bullets
      if (line.startsWith('##')) {
        return (
          <p key={i} className="font-semibold mt-3 mb-1" style={{ color: tokens.text.primary }}>
            {rendered}
          </p>
        );
      }
      if (line.startsWith('|')) {
        // Skip table dividers
        if (line.includes('---')) return null;
        return (
          <p key={i} className="font-mono text-xs" style={{ color: tokens.text.secondary }}>
            {rendered}
          </p>
        );
      }
      if (line.startsWith('•') || line.startsWith('- ')) {
        return (
          <p key={i} className="flex gap-2 ml-1" style={{ color: tokens.text.primary }}>
            <span style={{ color: tokens.accent.dim }}>•</span>
            <span>{rendered}</span>
          </p>
        );
      }
      if (line.trim() === '') {
        return <div key={i} className="h-2" />;
      }
      return (
        <p key={i} style={{ color: tokens.text.primary }}>
          {rendered}
        </p>
      );
    });
  };

  return (
    <div className="flex flex-col h-full" style={{ background: tokens.surface.secondary }}>
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{
          background: tokens.surface.card,
          borderBottom: `1px solid ${tokens.border.default}`,
        }}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2" style={{ background: tokens.accent.ghost }}>
            <Bot className="h-5 w-5" style={{ color: tokens.accent.primary }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: tokens.text.primary }}>
              AI Advisor
            </h1>
            <p className="text-xs" style={{ color: tokens.text.secondary }}>
              Powered by DeepMindQ Intelligence Engine
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-xs gap-1.5"
            style={{ color: tokens.text.muted }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Chat
          </Button>
        )}
      </div>

      {/* ── Messages Area ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div
              className="rounded-2xl p-6"
              style={{
                background: tokens.surface.card,
                border: `1px solid ${tokens.border.default}`,
                boxShadow: elevation.md,
              }}
            >
              <Sparkles className="h-10 w-10 mx-auto mb-3" style={{ color: tokens.accent.dim }} />
              <h2
                className="text-lg font-semibold text-center"
                style={{ color: tokens.text.primary }}
              >
                How can I help you today?
              </h2>
              <p
                className="text-sm text-center mt-1 max-w-sm"
                style={{ color: tokens.text.secondary }}
              >
                Ask me about your accounts, signals, pipeline, competitors, or any intelligence
                question.
              </p>
            </div>

            {/* Suggested Prompts */}
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSuggestedPrompt(prompt)}
                  className="px-4 py-2 rounded-xl text-xs font-medium transition-all hover:scale-[1.02]"
                  style={{
                    background: tokens.surface.card,
                    color: tokens.text.secondary,
                    border: `1px solid ${tokens.border.default}`,
                    boxShadow: elevation.sm,
                  }}
                >
                  <MessageSquare
                    className="h-3.5 w-3.5 inline mr-1.5"
                    style={{ color: tokens.accent.dim }}
                  />
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                {msg.role === 'ai' && (
                  <div
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-1"
                    style={{ background: tokens.accent.ghost }}
                  >
                    <Bot className="h-4 w-4" style={{ color: tokens.accent.primary }} />
                  </div>
                )}
                <div
                  className="max-w-[80%] rounded-2xl px-4 py-3"
                  style={{
                    background: msg.role === 'user' ? tokens.accent.primary : tokens.surface.card,
                    color: msg.role === 'user' ? tokens.flat.white : tokens.text.primary,
                    border: msg.role === 'ai' ? `1px solid ${tokens.border.default}` : 'none',
                    boxShadow: msg.role === 'ai' ? elevation.sm : 'none',
                  }}
                >
                  {msg.role === 'user' ? (
                    <p className="text-sm">{msg.content}</p>
                  ) : (
                    <div className="text-sm leading-relaxed">
                      {msg.content ? (
                        renderContent(msg.content)
                      ) : (
                        <div className="flex items-center gap-2">
                          <Loader2
                            className="h-4 w-4 animate-spin"
                            style={{ color: tokens.accent.dim }}
                          />
                          <span style={{ color: tokens.text.muted }}>Thinking...</span>
                        </div>
                      )}
                      {msg.isStreaming && (
                        <span
                          className="inline-block w-0.5 h-4 ml-0.5 animate-pulse"
                          style={{ background: tokens.accent.dim, verticalAlign: 'text-bottom' }}
                        />
                      )}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-1"
                    style={{ background: tokens.neutral['100'] }}
                  >
                    <User className="h-4 w-4" style={{ color: tokens.text.secondary }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Input Area ── */}
      <div
        className="shrink-0 px-6 py-4"
        style={{
          background: tokens.surface.card,
          borderTop: `1px solid ${tokens.border.default}`,
        }}
      >
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 mb-3 max-w-3xl mx-auto">
            {SUGGESTED_PROMPTS.slice(0, 3).map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSuggestedPrompt(prompt)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: tokens.surface.secondary,
                  color: tokens.text.secondary,
                  border: `1px solid ${tokens.border.default}`,
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
        <div className="max-w-3xl mx-auto">
          <div
            className="flex items-end gap-3 rounded-2xl p-2"
            style={{
              background: tokens.surface.secondary,
              border: `1px solid ${tokens.border.default}`,
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your intelligence..."
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm px-3 py-2 outline-none min-h-[40px] max-h-[120px]"
              style={{ color: tokens.text.primary }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="shrink-0 rounded-xl h-10 w-10 p-0 flex items-center justify-center"
              style={{
                background:
                  input.trim() && !isStreaming ? tokens.accent.primary : tokens.border.default,
                color: tokens.flat.white,
              }}
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] mt-2 text-center" style={{ color: tokens.text.muted }}>
            AI Advisor uses your intelligence data to provide contextual insights. Press Enter to
            send, Shift+Enter for new line.
          </p>
        </div>
      </div>
    </div>
  );
}
