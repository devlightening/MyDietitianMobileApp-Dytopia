import { CheckCircle2, Sparkles } from 'lucide-react';

interface SettingsSaveBarProps {
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  saveLabel?: string;
}

export function SettingsSaveBar({
  isDirty,
  isSaving,
  onSave,
  onDiscard,
  saveLabel = 'Değişiklikleri kaydet',
}: SettingsSaveBarProps) {
  if (!isDirty) {
    return null;
  }

  return (
    <div className="fixed bottom-5 left-1/2 z-50 w-[min(1100px,calc(100%-32px))] -translate-x-1/2 rounded-[28px] border border-[var(--border-emerald-dim)] bg-[var(--surface-glass)] shadow-[var(--shadow-card-hover)] backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ background: 'var(--brand-primary-soft)', color: 'var(--brand-emerald)' }}
          >
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Tema tercihlerin hazır görünüyor</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Değişiklikleri şimdi kaydedersen tüm panelde aynı renk diliyle uygulanır.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onDiscard}
            disabled={isSaving}
            className="btn-ghost rounded-2xl px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-[var(--brand-primary-contrast)] shadow-[var(--shadow-emerald-sm)] transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: 'var(--brand-primary)' }}
          >
            <CheckCircle2 className="h-4 w-4" />
            {isSaving ? 'Kaydediliyor...' : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
