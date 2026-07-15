'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Header } from '@/components/chrome';
import { Icon, Sparkle } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { safeNextPath } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';

function SignInInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get('next'), '/create');
  const { session } = useAuth();

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) router.replace(next);
  }, [session, next, router]);

  const redirectTo = typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
    : undefined;

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function google() {
    setError(null);
    const { error } = await supabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) setError(error.message);
  }

  return (
    <div className="web" style={{ minHeight: '100vh' }}>
      <Header minimal />
      <div className="container-narrow" style={{ padding: '64px 40px', display: 'flex', justifyContent: 'center' }}>
        <div className="card" style={{ padding: '40px 36px', maxWidth: 440, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
            <Sparkle size={20} color="var(--brand)" />
            <span className="eyebrow" style={{ color: 'var(--brand)' }}>Parent sign in</span>
          </div>
          <h1 className="display" style={{ fontSize: 28, marginBottom: 8 }}>Let’s make their book</h1>
          <p style={{ fontSize: 15, color: 'var(--ink-soft)', marginBottom: 24, lineHeight: 1.5 }}>
            You’re the account holder — children never sign in. We’ll email you a magic link.
          </p>

          {sent ? (
            <div style={{ background: 'var(--soft-2)', borderRadius: 14, padding: '18px 20px', display: 'flex', gap: 12, alignItems: 'center' }}>
              <Icon name="mail" size={22} stroke="var(--success)" />
              <div style={{ fontSize: 14.5 }}>Check your inbox — we sent a sign-in link to <strong>{email}</strong>.</div>
            </div>
          ) : (
            <>
              <form onSubmit={magicLink}>
                <label className="label">Email</label>
                <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} disabled={busy || !email}>
                  {busy ? <span className="spinner" /> : <><Icon name="mail" size={18} stroke="var(--accent-ink)" /> Email me a link</>}
                </button>
              </form>
              <div style={{ textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13, margin: '16px 0' }}>or</div>
              <button className="btn btn-ghost btn-block" onClick={google}>Continue with Google</button>
            </>
          )}
          {error && <p style={{ color: 'var(--error)', fontSize: 13.5, marginTop: 14 }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={null}>
      <SignInInner />
    </Suspense>
  );
}
