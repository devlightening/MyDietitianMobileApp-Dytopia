import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND      = process.env.INTERNAL_API_BASE_URL ?? 'http://127.0.0.1:5000';
const SESSION_SECRET = process.env.OWNER_SESSION_SECRET ?? 'owner-secret-session-key-2026';
const ADMIN_KEY    = process.env.CONTACT_ADMIN_KEY ?? 'CHANGE_ME_CONTACT_ADMIN_KEY_2026';

function isAuthorized(req: NextRequest) {
  return req.cookies.get('owner_session')?.value === SESSION_SECRET;
}

function backendHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Contact-Admin-Key': ADMIN_KEY,
  };
}

// GET — list messages (proxied from backend)
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const qs = searchParams.toString();

  try {
    const res = await fetch(`${BACKEND}/api/contact${qs ? `?${qs}` : ''}`, {
      headers: backendHeaders(),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ([]));
    // Backend returns { total, page, pageSize, items } — flatten to array for owner panel
    const messages = Array.isArray(data) ? data : (data.items ?? []);
    return NextResponse.json(messages);
  } catch (err) {
    console.error('Owner messages GET error:', err);
    return NextResponse.json({ error: 'Mesajlar alınamadı.' }, { status: 502 });
  }
}

// PATCH — mark as read
export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });
  }

  let id: string;
  try {
    ({ id } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  if (!id) return NextResponse.json({ error: 'ID gerekli.' }, { status: 400 });

  try {
    const res = await fetch(`${BACKEND}/api/contact/${id}/read`, {
      method: 'PATCH',
      headers: backendHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('Owner messages PATCH error:', err);
    return NextResponse.json({ error: 'İşlem başarısız.' }, { status: 502 });
  }
}

// DELETE — delete message
export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });
  }

  let id: string;
  try {
    ({ id } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  if (!id) return NextResponse.json({ error: 'ID gerekli.' }, { status: 400 });

  try {
    const res = await fetch(`${BACKEND}/api/contact/${id}`, {
      method: 'DELETE',
      headers: backendHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('Owner messages DELETE error:', err);
    return NextResponse.json({ error: 'Silme başarısız.' }, { status: 502 });
  }
}
