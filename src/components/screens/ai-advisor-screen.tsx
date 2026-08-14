'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { tokens, elevation } from '@/components/intelligence-os/design-tokens';
import { Bot, Send, Trash2, Sparkles, User, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// ── Types ──
interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

// ── Mock AI Responses ──
function getMockResponse(userMessage: string): string {
  const msg = userMessage.toLowerCase();

  if (msg.includes('prioritize') || msg.includes('account') || msg.includes('focus')) {
    return `Based on your current intelligence data, here are the top 3 accounts you should prioritize:

**1. Acme Corp** (Confidence: 92%)
Recent expansion signals indicate urgent buying intent. They've posted 3 new APAC roles in 48 hours and their VP of Sales has been actively engaging partners. *Recommended action: Reach out within 24 hours.*

**2. GlobalFin** (Confidence: 85%)
Active RFP for AI fraud detection with $2.5M budget approved. Their current solution has a 23% false positive increase. *Recommended action: Submit RFP response by end of week.*

**3. AutoDrive AI** (Confidence: 91%)
New $50M OEM partnership creates immediate scaling needs. *Recommended action: Fast-track engagement with VP of Engineering.*

These are ranked by a composite score of signal recency, budget signals, and organizational readiness. Would you like me to draft outreach for any of these?`;
  }

  if (msg.includes('summarize') || msg.includes('signal') || msg.includes('recent')) {
    return `Here's a summary of recent signals across your intelligence landscape:

📊 **Signal Overview (Last 7 Days)**
- **142 signals** detected across 38 tracked accounts
- **23 high-priority** signals require immediate attention
- **4 new opportunities** identified with >80% confidence
- **2 risk alerts** issued for portfolio companies

**Top Signal Categories:**
1. Hiring activity (34%) — Strong predictor of growth
2. Technology adoption (28%) — Infrastructure changes
3. Leadership changes (18%) — Decision-maker shifts
4. Financial signals (12%) — Budget and funding
5. Partnership/M&A (8%) — Strategic moves

⚠️ **Notable Trend:** A 340% increase in RAG capability requests from enterprise buyers has been detected. This may warrant a strategic response.

Would you like me to dive deeper into any specific signal category or account?`;
  }

  if (msg.includes('pipeline') || msg.includes('health') || msg.includes('deal')) {
    return `Here's your pipeline health assessment:

**Overall Pipeline Score: 72/100** (Moderate)

📈 **Strengths:**
- 12 active opportunities totaling $4.2M in pipeline value
- Average deal size increased 18% from last quarter
- 3 deals in final negotiation stage

📉 **Concerns:**
- Average sales cycle has extended from 42 to 58 days
- 2 deals stalled in technical evaluation for >30 days
- Win rate dropped from 34% to 28% this quarter

**By Stage:**
| Stage | Deals | Value | Avg Days |
|-------|-------|-------|----------|
| Discovery | 4 | $890K | 12 |
| Evaluation | 3 | $1.2M | 34 |
| Proposal | 3 | $1.1M | 48 |
| Negotiation | 2 | $1.01M | 58 |

**Recommendation:** Focus on accelerating the 2 stalled evaluation deals. Consider offering a proof-of-concept to unblock technical concerns.

Want me to create action plans for the stalled deals?`;
  }

  if (msg.includes('competitor') || msg.includes('competition')) {
    return `Based on intelligence gathered, here's your competitive landscape:

**Key Competitor Movements (Last 30 Days):**

1. **Competitor A** launched a RAG-focused feature suite targeting enterprise buyers — this directly responds to the market demand shift we detected earlier.

2. **Competitor B** hired 5 enterprise sales reps in your top 3 target verticals, signaling aggressive expansion.

3. **Competitor C** dropped pricing by 20% for mid-market deals — potential race-to-bottom signal.

**Your Positioning Advantage:**
- Higher NPS scores (72 vs industry avg of 58)
- Faster implementation times (2 weeks vs 6 weeks avg)
- Superior data privacy compliance (SOC2 + HIPAA certified)

**Suggested Response:**
- Emphasize implementation speed in competitive situations
- Develop RAG comparison materials
- Create competitive battle cards for the sales team`;
  }

  if (msg.includes('icp') || msg.includes('ideal customer') || msg.includes('profile')) {
    return `Based on analysis of your 47 closed-won deals and 156 active prospects, here's your refined ICP:

**Ideal Customer Profile v2.1:**

🏢 **Company:**
- 200-5,000 employees
- $50M-$2B annual revenue
- Technology, Financial Services, or Healthcare verticals
- US-based with international operations

👤 **Decision Maker:**
- VP-level or above (CTO, VP Engineering, VP Data)
- 10+ years experience
- Previously bought similar solutions

🎯 **Trigger Events:**
- Recent funding round (Series C+)
- New executive hire in tech leadership
- Public compliance mandate
- M&A activity

Your best-performing deals close 3x faster when 2+ trigger events are present. I recommend updating your scoring model to weight these triggers more heavily.`;
  }

  // Default response
  return `That's a great question. Let me analyze the available intelligence to provide you with a comprehensive answer.

Based on the current data in your DeepMindQ system:

• **Total tracked accounts:** 247 organizations with active intelligence monitoring
• **Signals processed today:** 18 new signals across 12 accounts
• **Insights generated:** 4 new actionable insights in the last 24 hours

I can help you with:
- **Account prioritization** — Which accounts to focus on
- **Signal analysis** — Deep-dive into specific signals
- **Pipeline coaching** — Deal strategy and next steps
- **Competitive intelligence** — Competitor movements and positioning
- **ICP refinement** — Optimize your ideal customer profile

Could you be more specific about what you'd like to explore? I can provide much more targeted insights when you ask about specific accounts, signals, or strategies.`;
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

  const handleSend = useCallback(() => {
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

    // Simulate network delay
    setTimeout(() => {
      const response = getMockResponse(trimmed);
      simulateStreaming(response, aiMsgId);
    }, 600);
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
      setTimeout(() => {
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

        setTimeout(() => {
          const response = getMockResponse(prompt);
          simulateStreaming(response, aiMsgId);
        }, 600);
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
