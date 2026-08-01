import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Give every visitor an id before the page renders.
 *
 * The price experiment needs a stable per-browser id, and a Server Component
 * cannot set a cookie — so without this the id was only ever minted by an API
 * route nothing called, and every visitor fell through to the default arm. The
 * experiment would have collected no data at all while looking like it worked.
 *
 * The cookie is set on the forwarded REQUEST as well as the response, so the
 * page rendering this very request already sees it and can resolve (and
 * persist) an arm. Setting it only on the response would mean the first page
 * view showed the default price and later ones showed the assigned one — the
 * same visitor, two prices, which is the one thing this must never do.
 *
 * Deliberately no database work here: this runs on every request, and the id is
 * just a random uuid. The arm is chosen the first time a page actually needs it.
 */
const VISITOR_COOKIE = 'mb_vid';
const MAX_AGE = 180 * 86_400;

export function proxy(request: NextRequest) {
  const existing = request.cookies.get(VISITOR_COOKIE)?.value;
  if (existing && /^[0-9a-f-]{36}$/.test(existing)) return NextResponse.next();

  const visitorId = randomUUID();
  request.cookies.set(VISITOR_COOKIE, visitorId);
  const response = NextResponse.next({ request });
  response.cookies.set(VISITOR_COOKIE, visitorId, {
    path: '/',
    maxAge: MAX_AGE,
    // The arm is decided server-side and read server-side. A client that can
    // rewrite this can shop for the cheaper price.
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}

export const config = {
  // Pages only. Static assets and the API do not need an identity minted for
  // them, and every matched request costs latency.
  matcher: ['/', '/create', '/books/:path*', '/share/:path*'],
};
