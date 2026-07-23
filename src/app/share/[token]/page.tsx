import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/chrome';
import { ReadingGuidePanel } from '@/components/reading-guide';
import { Icon, Sparkle } from '@/components/ui';
import { PHOTO_LIKENESS_ENABLED } from '@/lib/photo-likeness';
import { hashShareToken } from '@/server/lib/share-token';
import { toBook, type BookRow } from '@/server/lib/mappers';
import { serviceClient } from '@/server/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A parent shares this link with family, not with the internet. It holds a
// child's name and story: it must never be indexed, however far it gets forwarded.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

const BOOK_COLUMNS =
  'id, status, progress, goal, occasion_pack, language, reading_level, title, theme, purchased_tier, cover_asset_id, error, created_at, updated_at';

export default async function SharedPreviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,120}$/.test(token)) notFound();

  const db = serviceClient();
  const { data: link } = await db
    .from('book_share_links')
    .select('book_id, expires_at, revoked_at')
    .eq('token_hash', hashShareToken(token))
    .maybeSingle();

  const share = link as { book_id: string; expires_at: string; revoked_at: string | null } | null;
  if (!share || share.revoked_at || Date.parse(share.expires_at) <= Date.now()) notFound();

  const { data: row } = await db
    .from('books')
    .select(`${BOOK_COLUMNS}, deleted_at`)
    .eq('id', share.book_id)
    .maybeSingle();
  const bookRow = row as (BookRow & { deleted_at: string | null }) | null;
  if (!bookRow || bookRow.deleted_at || !['preview_ready', 'paid', 'complete'].includes(bookRow.status)) {
    notFound();
  }

  // No includeDelivery: a link holder sees the preview, never the purchased PDF.
  const book = await toBook(bookRow);
  const pages = book.preview?.pages ?? [];

  return (
    <div className="web" style={{ minHeight: '100vh' }}>
      <Header minimal />
      <main className="container page-pad">
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <span className="eyebrow" style={{ justifyContent: 'center' }}><Sparkle size={13} /> Shared preview</span>
          <h1 className="display" style={{ fontSize: 40, margin: '12px 0 8px' }}>{book.title ?? 'A MoonBell preview'}</h1>
          {book.theme && <p className="d-lead" style={{ color: 'var(--ink-soft)' }}>{book.theme}</p>}
          <p className="trust" style={{ marginTop: 12, justifyContent: 'center' }}>
            <Icon name="lock" size={15} stroke="var(--brand)" /> Private link expires {formatExpiry(share.expires_at)}
          </p>
        </div>

        <div className="book-layout">
          <section style={{ display: 'grid', gap: 18 }}>
            {pages.map((page) => (
              <article
                key={page.pageIndex}
                className="card shared-preview-card"
                style={{
                  overflow: 'hidden',
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(220px, .72fr)',
                }}
              >
                <div style={{ minHeight: 280, position: 'relative', background: 'var(--bg-2)' }}>
                  {page.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={page.imageUrl} alt={`Preview page ${page.pageIndex + 1}`} style={{ width: '100%', height: '100%', minHeight: 280, objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div className="ph" style={{ minHeight: 280, height: '100%', borderRadius: 0 }} />
                  )}
                </div>
                <div style={{ padding: '26px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <p className="pill" style={{ alignSelf: 'flex-start', marginBottom: 14 }}>Page {page.pageIndex + 1}</p>
                  <p style={{ fontSize: 18, lineHeight: 1.55 }}>{page.text}</p>
                </div>
              </article>
            ))}
          </section>

          <aside className="card" style={{ padding: '26px 24px', position: 'sticky', top: 96 }}>
            <h2 className="display" style={{ fontSize: 25, marginBottom: 8 }}>Made with care</h2>
            <div style={{ display: 'grid', gap: 12, marginBottom: 18 }}>
              {[
                PHOTO_LIKENESS_ENABLED
                  ? ['Photos are optional', 'If a photo was added, it was used once to shape the character, then deleted.']
                  : ['No photos collected', 'The child is represented with simple attributes.'],
                ['Parent-controlled', 'Only the family with this private link can view the preview.'],
                ['AI disclosed', 'Illustrations are AI-generated and should be reviewed by an adult.'],
              ].map(([title, text]) => (
                <div key={title} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Icon name="shield" size={17} stroke="var(--teal)" style={{ flex: 'none', marginTop: 2 }} />
                  <p style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--ink-soft)' }}>
                    <strong style={{ color: 'var(--ink)' }}>{title}.</strong> {text}
                  </p>
                </div>
              ))}
            </div>
            <ReadingGuidePanel guide={book.readingGuide} />
            <Link className="btn btn-primary btn-block" href="/" style={{ marginTop: 22 }}>
              <Sparkle size={17} color="var(--accent-ink)" /> Create your own preview
            </Link>
          </aside>
        </div>
      </main>
    </div>
  );
}

function formatExpiry(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}
