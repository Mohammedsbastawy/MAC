
import {NextRequest, NextResponse} from 'next/server';

const flaskBackend = 'http://127.0.0.1:5000';

async function handler(req: NextRequest) {
  const {pathname, search} = req.nextUrl;
  const flaskUrl = new URL(pathname + search, flaskBackend);

  return fetch(flaskUrl, {
    method: req.method,
    headers: req.headers,
    body: req.body,
    // @ts-ignore
    duplex: 'half',
    cache: 'no-store',
  });
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as DELETE,
  handler as PATCH,
  handler as HEAD,
  handler as OPTIONS,
};
