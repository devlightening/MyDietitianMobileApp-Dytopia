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
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-[var(--surface-glass)] shadow-[0_-16px_48px_-32px_rgba(0,0,0,0.28)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Kaydedilmemiş değişiklikler var</p>
          <p className="text-xs text-muted-foreground">
            Düzenlemeleri kaydedebilir veya son kaydedilen duruma dönebilirsiniz.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onDiscard}
            disabled={isSaving}
            className="rounded-xl border border-border bg-[var(--surface-raised)] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[var(--surface-overlay)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Kaydediliyor...' : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
