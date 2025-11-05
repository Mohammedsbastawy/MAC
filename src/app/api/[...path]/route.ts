
import {NextRequest, NextResponse} from 'next/server';

const flaskBackend = 'http://127.0.0.1:5000';

// By default, Next.js limits the request body size to 1MB.
// To handle larger file uploads, we need to disable this limit
// for our API proxy route.
export const config = {
  api: {
    bodyParser: false,
  },
};

async function handler(req: NextRequest) {
  const {pathname, search} = req.nextUrl;
  const flaskUrl = new URL(pathname + search, flaskBackend);

  // We are streaming the request body from Next.js to Flask.
  // This is crucial for handling large file uploads without consuming
  // a lot of memory on the Next.js server.
  return fetch(flaskUrl, {
    method: req.method,
    headers: req.headers,
    body: req.body,
    // @ts-ignore - duplex is a valid option for fetch in Node.js
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

