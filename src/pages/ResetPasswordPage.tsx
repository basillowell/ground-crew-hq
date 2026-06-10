import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hasSupabaseConfig, supabase, supabaseConfigError } from '@/lib/supabase';

type ResetState = 'waiting' | 'ready' | 'success' | 'error';

export default function ResetPasswordPage() {
  const navigate = useNavigate();

  const [resetState, setResetState] = useState<ResetState>('waiting');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Listen for Supabase PASSWORD_RECOVERY event fired when the
  // recovery token in the URL hash is consumed by the JS client.
  useEffect(() => {
    if (!supabase) {
      setErrorMessage(supabaseConfigError || 'Supabase is not configured.');
      setResetState('error');
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setResetState('ready');
      }
    });

    // If the user already has a recovery session (e.g. page refresh), move to ready.
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setResetState('ready');
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) { setErrorMessage(supabaseConfigError || 'Supabase is not configured.'); return; }
    if (newPassword !== confirmPassword) { setErrorMessage('Passwords do not match.'); return; }
    if (newPassword.length < 8) { setErrorMessage('Password must be at least 8 characters.'); return; }

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) { setErrorMessage(error.message); return; }
      setResetState('success');
    } catch {
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-base px-4 py-12">
      {/* Brand mark */}
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 ring-1 ring-brand/30">
            <ShieldCheck className="h-6 w-6 text-brand-bright" />
          </div>
          <div className="mt-3 text-base font-semibold tracking-tight text-text-primary">Ground Crew HQ</div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Secure account recovery</div>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface-card p-6 shadow-2xl backdrop-blur-xl">

          {/* Waiting: token not yet processed */}
          {resetState === 'waiting' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-brand-bright" />
              <p className="text-sm text-text-secondary">Verifying your reset link…</p>
            </div>
          )}

          {/* Error: misconfigured or expired link */}
          {resetState === 'error' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-xs text-red-400">
                {errorMessage || 'This reset link is invalid or has expired. Please request a new one.'}
              </div>
              <button
                type="button"
                className="w-full rounded-full border border-surface-border py-2.5 text-sm text-text-secondary transition-all duration-200 hover:bg-surface-hover hover:text-text-primary"
                onClick={() => navigate('/')}
              >
                Back to sign in
              </button>
            </div>
          )}

          {/* Ready: show password form */}
          {resetState === 'ready' && (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <h2 className="text-base font-semibold text-text-primary">Set a new password</h2>
                <p className="mt-1 text-xs text-text-muted">Must be at least 8 characters.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm text-text-secondary">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  className="border-surface-border bg-surface-base text-text-primary placeholder:text-text-muted focus-visible:border-brand/50 focus-visible:ring-brand/30"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm text-text-secondary">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  className="border-surface-border bg-surface-base text-text-primary placeholder:text-text-muted focus-visible:border-brand/50 focus-visible:ring-brand/30"
                />
              </div>

              {errorMessage ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-xs text-red-400">
                  {errorMessage}
                </div>
              ) : null}

              <Button
                type="submit"
                className="w-full gap-2 rounded-full bg-brand-bright font-semibold text-text-inverse transition-all duration-200 hover:brightness-110 disabled:opacity-50"
                disabled={isSubmitting || !newPassword || !confirmPassword || !hasSupabaseConfig}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? 'Updating password…' : 'Update password'}
              </Button>
            </form>
          )}

          {/* Success */}
          {resetState === 'success' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-xl border border-brand/30 bg-brand/10 px-3 py-3 text-xs text-brand-bright">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-bright" />
                Password updated successfully. You can now sign in with your new password.
              </div>
              <button
                type="button"
                className="w-full rounded-full bg-brand-bright py-2.5 text-sm font-semibold text-text-inverse transition-all duration-200 hover:brightness-110"
                onClick={() => navigate('/')}
              >
                Go to sign in
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-text-muted">
          © 2026 Ground Crew HQ
        </p>
      </div>
    </div>
  );
}
