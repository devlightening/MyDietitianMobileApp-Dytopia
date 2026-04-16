'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Phone,
  Trash2,
  CheckCheck,
  LogOut,
  RefreshCw,
  Circle,
  Clock,
  Inbox,
  Search,
} from 'lucide-react';

interface Message {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  createdAt: string;
  read: boolean;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export default function OwnerPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/owner/messages');
      if (res.status === 401) {
        router.push('/owner/giris');
        return;
      }
      const data = await res.json();
      setMessages(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMessages(); }, []);

  const markRead = async (id: string) => {
    await fetch('/api/owner/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, read: true } : m));
    if (selected?.id === id) setSelected((m) => m ? { ...m, read: true } : null);
  };

  const deleteMsg = async (id: string) => {
    await fetch('/api/owner/messages', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setMessages((prev) => prev.filter((m) => m.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const logout = async () => {
    await fetch('/api/owner/auth', { method: 'DELETE' });
    router.push('/owner/giris');
  };

  const openMessage = (msg: Message) => {
    setSelected(msg);
    if (!msg.read) markRead(msg.id);
  };

  const filtered = messages.filter((m) => {
    if (filter === 'unread' && m.read) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.subject.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const unreadCount = messages.filter((m) => !m.read).length;

  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--surface-base)]">
      {/* Topbar */}
      <header className="sticky top-0 z-40 border-b border-[var(--border-default)] bg-[rgba(246,251,247,0.90)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-primary)] shadow-[0_4px_12px_rgba(71,185,114,0.28)]">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22C6.5 22 2 17.5 2 12C2 8 4.5 4.5 8 3C8 3 7 8 12 8C17 8 16 3 16 3C19.5 4.5 22 8 22 12C22 17.5 17.5 22 12 22Z" />
              </svg>
            </div>
            <div>
              <span className="font-black text-[hsl(var(--foreground))]">MyDietitian</span>
              <span className="ml-2 text-xs font-semibold text-[hsl(var(--muted-foreground))]">Yönetici</span>
            </div>
            {unreadCount > 0 && (
              <span className="badge-base badge-premium text-xs">
                {unreadCount} okunmamış
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchMessages}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-default)] bg-white/60 text-[hsl(var(--muted-foreground))] transition-all hover:border-[var(--border-emerald-dim)] hover:text-[var(--brand-emerald)]"
              style={{ cursor: 'pointer' }}
              title="Yenile"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-white/60 px-4 py-2 text-sm font-semibold text-[hsl(var(--muted-foreground))] transition-all hover:border-red-200 hover:text-red-500"
              style={{ cursor: 'pointer' }}
            >
              <LogOut className="h-3.5 w-3.5" />
              Çıkış
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 gap-0 px-4 py-6 sm:px-6 sm:gap-5">
        {/* Left: Message List */}
        <aside className={`flex w-full flex-col sm:w-80 lg:w-96 shrink-0 ${selected ? 'hidden sm:flex' : 'flex'}`}>
          {/* Filters */}
          <div className="mb-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
              <input
                type="text"
                placeholder="Ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-sfcos pl-10 text-sm"
                style={{ cursor: 'text', userSelect: 'text', WebkitUserSelect: 'text' }}
              />
            </div>

            <div className="flex gap-2">
              {(['all', 'unread'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 rounded-full border py-2 text-xs font-bold transition-all ${
                    filter === f
                      ? 'border-[var(--border-emerald)] bg-[var(--brand-primary-soft)] text-[var(--brand-emerald)]'
                      : 'border-[var(--border-default)] bg-white/60 text-[hsl(var(--muted-foreground))] hover:border-[var(--border-emerald-dim)]'
                  }`}
                  style={{ cursor: 'pointer' }}
                >
                  {f === 'all' ? `Tümü (${messages.length})` : `Okunmamış (${unreadCount})`}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 space-y-2 overflow-y-auto">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--surface-overlay)]" />
              ))
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-overlay)]">
                  <Inbox className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
                </div>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {search ? 'Sonuç bulunamadı' : 'Henüz mesaj yok'}
                </p>
              </div>
            ) : (
              filtered.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => openMessage(msg)}
                  className={`w-full rounded-2xl border p-4 text-left transition-all ${
                    selected?.id === msg.id
                      ? 'border-[var(--border-emerald)] bg-[var(--brand-primary-soft)]'
                      : msg.read
                      ? 'border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--border-emerald-dim)] hover:shadow-sm'
                      : 'border-[var(--border-emerald-dim)] bg-[var(--surface-raised)] shadow-[var(--shadow-emerald-sm)]'
                  }`}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      {!msg.read && (
                        <Circle className="h-2 w-2 shrink-0 fill-[var(--brand-emerald)] text-[var(--brand-emerald)]" />
                      )}
                      <span className={`truncate text-sm ${msg.read ? 'font-medium' : 'font-bold'} text-[hsl(var(--foreground))]`}>
                        {msg.name}
                      </span>
                    </div>
                    <span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">
                      {formatDate(msg.createdAt).split(',')[0]}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-xs font-semibold text-[var(--brand-emerald)]">
                    {msg.subject}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-[hsl(var(--muted-foreground))]">
                    {msg.message}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Right: Message Detail */}
        <main className={`flex-1 ${selected ? 'flex' : 'hidden sm:flex'} flex-col`}>
          {selected ? (
            <div className="card-sfcos flex-1 overflow-hidden">
              {/* Detail header */}
              <div className="flex items-start justify-between border-b border-[var(--border-subtle)] p-6">
                <div className="flex-1 overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black tracking-tight text-[hsl(var(--foreground))]">
                      {selected.subject}
                    </h2>
                    {!selected.read && (
                      <span className="badge-base badge-premium text-[10px]">Okunmamış</span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[hsl(var(--muted-foreground))]">
                    <span className="flex items-center gap-1.5 font-semibold text-[hsl(var(--foreground))]">
                      {selected.name}
                    </span>
                    <a
                      href={`mailto:${selected.email}`}
                      className="flex items-center gap-1 hover:text-[var(--brand-emerald)]"
                      style={{ cursor: 'pointer' }}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {selected.email}
                    </a>
                    {selected.phone && (
                      <a
                        href={`tel:${selected.phone}`}
                        className="flex items-center gap-1 hover:text-[var(--brand-emerald)]"
                        style={{ cursor: 'pointer' }}
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {selected.phone}
                      </a>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDate(selected.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="ml-4 flex shrink-0 items-center gap-2">
                  {!selected.read && (
                    <button
                      onClick={() => markRead(selected.id)}
                      className="flex items-center gap-1.5 rounded-full border border-[var(--border-emerald-dim)] bg-[var(--brand-primary-softer)] px-3 py-1.5 text-xs font-bold text-[var(--brand-emerald)] transition-all hover:bg-[var(--brand-primary-soft)]"
                      style={{ cursor: 'pointer' }}
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Okundu
                    </button>
                  )}
                  <button
                    onClick={() => deleteMsg(selected.id)}
                    className="flex items-center gap-1.5 rounded-full border border-[rgba(229,126,107,0.22)] bg-[rgba(229,126,107,0.06)] px-3 py-1.5 text-xs font-bold text-[var(--brand-coral)] transition-all hover:bg-[rgba(229,126,107,0.12)]"
                    style={{ cursor: 'pointer' }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Sil
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    className="sm:hidden flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-default)] text-[hsl(var(--muted-foreground))]"
                    style={{ cursor: 'pointer' }}
                  >
                    ←
                  </button>
                </div>
              </div>

              {/* Message body */}
              <div className="p-6 lg:p-8">
                <div className="max-w-2xl whitespace-pre-wrap rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-6 text-sm leading-7 text-[hsl(var(--foreground))]">
                  {selected.message}
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href={`mailto:${selected.email}?subject=Re%3A%20${encodeURIComponent(selected.subject)}&body=${encodeURIComponent(`Merhaba ${selected.name},\n\n`)}`}
                    rel="noopener noreferrer"
                    className="btn-primary inline-flex items-center gap-2"
                    style={{ cursor: 'pointer', pointerEvents: 'auto', userSelect: 'none' }}
                  >
                    <Mail className="h-4 w-4" />
                    E-posta ile Yanıtla
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(selected.email);
                    }}
                    className="btn-ghost inline-flex items-center gap-2"
                    style={{ cursor: 'pointer' }}
                  >
                    E-postayı Kopyala
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card-sfcos flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-overlay)]">
                <Mail className="h-7 w-7 text-[hsl(var(--muted-foreground))]" />
              </div>
              <div>
                <p className="font-semibold text-[hsl(var(--muted-foreground))]">
                  Bir mesaj seçin
                </p>
                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))] opacity-70">
                  Sol listeden görüntülemek istediğiniz mesaja tıklayın
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
