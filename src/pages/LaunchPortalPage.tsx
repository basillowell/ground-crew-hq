import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Leaf, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useProgramSettings } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';

export default function LaunchPortalPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const programSettingsQuery = useProgramSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const clientName = programSettingsQuery.data?.clientLabel || 'Ground Crew HQ';
  const appName = programSettingsQuery.data?.appName || 'WorkForce App';
  const shellImageUrl = programSettingsQuery.data?.logoUrl || '';

  useEffect(() => {
    if (currentUser) {
      navigate('/app/dashboard');
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setErrorMessage('Supabase is not configured for this environment.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    navigate('/app/dashboard');
  };

  const scrollToAccess = () => {
    document.getElementById('launch-access')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,rgba(247,250,248,1),rgba(237,243,239,1))]">
      <header
        className="border-b border-white/10"
        style={{
          backgroundImage: shellImageUrl
            ? `linear-gradient(120deg, rgba(15,23,42,0.86), rgba(18,54,36,0.72)), url(${shellImageUrl})`
            : 'linear-gradient(120deg, rgba(18,54,36,1), rgba(30,93,62,0.92))',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4 text-white">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur">
            <Leaf className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight">{appName}</div>
            <div className="text-xs uppercase tracking-[0.18em] text-white/70">{clientName}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-14 md:py-20">
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,420px)] lg:items-center">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-primary">
              Ground operations workspace
            </div>
            <h1 className="max-w-xl text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              Workforce coordination for crews, properties, and daily field execution.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
              Ground Crew HQ gives supervisors, admins, and field teams one place to organize schedules,
              tasks, weather, and communication across every property.
            </p>
            <div className="mt-8">
              <Button size="lg" className="gap-2 px-6" onClick={scrollToAccess}>
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Card id="launch-access" className="border-primary/15 bg-card/95 p-6 shadow-xl shadow-primary/5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Login and access
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Sign in with your club or company credentials to open your operations workspace.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@club.com"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </div>
              {errorMessage ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive">
                  {errorMessage}
                </div>
              ) : null}
              <Button className="w-full gap-2" disabled={isSubmitting || !email || !password} type="submit">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {isSubmitting ? 'Signing In' : 'Get Started'}
              </Button>
            </form>
          </Card>
        </section>
      </main>
    </div>
  );
}
