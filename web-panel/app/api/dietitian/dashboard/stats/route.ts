import { NextResponse } from 'next/server';
import { getInternalApiBaseUrl } from '@/lib/server-api';

export async function GET(req: Request) {
  const backend = getInternalApiBaseUrl();

  // Forward authorization header (cookie-based auth)
  const cookie = req.headers.get('cookie') ?? '';

  try {
    const res = await fetch(`${backend}/api/dietitian/dashboard/stats`, {
      headers: {
        cookie,
      },
      credentials: 'include',
      cache: 'no-store',
    });

    const data = await res.text();
    const contentType = res.headers.get('content-type') ?? 'application/json';

    return new NextResponse(data, {
      status: res.status,
      headers: {
        'content-type': contentType,
      },
    });
  } catch (error) {
    console.error('[API Route] Error proxying dashboard stats:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Backend service unavailable', message: 'Failed to fetch dashboard stats' }),
      {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
}
