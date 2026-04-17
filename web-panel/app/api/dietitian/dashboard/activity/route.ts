import { NextResponse } from 'next/server';
import { getInternalApiBaseUrl } from '@/lib/server-api';

export async function GET(req: Request) {
  const backend = getInternalApiBaseUrl();

  // Extract query parameters
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get('limit') ?? '15';

  // Forward authorization header (cookie-based auth)
  const cookie = req.headers.get('cookie') ?? '';

  try {
    const res = await fetch(`${backend}/api/dietitian/dashboard/activity?limit=${limit}`, {
      headers: {
        cookie,
      },
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
    console.error('[API Route] Error proxying dashboard activity:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Backend service unavailable', message: 'Failed to fetch dashboard activity' }),
      {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
}
