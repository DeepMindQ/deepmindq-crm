'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

interface InlineFeedbackProps {
  context: string;
  itemId: string;
  itemType?: 'recommendation' | 'intelligence' | 'signal' | 'insight';
  orientation?: 'horizontal' | 'vertical';
  onFeedback?: (data: {
    sentiment: 'positive' | 'negative';
    comment?: string;
    context: string;
    itemId: string;
  }) => void;
}

export function InlineFeedback({
  context,
  itemId,
  itemType = 'recommendation',
  orientation = 'horizontal',
  onFeedback,
}: InlineFeedbackProps) {
  const [sentiment, setSentiment] = useState<'positive' | 'negative' | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');

  const handleFeedback = async (s: 'positive' | 'negative') => {
    setSentiment(s);
    if (onFeedback) {
      onFeedback({
        sentiment: s,
        comment: showComment ? comment : undefined,
        context,
        itemId,
      });
    }
    // Best-effort API call
    fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sentiment: s,
        context,
        itemId,
        itemType,
        comment: showComment ? comment : undefined,
        timestamp: new Date(),
      }),
    }).catch(() => {});
    toast.success(
      s === 'positive' ? 'Thanks for the positive feedback!' : "We'll work on improving this",
    );
  };

  return (
    <div className={cn('flex items-center gap-1', orientation === 'vertical' && 'flex-col')}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => handleFeedback('positive')}
            className={cn(
              'p-1.5 rounded-md transition-all',
              sentiment === 'positive'
                ? 'text-green-400 bg-green-400/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
            aria-label="Helpful"
            disabled={sentiment !== null}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Helpful</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => handleFeedback('negative')}
            className={cn(
              'p-1.5 rounded-md transition-all',
              sentiment === 'negative'
                ? 'text-red-400 bg-red-400/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
            aria-label="Not helpful"
            disabled={sentiment !== null}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Not helpful</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setShowComment(!showComment)}
            className={cn(
              'p-1.5 rounded-md transition-all',
              showComment
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
            aria-label="Add comment"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Add comment</TooltipContent>
      </Tooltip>

      {showComment && (
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment..."
          rows={2}
          className={cn(
            'mt-1 w-full text-xs bg-muted/50 border border-border rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50',
            orientation === 'vertical' ? 'w-full' : 'min-w-[200px]',
          )}
          aria-label="Feedback comment"
        />
      )}
    </div>
  );
}
