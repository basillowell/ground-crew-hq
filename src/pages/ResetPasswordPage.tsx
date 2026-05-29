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
    <div className="flex min-h-screen items-center justify-center bg-[#0f1a14] px-4 py-12">
      {/* Brand mark */}
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-400/10 ring-1 ring-lime-400/30">
            <ShieldCheck className="h-6 w-6 text-lime-400" />
          </div>
          <div className="mt-3 text-base font-semibold tracking-tight text-slate-100">Ground Crew HQ</div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Secure account recovery</div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#1a2d1f] p-6 shadow-2xl backdrop-blur-xl">

          {/* Waiting: token not yet processed */}
          {resetState === 'waiting' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-lime-400" />
              <p className="text-sm text-slate-400">Verifying your reset link…</p>
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
                className="w-full rounded-full border border-white/10 py-2.5 text-sm text-slate-300 transition-all duration-200 hover:bg-white/5 hover:text-slate-100"
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
                <h2 className="text-base font-semibold text-slate-100">Set a new password</h2>
                <p className="mt-1 text-xs text-slate-500">Must be at least 8 characters.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm text-slate-300">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  className="border-white/[0.10] bg-[#0f1a14] text-slate-100 placeholder:text-slate-500 focus-visible:border-lime-400/50 focus-visible:ring-lime-400/30"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm text-slate-300">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  className="border-white/[0.10] bg-[#0f1a14] text-slate-100 placeholder:text-slate-500 focus-visible:border-lime-400/50 focus-visible:ring-lime-400/30"
                />
              </div>

              {errorMessage ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-xs text-red-400">
                  {errorMessage}
                </div>
              ) : null}

              <Button
                type="submit"
                className="w-full gap-2 rounded-full bg-lime-400 font-semibold text-black transition-all duration-200 hover:brightness-110 hover:shadow-[0_0_16px_rgba(163,230,53,0.3)] disabled:opacity-50"
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
              <div className="flex items-start gap-2 rounded-xl border border-lime-400/30 bg-lime-400/10 px-3 py-3 text-xs text-lime-300">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-400" />
                Password updated successfully. You can now sign in with your new password.
              </div>
              <button
                type="button"
                className="w-full rounded-full bg-lime-400 py-2.5 text-sm font-semibold text-black transition-all duration-200 hover:brightness-110 hover:shadow-[0_0_16px_rgba(163,230,53,0.3)]"
                onClick={() => navigate('/')}
              >
                Go to sign in
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          © 2026 Ground Crew HQ
        </p>
      </div>
    </div>
  );
}
