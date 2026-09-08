import { NextRequest, NextResponse } from 'next/server';
import { serverEnv } from '@/lib/server/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;

const FORWARDED_REQUEST_HEADERS = [
  'cookie',
  'content-type',
  'accept',
  'accept-language',
  'x-csrf-token',
  'referer',
  'user-agent',
] as const;

const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'location',
  'cache-control',
  'content-encoding',
] as const;

async function proxy(req: NextRequest, method: string) {
  const { kratosPublicUrl } = serverEnv();

  const upstreamPath = req.nextUrl.pathname
    .replace(/^\/api\/kratos/, '')
    .replace(/^\/\.kratos/, '');

  const upstreamUrl = new URL(
    `${upstreamPath}${req.nextUrl.search}`,
    kratosPublicUrl
  );

  const requestHeaders = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) {
      requestHeaders.set(name, value);
    }
  }

  const init: RequestInit & { duplex: 'half' } = {
    method,
    headers: requestHeaders,
    redirect: 'manual',
    duplex: 'half',
    body: req.body ?? undefined,
  };

  const upstream = await fetch(upstreamUrl, init);

  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) {
      responseHeaders.set(name, value);
    }
  }
  for (const cookie of upstream.headers.getSetCookie()) {
    responseHeaders.append('set-cookie', cookie);
  }

  const body = Buffer.from(await upstream.arrayBuffer());
  return new NextResponse(body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

function createHandler(method: (typeof METHODS)[number]) {
  return (req: NextRequest) => proxy(req, method);
}

export const GET = createHandler('GET');
export const POST = createHandler('POST');
export const PUT = createHandler('PUT');
export const PATCH = createHandler('PATCH');
export const DELETE = createHandler('DELETE');

export function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}