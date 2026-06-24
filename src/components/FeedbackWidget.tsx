import { useMemo, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type FeedbackType = 'bug' | 'feature' | 'general';

interface FeedbackWidgetProps {
  pagePath: string;
}

export function FeedbackWidget({ pagePath }: FeedbackWidgetProps) {
  const { orgId, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const stars = useMemo(() => [1, 2, 3, 4, 5], []);

  const resetForm = () => {
    setFeedbackType('bug');
    setMessage('');
    setRating(null);
  };

  const handleSubmit = async () => {
    if (!supabase || !orgId || !user?.id) {
      toast.error('Unable to submit feedback right now.');
      return;
    }
    if (!message.trim()) {
      toast.error('Please enter feedback before submitting.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('beta_feedback').insert({
      org_id: orgId,
      user_id: user.id,
      page: pagePath,
      feedback_type: feedbackType,
      message: message.trim(),
      rating,
    });
    setSubmitting(false);
    if (error) {
      toast.error(`Failed to submit feedback: ${error.message}`);
      return;
    }
    toast.success('Thanks for your feedback!');
    resetForm();
    setOpen(false);
  };

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex items-end justify-end">
      <div
        className={`w-[300px] rounded-xl border border-surface-border bg-surface-card p-3 shadow-xl transition-all duration-200 ${
          open ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
        }`}
      >
        <h3 className="mb-2 text-sm font-semibold text-text-primary">Share Feedback</h3>
        <div className="mb-2 grid gap-1 text-xs text-text-secondary">
          <label className="flex items-center gap-2">
            <input type="radio" name="feedback-type" checked={feedbackType === 'bug'} onChange={() => setFeedbackType('bug')} />
            Bug Report
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="feedback-type" checked={feedbackType === 'feature'} onChange={() => setFeedbackType('feature')} />
            Feature Request
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="feedback-type" checked={feedbackType === 'general'} onChange={() => setFeedbackType('general')} />
            General Feedback
          </label>
        </div>
        <textarea
          className="mb-2 h-24 w-full rounded-md border border-surface-border bg-surface-base p-2 text-sm text-text-primary placeholder:text-text-muted"
          placeholder="Tell us what you noticed..."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <div className="mb-3 flex items-center gap-1">
          {stars.map((value) => (
            <button
              key={`feedback-star-${value}`}
              type="button"
              onClick={() => setRating(value)}
              className="text-lg leading-none"
              aria-label={`Rate ${value} star${value > 1 ? 's' : ''}`}
            >
              <span className={value <= (rating ?? 0) ? 'text-amber-500' : 'text-text-muted'}>★</span>
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              resetForm();
            }}
            className="rounded-md border border-surface-border px-3 py-1.5 text-xs text-text-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            className="rounded-md bg-brand-dim px-3 py-1.5 text-xs text-text-primary"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="pointer-events-auto ml-2 rounded-full bg-brand-dim p-3 text-text-primary shadow-lg hover:bg-brand-dim/90"
        aria-label="Open feedback form"
      >
        <MessageCircle className="h-5 w-5" />
      </button>
    </div>
  );
}
