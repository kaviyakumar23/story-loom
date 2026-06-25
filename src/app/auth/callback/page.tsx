'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = params.get('next') || '/books';
    const code = params.get('code');
    (async () => {
      if (code) {
        const { error } = await supabase().auth.exchangeCodeForSession(code);
        if (error) {
          setError(error.message);
          return;
        }
      }
      router.replace(next);
    })();
  }, [params, router]);

  return (
    <div className="web" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      {error ? (
        <p style={{ color: 'var(--error)' }}>Sign-in failed: {error}</p>
      ) : (
        <span className="spinner spinner-brand" style={{ width: 28, height: 28 }} />
      )}
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={null}>
      <CallbackInner />
    </Suspense>
  );
}
