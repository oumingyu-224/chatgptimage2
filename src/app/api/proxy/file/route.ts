import { NextRequest, NextResponse } from 'next/server';

const PRIVATE_HOSTS = new Set(['localhost', '0.0.0.0']);

function isPrivateIPv4(hostname: string) {
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isAllowedProxyUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();

    if (parsed.protocol !== 'https:') {
      return false;
    }

    if (PRIVATE_HOSTS.has(hostname) || isPrivateIPv4(hostname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  if (!isAllowedProxyUrl(url)) {
    return new NextResponse('Invalid url parameter', { status: 400 });
  }

  try {
    const response = await fetch(url, {
      redirect: 'follow',
    });

    if (!response.ok) {
      return new NextResponse('Failed to fetch file', {
        status: response.status,
      });
    }

    const contentType =
      response.headers.get('content-type') || 'application/octet-stream';

    if (!contentType.startsWith('image/')) {
      return new NextResponse('Unsupported file type', { status: 400 });
    }

    return new NextResponse(response.body, {
      headers: {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
