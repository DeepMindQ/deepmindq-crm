'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Star, ThumbsUp, ThumbsDown, MessageSquare, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type FeedbackType = 'rating' | 'thumbs' | 'detailed'
type FeedbackCategory = 'general' | 'bug' | 'feature' | 'intelligence_quality' | 'ui_ux' | 'performance'

interface FeedbackFormProps {
  trigger?: React.ReactNode
  title?: string
  description?: string
  type?: FeedbackType
  context?: string
  onSubmit?: (data: FeedbackData) => Promise<void> | void
}

interface FeedbackData {
  rating?: number
  sentiment?: 'positive' | 'negative' | 'neutral'
  category: FeedbackCategory
  comment: string
  context: string
  timestamp: Date
}

const categories: { value: FeedbackCategory; label: string; emoji: string }[] = [
  { value: 'general', label: 'General', emoji: '💬' },
  { value: 'bug', label: 'Bug Report', emoji: '🐛' },
  { value: 'feature', label: 'Feature Request', emoji: '✨' },
  { value: 'intelligence_quality', label: 'AI Quality', emoji: '🧠' },
  { value: 'ui_ux', label: 'UI/UX', emoji: '🎨' },
  { value: 'performance', label: 'Performance', emoji: '⚡' },
]

export function FeedbackForm({
  trigger,
  title = 'Share Feedback',
  description = 'Help us improve DeepMindQ',
  type = 'thumbs',
  context = 'unknown',
  onSubmit,
}: FeedbackFormProps) {
  const [open, setOpen] = useState(false)
  const [sentiment, setSentiment] = useState<'positive' | 'negative' | null>(null)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [category, setCategory] = useState<FeedbackCategory>('general')
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (type === 'thumbs' && !sentiment) return
    if (type === 'rating' && rating === 0) return

    setIsSubmitting(true)
    const data: FeedbackData = {
      rating: type === 'rating' ? rating : undefined,
      sentiment:
        type === 'thumbs'
          ? sentiment || 'neutral'
          : rating >= 4
            ? 'positive'
            : rating >= 2
              ? 'neutral'
              : 'negative',
      category,
      comment,
      context,
      timestamp: new Date(),
    }

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(() => {})

      if (onSubmit) await onSubmit(data)
      toast.success('Thank you for your feedback!')
      setOpen(false)
      resetForm()
    } catch {
      toast.error('Failed to submit feedback')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setSentiment(null)
    setRating(0)
    setHoverRating(0)
    setCategory('general')
    setComment('')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm() }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Feedback
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Sentiment / Rating */}
          {type === 'thumbs' && (
            <div
              className="flex items-center justify-center gap-4 py-4"
              role="radiogroup"
              aria-label="Sentiment"
            >
              <button
                onClick={() => setSentiment('positive')}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all',
                  sentiment === 'positive'
                    ? 'border-green-500/50 bg-green-500/10 text-green-400'
                    : 'border-border hover:border-border-hover'
                )}
                role="radio"
                aria-checked={sentiment === 'positive'}
                aria-label="Positive"
              >
                <ThumbsUp className="h-5 w-5" />
                <span className="text-sm font-medium">Positive</span>
              </button>
              <button
                onClick={() => setSentiment('negative')}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all',
                  sentiment === 'negative'
                    ? 'border-red-500/50 bg-red-500/10 text-red-400'
                    : 'border-border hover:border-border-hover'
                )}
                role="radio"
                aria-checked={sentiment === 'negative'}
                aria-label="Negative"
              >
                <ThumbsDown className="h-5 w-5" />
                <span className="text-sm font-medium">Negative</span>
              </button>
            </div>
          )}

          {type === 'rating' && (
            <div
              className="flex items-center justify-center gap-1 py-4"
              role="radiogroup"
              aria-label="Rating"
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <button
                  key={i}
                  onMouseEnter={() => setHoverRating(i + 1)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(i + 1)}
                  className="p-0.5 transition-transform hover:scale-110"
                  role="radio"
                  aria-checked={rating === i + 1}
                  aria-label={`${i + 1} star${i > 0 ? 's' : ''}`}
                >
                  <Star
                    className={cn(
                      'h-7 w-7 transition-colors',
                      i < (hoverRating || rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-muted-foreground'
                    )}
                  />
                </button>
              ))}
            </div>
          )}

          {/* Category */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Category
            </label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                    category === cat.value
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-border-hover'
                  )}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label
              htmlFor="feedback-comment"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
            >
              Comment{' '}
              <span className="text-muted-foreground/50">(optional)</span>
            </label>
            <Textarea
              id="feedback-comment"
              placeholder="Tell us more about your experience..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              (type === 'thumbs' && !sentiment) ||
              (type === 'rating' && rating === 0)
            }
          >
            {isSubmitting ? (
              <>Submitting...</>
            ) : (
              <>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Submit Feedback
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
