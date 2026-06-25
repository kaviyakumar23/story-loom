'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Footer, Header } from '@/components/chrome';
import { Icon, Sparkle } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { GOAL_LABELS, type BookListItem, type BookStatus, type ListBooksResponse } from '@/lib/types';

const STATUS_LABEL: Record<BookStatus, { text: string; bg: string; fg: string }> = {
  generating: { text: 'Generating', bg: 'var(--soft-butter)', fg: '#8a6d1f' },
  preview_ready: { text: 'Preview ready', bg: 'var(--brand-tint)', fg: 'var(--brand)' },
  paid: { text: 'Finishing', bg: 'var(--soft-sky)', fg: '#2a6e8f' },
  complete: { text: 'Ready', bg: 'var(--soft-sage)', fg: 'var(--success)' },
  failed: { text: 'Needs review', bg: '#F6D5CC', fg: 'var(--error)' },
};

export default function Dashboard() {
  const { ready } = useRequireAuth();
  const [books, setBooks] = useState<BookListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    api<ListBooksResponse>('/books')
      .then((r) => setBooks(r.books))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load your books.'));
  }, [ready]);

  if (!ready) {
    return (
      <div className="web" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <span className="spinner spinner-brand" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  return (
    <div className="web" style={{ minHeight: '100vh' }}>
      <Header />
      <div className="container" style={{ padding: '40px 40px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <h1 className="display" style={{ fontSize: 36 }}>Your storybooks</h1>
          <Link href="/create" className="btn btn-primary" style={{ padding: '14px 22px' }}>
            <Sparkle size={17} color="var(--accent-ink)" /> New book
          </Link>
        </div>

        {error && <p style={{ color: 'var(--error)' }}>{error}</p>}

        {books && books.length === 0 && (
          <div className="card" style={{ padding: '48px 32px', textAlign: 'center' }}>
            <Sparkle size={40} color="var(--brand)" style={{ margin: '0 auto 14px' }} />
            <h2 className="display" style={{ fontSize: 24, marginBottom: 8 }}>No books yet</h2>
            <p style={{ color: 'var(--ink-soft)', marginBottom: 20 }}>Create your child’s first adventure — the preview is free.</p>
            <Link href="/create" className="btn btn-primary" style={{ width: 'auto', display: 'inline-flex' }}>Start a story</Link>
          </div>
        )}

        {books && books.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {books.map((b) => {
              const s = STATUS_LABEL[b.status];
              return (
                <Link key={b.id} href={`/books/${b.id}`} className="card lift" style={{ padding: '20px 22px', textDecoration: 'none', display: 'block' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <span className="pill" style={{ background: s.bg, color: s.fg, border: 'none' }}>{s.text}</span>
                    <Icon name="chevron" size={18} stroke="var(--ink-soft)" style={{ transform: 'rotate(-90deg)' }} />
                  </div>
                  <h3 className="display" style={{ fontSize: 21, marginBottom: 6 }}>{b.title ?? 'Untitled adventure'}</h3>
                  <p style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>{GOAL_LABELS[b.goal]}</p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
