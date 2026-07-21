'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, Send } from 'lucide-react';

const DECISIONS = [
  { value: 'confirmed_accurate', label: 'Confirmed Accurate', icon: CheckCircle2, color: 'text-emerald-600 hover:bg-emerald-50 border-emerald-200' },
  { value: 'partially_accurate', label: 'Partially Accurate', icon: AlertTriangle, color: 'text-amber-600 hover:bg-amber-50 border-amber-200' },
  { value: 'incorrect', label: 'Incorrect', icon: XCircle, color: 'text-red-600 hover:bg-red-50 border-red-200' },
  { value: 'needs_more_evidence', label: 'Needs More Evidence', icon: HelpCircle, color: 'text-blue-600 hover:bg-blue-50 border-blue-200' },
] as const;

interface RecommendationFeedbackFormProps {
  recommendationId: string;
  companyId: string;
  onSubmitted?: () => void;
}

export function RecommendationFeedbackForm({ recommendationId, companyId, onSubmitted }: RecommendationFeedbackFormProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!selected) return;
    setSubmitting(true);
    try {
      await fetch(`/api/g-intelligence/companies/${companyId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendationId,
          userDecision: selected,
          feedbackReason: reason || undefined,
        }),
      });
      setSubmitted(true);
      onSubmitted?.();
    } catch (err) {
      console.error('Feedback submission failed:', err);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
        <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
        <p className="text-sm font-medium text-emerald-800">Feedback recorded. This improves future recommendations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">How accurate is this recommendation?</p>
      <div className="grid grid-cols-2 gap-2">
        {DECISIONS.map(d => (
          <button
            key={d.value}
            onClick={() => setSelected(d.value)}
            className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${
              selected === d.value ? d.color + ' ring-2 ring-offset-1' : 'border-border hover:bg-muted'
            }`}
          >
            <d.icon className="h-4 w-4 shrink-0" />
            {d.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="feedback-reason" className="text-xs">Additional context (optional)</Label>
        <Textarea
          id="feedback-reason"
          placeholder="What could be improved?"
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={2}
          className="text-sm"
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={!selected || submitting}
        className="w-full"
      >
        <Send className="h-4 w-4 mr-2" />
        {submitting ? 'Submitting...' : 'Submit Feedback'}
      </Button>
    </div>
  );
}