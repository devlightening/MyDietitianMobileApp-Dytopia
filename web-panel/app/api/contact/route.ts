import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND = process.env.INTERNAL_API_BASE_URL ?? 'http://127.0.0.1:5000';

// Simple HTML-tag stripper — prevents stored XSS from browser side as well
function stripTags(s: string) {
  return s.replace(/<[^>]*>/g, '').trim();
}

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export async function POST(req: NextRequest) {
  // ── Origin check (CSRF protection) ─────────────────────────────
  const origin = req.headers.get('origin') ?? '';
  const host   = req.headers.get('host') ?? '';
  if (origin && !origin.includes(host.split(':')[0]) && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Geçersiz istek kaynağı.' }, { status: 403 });
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek formatı.' }, { status: 400 });
  }

  const { name, email, phone, subject, message } = body;

  // ── Client-side validation (backend validates again) ───────────
  if (!name?.trim() || name.trim().length > 150)
    return NextResponse.json({ error: 'Ad geçersiz veya çok uzun.' }, { status: 400 });

  if (!email?.trim() || !isValidEmail(email.trim()) || email.length > 255)
    return NextResponse.json({ error: 'Geçerli bir e-posta adresi girin.' }, { status: 400 });

  if (phone && phone.length > 30)
    return NextResponse.json({ error: 'Telefon numarası çok uzun.' }, { status: 400 });

  if (!subject?.trim() || subject.trim().length > 200)
    return NextResponse.json({ error: 'Konu boş bırakılamaz veya çok uzun.' }, { status: 400 });

  if (!message?.trim() || message.trim().length > 4000)
    return NextResponse.json({ error: 'Mesaj boş bırakılamaz veya çok uzun.' }, { status: 400 });

  // ── Sanitize before forwarding ──────────────────────────────────
  const payload = {
    name:    stripTags(name),
    email:   email.trim().toLowerCase(),
    phone:   phone ? stripTags(phone) : null,
    subject: stripTags(subject),
    message: stripTags(message),
  };

  try {
    const res = await fetch(`${BACKEND}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('Contact proxy error:', err);
    return NextResponse.json(
      { error: 'Mesaj gönderilemedi. Lütfen tekrar deneyin.' },
      { status: 502 }
    );
  }
}
