'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { createClient } from '@/lib/supabase';

type AuthPanel = 'sign-in' | 'sign-up' | 'forgot-password';

type LaunchAuthDialogProps = {
  open: boolean;
  initialPanel: AuthPanel;
  demoLoginNonce: number;
  onOpenChange: (open: boolean) => void;
};

const supabase = createClient();
const hasSupabaseConfig = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const supabaseConfigError = hasSupabaseConfig
  ? ''
  : 'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY.';

function DarkInput(props: React.ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={`border-surface-border bg-surface-base text-text-primary placeholder:text-text-muted focus-visible:border-brand/50 focus-visible:ring-brand/30 ${props.className ?? ''}`}
    />
  );
}

function DarkLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) {
  return (
    <Label htmlFor={htmlFor} className="text-sm text-text-secondary">
      {children}
    </Label>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-status-warning/30 bg-status-warning/10 px-3 py-3 text-xs text-status-warning">
      {message}
    </div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-brand/30 bg-brand/10 px-3 py-3 text-xs text-brand-bright">
      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-bright" />
      {message}
    </div>
  );
}

function PanelLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-brand-bright underline-offset-2 hover:underline"
    >
      {children}
    </button>
  );
}

export default function LaunchAuthDialog({
  open,
  initialPanel,
  demoLoginNonce,
  onOpenChange,
}: LaunchAuthDialogProps) {
  const { currentUser, authDebugMessage, authState, hasSession, retryAuthHydration } = useOrgProfile();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAwaitingProfile, setIsAwaitingProfile] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [authPanel, setAuthPanel] = useState<AuthPanel>(initialPanel);

  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [signUpError, setSignUpError] = useState('');
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handledDemoNonceRef = useRef(0);

  const resetPanelState = () => {
    setErrorMessage('');
    setSignUpError('');
    setForgotError('');
    setSignUpSuccess(false);
    setForgotSuccess(false);
  };

  const switchPanel = (panel: AuthPanel) => {
    setAuthPanel(panel);
    resetPanelState();
  };

  const mapAuthError = (message: string) => {
    const normalized = message.toLowerCase();
    if (normalized.includes('invalid login credentials')) return 'Invalid credentials. Please check your email and password.';
    if (normalized.includes('email not confirmed')) return 'Email not confirmed. Please verify your email before signing in.';
    return message;
  };

  const signInWithCredentials = async (nextEmail: string, nextPassword: string) => {
    if (!supabase) {
      setErrorMessage(supabaseConfigError || 'Supabase is not configured for this environment.');
      return;
    }
    setIsSubmitting(true);
    setIsAwaitingProfile(false);
    setErrorMessage('');
    try {
      const result = await Promise.race([
        supabase.auth.signInWithPassword({ email: nextEmail, password: nextPassword }),
        new Promise<{ error: { message: string } }>((resolve) =>
          setTimeout(() => resolve({ error: { message: 'Sign-in timed out. Please try again.' } }), 15000),
        ),
      ]);
      if (result.error) {
        setErrorMessage(mapAuthError(result.error.message));
        setIsSubmitting(false);
        return;
      }
      setIsAwaitingProfile(true);
    } catch {
      setErrorMessage('An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await signInWithCredentials(email, password);
  };

  const handleDemoLogin = async () => {
    await signInWithCredentials('demo@groundcrewhq.com', 'GroundCrewHQDemo!2026');
  };

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) { setSignUpError(supabaseConfigError || 'Supabase is not configured.'); return; }
    if (signUpPassword !== signUpConfirmPassword) { setSignUpError('Passwords do not match.'); return; }
    if (signUpPassword.length < 8) { setSignUpError('Password must be at least 8 characters.'); return; }
    setIsSigningUp(true);
    setSignUpError('');
    try {
      const { error } = await supabase.auth.signUp({
        email: signUpEmail,
        password: signUpPassword,
        options: { data: { full_name: signUpName.trim() } },
      });
      if (error) { setSignUpError(error.message); return; }
      setSignUpSuccess(true);
    } catch {
      setSignUpError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSigningUp(false);
    }
  };

  const handleForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) { setForgotError(supabaseConfigError || 'Supabase is not configured.'); return; }
    setIsSendingReset(true);
    setForgotError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      if (error) { setForgotError(error.message); return; }
      setForgotSuccess(true);
    } catch {
      setForgotError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSendingReset(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setAuthPanel(initialPanel);
    resetPanelState();
  }, [initialPanel, open]);

  useEffect(() => {
    if (!open || demoLoginNonce === 0 || handledDemoNonceRef.current === demoLoginNonce) return;
    handledDemoNonceRef.current = demoLoginNonce;
    setAuthPanel('sign-in');
    resetPanelState();
    void handleDemoLogin();
  }, [demoLoginNonce, open]);

  useEffect(() => {
    if (!isAwaitingProfile) return;
    if (currentUser) {
      setIsAwaitingProfile(false);
      setIsSubmitting(false);
      setErrorMessage('');
      window.location.href = '/app/scheduler';
      return;
    }
    const isDoneLoading = authState === 'profile-missing' || authState === 'profile-error';
    if (isDoneLoading && !currentUser) {
      setIsAwaitingProfile(false);
      setIsSubmitting(false);
      setErrorMessage(authDebugMessage || 'Sign-in completed, but your app profile could not be loaded.');
    }
  }, [authDebugMessage, authState, currentUser, isAwaitingProfile]);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setErrorMessage(supabaseConfigError);
    }
  }, []);

  const dialogTitles: Record<AuthPanel, string> = {
    'sign-in': 'Sign in to your workspace',
    'sign-up': 'Create your account',
    'forgot-password': 'Reset your password',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby="dialog-desc"
        className="max-w-md border-surface-border bg-surface-card text-text-primary backdrop-blur-xl"
      >
        <DialogDescription id="dialog-desc" className="sr-only">
          Sign in, create a workspace account, or request a password reset for Ground Crew HQ.
        </DialogDescription>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-text-primary">
            <ShieldCheck className="h-4 w-4 text-brand-bright" />
            {dialogTitles[authPanel]}
          </DialogTitle>
        </DialogHeader>

        {authPanel === 'sign-in' && (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <DarkLabel htmlFor="email">Email</DarkLabel>
              <DarkInput
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <DarkLabel htmlFor="password">Password</DarkLabel>
                <PanelLink onClick={() => switchPanel('forgot-password')}>
                  Forgot password?
                </PanelLink>
              </div>
              <DarkInput
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>

            {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
            {!errorMessage && authDebugMessage ? (
              <div className="rounded-xl border border-status-pending/30 bg-status-pending/10 px-3 py-3 text-xs text-status-pending">
                {authDebugMessage}
                {hasSession && (authState === 'profile-error' || authState === 'profile-missing') ? (
                  <div className="mt-2">
                    <Button type="button" size="sm" variant="outline" className="border-surface-border text-text-secondary hover:bg-surface-hover hover:text-text-primary" onClick={() => void retryAuthHydration()}>
                      Retry profile load
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <Button
              className="w-full gap-2 rounded-full bg-brand-bright font-semibold text-text-inverse transition-all duration-200 hover:brightness-110 disabled:opacity-50"
              disabled={isSubmitting || !email || !password || !hasSupabaseConfig}
              type="submit"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? (isAwaitingProfile ? 'Loading workspace...' : 'Signing in...') : 'Sign In'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full border-surface-border text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              disabled={isSubmitting || !hasSupabaseConfig}
              onClick={() => void handleDemoLogin()}
            >
              Try Demo
            </Button>
            <p className="text-center text-xs text-text-muted">
              Don&apos;t have an account?{' '}
              <PanelLink onClick={() => switchPanel('sign-up')}>Create one</PanelLink>
            </p>
          </form>
        )}

        {authPanel === 'sign-up' && (
          <form className="space-y-4" onSubmit={handleSignUp}>
            {signUpSuccess ? (
              <div className="space-y-4">
                <SuccessBanner message="Check your email to confirm your account. You'll receive a verification link within a few minutes." />
                <p className="text-center text-xs text-text-muted">
                  Already have an account?{' '}
                  <PanelLink onClick={() => switchPanel('sign-in')}>Sign in</PanelLink>
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <DarkLabel htmlFor="su-name">Full name</DarkLabel>
                  <DarkInput
                    id="su-name"
                    type="text"
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    placeholder="Jane Smith"
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <DarkLabel htmlFor="su-email">Work email</DarkLabel>
                  <DarkInput
                    id="su-email"
                    type="email"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    placeholder="name@company.com"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <DarkLabel htmlFor="su-password">Password</DarkLabel>
                  <DarkInput
                    id="su-password"
                    type="password"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <DarkLabel htmlFor="su-confirm">Confirm password</DarkLabel>
                  <DarkInput
                    id="su-confirm"
                    type="password"
                    value={signUpConfirmPassword}
                    onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                  />
                </div>

                {signUpError ? <ErrorBanner message={signUpError} /> : null}

                <Button
                  className="w-full gap-2 rounded-full bg-brand-bright font-semibold text-text-inverse transition-all duration-200 hover:brightness-110 disabled:opacity-50"
                  disabled={isSigningUp || !signUpEmail || !signUpPassword || !hasSupabaseConfig}
                  type="submit"
                >
                  {isSigningUp ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isSigningUp ? 'Creating account...' : 'Create account'}
                </Button>
                <p className="text-center text-xs text-text-muted">
                  Already have an account?{' '}
                  <PanelLink onClick={() => switchPanel('sign-in')}>Sign in</PanelLink>
                </p>
              </>
            )}
          </form>
        )}

        {authPanel === 'forgot-password' && (
          <form className="space-y-4" onSubmit={handleForgotPassword}>
            {forgotSuccess ? (
              <div className="space-y-4">
                <SuccessBanner message="Password reset link sent. Check your inbox - the link expires in 1 hour." />
                <p className="text-center text-xs text-text-muted">
                  <PanelLink onClick={() => switchPanel('sign-in')}>Back to sign in</PanelLink>
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-text-secondary">
                  Enter the email address on your account and we&apos;ll send you a reset link.
                </p>
                <div className="space-y-2">
                  <DarkLabel htmlFor="fp-email">Email</DarkLabel>
                  <DarkInput
                    id="fp-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@company.com"
                    autoComplete="email"
                  />
                </div>

                {forgotError ? <ErrorBanner message={forgotError} /> : null}

                <Button
                  className="w-full gap-2 rounded-full bg-brand-bright font-semibold text-text-inverse transition-all duration-200 hover:brightness-110 disabled:opacity-50"
                  disabled={isSendingReset || !forgotEmail || !hasSupabaseConfig}
                  type="submit"
                >
                  {isSendingReset ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isSendingReset ? 'Sending...' : 'Send reset link'}
                </Button>
                <p className="text-center text-xs text-text-muted">
                  Remembered it?{' '}
                  <PanelLink onClick={() => switchPanel('sign-in')}>Back to sign in</PanelLink>
                </p>
              </>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
