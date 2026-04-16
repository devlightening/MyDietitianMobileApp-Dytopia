import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'admin@mydietitian.com';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD ?? 'MyDietitian2026!';
const SESSION_SECRET = process.env.OWNER_SESSION_SECRET ?? 'owner-secret-session-key-2026';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (email !== OWNER_EMAIL || password !== OWNER_PASSWORD) {
      return NextResponse.json(
        { error: 'E-posta veya şifre hatalı.' },
        { status: 401 }
      );
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set('owner_session', SESSION_SECRET, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Giriş yapılamadı.' }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete('owner_session');
  return res;
}
