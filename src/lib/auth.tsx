'use client';

import type { Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({ session: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase().auth.signOut();
    setSession(null);
  };

  return <AuthContext.Provider value={{ session, loading, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/**
 * Redirect to /signin if not authenticated. Returns the loading flag so a page
 * can render a spinner while the session resolves.
 */
export function useRequireAuth(): { ready: boolean } {
  const { session, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !session) {
      const next = typeof window !== 'undefined' ? window.location.pathname : '/';
      router.replace(`/signin?next=${encodeURIComponent(next)}`);
    }
  }, [loading, session, router]);
  return { ready: !loading && !!session };
}

/**
 * Ensure a session WITHOUT a sign-in wall: if none, sign in anonymously so the
 * parent can build and preview a book before ever creating an account. The
 * anonymous user still gets a profiles row (see server/auth.requireParent), so
 * consent + book creation + RLS all work; the account is upgraded to a real
 * email at save/checkout, keeping the same id (and the book). Returns:
 * - ready: a session exists (anonymous or real)
 * - error: anonymous sign-in failed (e.g. not enabled in Supabase)
 */
export function useEnsureSession(): { ready: boolean; error: string | null } {
  const { session, loading } = useAuth();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (loading || session || starting) return;
    setStarting(true);
    supabase()
      .auth.signInAnonymously()
      .then(({ error }) => {
        if (error) setError(error.message);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not start a session'))
      .finally(() => setStarting(false));
  }, [loading, session, starting]);
  return { ready: !loading && !!session, error };
}
