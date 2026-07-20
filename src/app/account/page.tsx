'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Footer, Header } from '@/components/chrome';
import { Icon } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth, useRequireAuth } from '@/lib/auth';

export default function Account() {
  const { ready } = useRequireAuth();
  const { session, signOut } = useAuth();
  const router = useRouter();

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawn, setWithdrawn] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!ready) {
    return (
      <div className="web" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <span className="spinner spinner-brand" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  const email = session?.user?.email ?? '—';

  async function downloadData() {
    setExporting(true);
    setExportError(null);
    try {
      const data = await api<unknown>('/account/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `moonbell-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e instanceof ApiError ? e.message : 'Could not export your data. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  async function withdrawConsent() {
    setWithdrawing(true);
    setWithdrawError(null);
    try {
      await api('/consent', { method: 'DELETE' });
      setWithdrawn(true);
    } catch (e) {
      setWithdrawError(e instanceof ApiError ? e.message : 'Could not withdraw consent. Please try again.');
    } finally {
      setWithdrawing(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api('/account/delete', { method: 'POST' });
      setDeleted(true);
      await signOut();
    } catch (e) {
      setDeleteError(e instanceof ApiError ? e.message : 'Could not delete your account. Please try again.');
      setDeleting(false);
    }
  }

  return (
    <div className="web" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main className="container-narrow page-pad" style={{ flex: 1, maxWidth: 640 }}>
        <span className="eyebrow"><Icon name="lock" size={13} stroke="var(--brand)" /> Your account</span>
        <h1 className="display" style={{ fontSize: 34, margin: '12px 0 6px', lineHeight: 1.1 }}>Account &amp; data</h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginBottom: 28 }}>
          Signed in as <strong style={{ color: 'var(--ink)' }}>{email}</strong>
        </p>

        {deleted ? (
          <div className="card" style={{ padding: '28px 26px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--soft-sage)', margin: '0 auto 16px', display: 'grid', placeItems: 'center' }}>
              <Icon name="check" size={32} stroke="var(--success)" sw={2.4} />
            </div>
            <h2 className="display" style={{ fontSize: 24, marginBottom: 8 }}>Your account has been deleted</h2>
            <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginBottom: 20 }}>
              We&apos;ve removed your account, your child&apos;s details, and the associated book assets.
            </p>
            <Link className="btn btn-primary" href="/">Back to home</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Export */}
            <div className="card" style={{ padding: '24px 26px' }}>
              <h2 className="display" style={{ fontSize: 22, marginBottom: 6 }}>Download my data</h2>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 16, lineHeight: 1.6 }}>
                Get a copy of the data we hold about your account and your books, as a JSON file.
              </p>
              <button className="btn btn-brand" onClick={() => void downloadData()} disabled={exporting}>
                {exporting ? <><span className="spinner" /> Preparing…</> : <><Icon name="download" size={18} stroke="#fff" /> Download my data</>}
              </button>
              {exportError && <p style={{ color: 'var(--error)', fontSize: 13.5, marginTop: 12 }}>{exportError}</p>}
            </div>

            {/* Withdraw consent — DPDP §6: as easy to take back as it was to give. */}
            <div className="card" style={{ padding: '24px 26px' }}>
              <h2 className="display" style={{ fontSize: 22, marginBottom: 6 }}>Withdraw consent</h2>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 16, lineHeight: 1.6 }}>
                Stops us using your child&apos;s details to make any new books. The books you already have stay
                in your account — to remove those as well, use Delete below.
              </p>
              {withdrawn ? (
                <p style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>
                  <Icon name="check" size={16} stroke="var(--success)" /> Consent withdrawn. We&apos;ll ask again
                  if you ever want to make another book.
                </p>
              ) : (
                <button className="btn btn-ghost" onClick={() => void withdrawConsent()} disabled={withdrawing}>
                  {withdrawing ? <><span className="spinner" /> Withdrawing…</> : 'Withdraw consent'}
                </button>
              )}
              {withdrawError && <p style={{ color: 'var(--error)', fontSize: 13.5, marginTop: 12 }}>{withdrawError}</p>}
            </div>

            {/* Delete */}
            <div className="card" style={{ padding: '24px 26px', border: '1.5px solid #F6D5CC' }}>
              <h2 className="display" style={{ fontSize: 22, marginBottom: 6 }}>Delete my account &amp; data</h2>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 16, lineHeight: 1.6 }}>
                This permanently removes your account, your child&apos;s details, and all book assets. You will be
                signed out and will not be able to sign in again with this email. Purchased books will no longer
                be available to download. This cannot be undone.
              </p>
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16, lineHeight: 1.6 }}>
                If you&apos;ve bought a book, we keep the order amount and date as an anonymous financial record —
                tax law requires it — with your name and contact details removed.
              </p>
              {!confirming ? (
                <button className="btn btn-ghost" style={{ color: 'var(--error)', borderColor: '#F6D5CC' }} onClick={() => setConfirming(true)} disabled={deleting}>
                  <Icon name="x" size={18} stroke="var(--error)" /> Delete my account &amp; data
                </button>
              ) : (
                <div style={{ background: '#FBEAE5', borderRadius: 'var(--r)', padding: '16px 18px' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, lineHeight: 1.5 }}>
                    Are you sure? This permanently deletes everything and cannot be undone.
                  </p>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" style={{ background: 'var(--error)' }} onClick={() => void deleteAccount()} disabled={deleting}>
                      {deleting ? <><span className="spinner" /> Deleting…</> : 'Yes, delete everything'}
                    </button>
                    <button className="btn btn-ghost" onClick={() => setConfirming(false)} disabled={deleting}>Cancel</button>
                  </div>
                </div>
              )}
              {deleteError && <p style={{ color: 'var(--error)', fontSize: 13.5, marginTop: 12 }}>{deleteError}</p>}
            </div>

            <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
              For more on how we handle your data, see our{' '}
              <Link href="/legal/privacy" style={{ color: 'var(--brand)', fontWeight: 600 }}>Privacy Policy</Link>.
              Questions or a formal request? Visit{' '}
              <Link href="/legal/contact" style={{ color: 'var(--brand)', fontWeight: 600 }}>Contact &amp; Grievance Redressal</Link>.
            </p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
