import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { requireParent } from '@/server/auth';
import { loadEnv } from '@/server/config/env';
import { audit } from '@/server/lib/audit';
import { badRequest, forbidden, notFound } from '@/server/lib/errors';
import { jsonError } from '@/server/lib/route';
import { hashShareToken } from '@/server/lib/share-token';
import { serviceClient } from '@/server/lib/supabase';
import type { CreateBookShareResponse, RevokeBookShareResponse } from '@/server/types/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SHARE_TTL_DAYS = 7;

type Ctx = { params: Promise<{ id: string }> };

// ---- POST /api/v1/books/:id/share — create an expiring private preview link ----
export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const parent = await requireParent(req);
    const { id } = await ctx.params;
    const book = await loadOwnedShareableBook(id, parent.id);

    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + SHARE_TTL_DAYS * 86_400_000).toISOString();
    const db = serviceClient();
    const { error } = await db.from('book_share_links').insert({
      parent_id: parent.id,
      book_id: book.id,
      token_hash: hashShareToken(token),
      expires_at: expiresAt,
    });
    if (error) throw badRequest('Could not create share link', error.message);

    await audit({
      actor: 'parent',
      action: 'book.share_created',
      entity: 'books',
      entityId: book.id,
      metadata: { expiresAt },
    });

    return Response.json(
      { shareUrl: `${appOrigin(req)}/share/${token}`, expiresAt } satisfies CreateBookShareResponse,
      { status: 201 },
    );
  } catch (err) {
    return jsonError(err);
  }
}

// ---- DELETE /api/v1/books/:id/share — revoke active preview links for this book ----
export async function DELETE(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const parent = await requireParent(req);
    const { id } = await ctx.params;
    const book = await loadOwnedShareableBook(id, parent.id);
    const { data, error } = await serviceClient()
      .from('book_share_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('book_id', book.id)
      .eq('parent_id', parent.id)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('id');
    if (error) throw badRequest('Could not revoke share links', error.message);

    const revoked = (data as { id: string }[] | null)?.length ?? 0;
    await audit({
      actor: 'parent',
      action: 'book.share_revoked',
      entity: 'books',
      entityId: book.id,
      metadata: { revoked },
    });

    return Response.json({ revoked } satisfies RevokeBookShareResponse);
  } catch (err) {
    return jsonError(err);
  }
}

async function loadOwnedShareableBook(id: string, parentId: string): Promise<{ id: string }> {
  if (!z.string().uuid().safeParse(id).success) throw badRequest('Invalid book id');
  const { data, error } = await serviceClient()
    .from('books')
    .select('id, parent_id, status, deleted_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw badRequest('Could not load book', error.message);
  const row = data as { id: string; parent_id: string; status: string; deleted_at: string | null } | null;
  if (!row || row.deleted_at) throw notFound('Book not found');
  if (row.parent_id !== parentId) throw forbidden();
  if (!['preview_ready', 'paid', 'complete'].includes(row.status)) {
    throw badRequest('A preview link can be created after the preview is ready.');
  }
  return { id: row.id };
}

function appOrigin(req: Request): string {
  const configured = loadEnv().APP_BASE_URL.trim().replace(/\/$/, '');
  if (configured) return configured;
  return new URL(req.url).origin;
}
