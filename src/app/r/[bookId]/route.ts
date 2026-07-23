import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- GET /r/:bookId — short reorder link (printed in the in-box card / QR) ----
// Redirects to the create flow prefilled from this book's hero, so a parent can
// start the next adventure for the same child in one tap. Auth is handled by the
// create page itself; a bad id just lands on a fresh create.
export async function GET(req: Request, ctx: { params: Promise<{ bookId: string }> }): Promise<Response> {
  const { bookId } = await ctx.params;
  const valid = z.string().uuid().safeParse(bookId).success;
  const dest = new URL(valid ? `/create?from=${bookId}` : '/create', req.url);
  return Response.redirect(dest, 302);
}
