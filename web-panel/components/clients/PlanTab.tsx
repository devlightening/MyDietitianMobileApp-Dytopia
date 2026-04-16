'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getClientActivePlan,
  getClientPlans,
  getPlanTemplates,
  assignFromTemplate,
  assignNewPlan,
  updateClientPlan,
  type ActivePlan,
} from '@/lib/api/clients';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import {
  Calendar,
  CheckCircle2,
  Circle,
  LayoutTemplate,
  PlusCircle,
  ChevronDown,
  ChevronUp,
  Utensils,
  Pencil,
} from 'lucide-react';

interface PlanTabProps {
  clientId: string;
}

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Kahvaltı',
  lunch: 'Öğle',
  dinner: 'Akşam',
  snack: 'Ara öğün',
};

type ModalMode = 'template' | 'new' | 'edit' | null;

export function PlanTab({ clientId }: PlanTabProps) {
  const queryClient = useQueryClient();
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([0, 1]));

  // Plan data
  const { data: activePlanData, isLoading: planLoading } = useQuery({
    queryKey: ['client-active-plan', clientId],
    queryFn: () => getClientActivePlan(clientId),
    retry: 0,
  });

  const { data: historyData } = useQuery({
    queryKey: ['client-plans', clientId],
    queryFn: () => getClientPlans(clientId),
    retry: 0,
  });

  // Template-based assignment form state
  const { data: templatesData } = useQuery({
    queryKey: ['plan-templates'],
    queryFn: getPlanTemplates,
    enabled: modalMode === 'template',
  });

  const [tplSelectedId, setTplSelectedId] = useState('');
  const [tplStartDate, setTplStartDate] = useState('');
  const [tplEndDate, setTplEndDate] = useState('');
  const [tplName, setTplName] = useState('');

  // New plan form state
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');

  // Edit plan form state
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');

  const assignTemplateMutation = useMutation({
    mutationFn: () =>
      assignFromTemplate(clientId, {
        templateId: tplSelectedId,
        startDate: tplStartDate,
        endDate: tplEndDate || undefined,
        name: tplName || undefined,
        deactivateCurrent: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-active-plan', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-plans', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-detail', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-activities', clientId] });
      setModalMode(null);
      setTplSelectedId(''); setTplStartDate(''); setTplEndDate(''); setTplName('');
    },
  });

  const assignNewMutation = useMutation({
    mutationFn: () =>
      assignNewPlan(clientId, {
        name: newName,
        description: newDesc || undefined,
        startDate: newStartDate,
        endDate: newEndDate || undefined,
        meals: [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-active-plan', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-plans', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-detail', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-activities', clientId] });
      setModalMode(null);
      setNewName(''); setNewDesc(''); setNewStartDate(''); setNewEndDate('');
    },
  });

  const editPlanMutation = useMutation({
    mutationFn: () =>
      updateClientPlan(activePlanData?.plan?.id ?? '', {
        name: editName || undefined,
        description: editDesc || null,
        startDate: editStartDate || undefined,
        endDate: editEndDate || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-active-plan', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-plans', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-detail', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-activities', clientId] });
      setModalMode(null);
    },
  });

  const toggleDay = (dow: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      next.has(dow) ? next.delete(dow) : next.add(dow);
      return next;
    });
  };

  if (planLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  const activePlan = activePlanData?.plan ?? null;

  function openEdit(plan: ActivePlan) {
    setEditName(plan.name);
    setEditDesc(plan.description ?? '');
    setEditStartDate(plan.startDate ? plan.startDate.substring(0, 10) : '');
    setEditEndDate(plan.endDate ? plan.endDate.substring(0, 10) : '');
    setModalMode('edit');
  }

  return (
    <div className="space-y-6">
      {/* Active plan card */}
      {activePlan ? (
        <ActivePlanCard plan={activePlan} expandedDays={expandedDays} toggleDay={toggleDay} onEdit={() => openEdit(activePlan)} />
      ) : (
        <EmptyPlanCard onOpen={setModalMode} />
      )}

      {/* Plan history */}
      {(historyData?.items?.length ?? 0) > 1 && (
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">Plan geçmişi</h3>
          <div className="space-y-2">
            {historyData!.items.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-2 px-3 rounded-xl border border-border/50 hover:bg-muted/20 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.startDate).toLocaleDateString('tr-TR')}
                    {p.endDate ? ` → ${new Date(p.endDate).toLocaleDateString('tr-TR')}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {p.completedMeals}/{p.mealCount} öğün
                  </span>
                  {p.isActive && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                      Aktif
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Assign / edit modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                {modalMode === 'template' ? 'Şablondan plan ata'
                  : modalMode === 'edit' ? 'Planı düzenle'
                  : 'Yeni plan oluştur'}
              </h3>
              <button
                onClick={() => setModalMode(null)}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Mode tabs — only for assign modes */}
            {modalMode !== 'edit' && (
              <div className="flex gap-2">
                {(['template', 'new'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setModalMode(mode)}
                    className={cn(
                      'flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors',
                      modalMode === mode
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'border-border text-muted-foreground'
                    )}
                  >
                    {mode === 'template' ? 'Şablondan' : 'Yeni plan'}
                  </button>
                ))}
              </div>
            )}

            {modalMode === 'template' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Plan şablonu</label>
                  <select
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                    value={tplSelectedId}
                    onChange={(e) => setTplSelectedId(e.target.value)}
                  >
                    <option value="">Şablon seç...</option>
                    {(templatesData?.templates ?? []).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Plan adı (opsiyonel)"
                  placeholder="Şablon adını kullanır"
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                />
                <Input
                  label="Başlangıç tarihi"
                  type="date"
                  value={tplStartDate}
                  onChange={(e) => setTplStartDate(e.target.value)}
                />
                <Input
                  label="Bitiş tarihi (opsiyonel)"
                  type="date"
                  value={tplEndDate}
                  onChange={(e) => setTplEndDate(e.target.value)}
                />
                <Button
                  variant="action"
                  className="w-full"
                  disabled={!tplSelectedId || !tplStartDate || assignTemplateMutation.isPending}
                  onClick={() => assignTemplateMutation.mutate()}
                >
                  {assignTemplateMutation.isPending ? 'Atanıyor...' : 'Planı ata'}
                </Button>
                {assignTemplateMutation.isError && (
                  <p className="text-xs text-destructive">Plan atama başarısız. Lütfen tekrar deneyin.</p>
                )}
              </>
            )}

            {modalMode === 'new' && (
              <>
                <Input
                  label="Plan adı"
                  placeholder="Örn: Mayıs Dengeli Beslenme"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <Input
                  label="Açıklama (opsiyonel)"
                  placeholder="Kısa notlar..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
                <Input
                  label="Başlangıç tarihi"
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                />
                <Input
                  label="Bitiş tarihi (opsiyonel)"
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                />
                <Button
                  variant="action"
                  className="w-full"
                  disabled={!newName.trim() || !newStartDate || assignNewMutation.isPending}
                  onClick={() => assignNewMutation.mutate()}
                >
                  {assignNewMutation.isPending ? 'Oluşturuluyor...' : 'Planı oluştur'}
                </Button>
                {assignNewMutation.isError && (
                  <p className="text-xs text-destructive">Plan oluşturma başarısız. Lütfen tekrar deneyin.</p>
                )}
              </>
            )}

            {modalMode === 'edit' && (
              <>
                <p className="text-xs text-muted-foreground -mt-1">
                  Sadece değiştirmek istediğiniz alanları doldurun. Boş bırakılan alanlar mevcut değerlerini korur.
                </p>
                <Input
                  label="Plan adı"
                  placeholder="Mevcut adı korumak için boş bırakın"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                <Input
                  label="Açıklama (opsiyonel)"
                  placeholder="Kısa notlar..."
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
                <Input
                  label="Başlangıç tarihi"
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                />
                <Input
                  label="Bitiş tarihi (opsiyonel)"
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                />
                <Button
                  variant="action"
                  className="w-full"
                  disabled={editPlanMutation.isPending}
                  onClick={() => editPlanMutation.mutate()}
                >
                  {editPlanMutation.isPending ? 'Kaydediliyor...' : 'Değişiklikleri kaydet'}
                </Button>
                {editPlanMutation.isError && (
                  <p className="text-xs text-destructive">Güncelleme başarısız. Lütfen tekrar deneyin.</p>
                )}
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function ActivePlanCard({
  plan,
  expandedDays,
  toggleDay,
  onEdit,
}: {
  plan: ActivePlan;
  expandedDays: Set<number>;
  toggleDay: (dow: number) => void;
  onEdit: () => void;
}) {
  const mealsByDay = plan.meals.reduce<Record<number, typeof plan.meals>>((acc, m) => {
    if (!acc[m.dayOfWeek]) acc[m.dayOfWeek] = [];
    acc[m.dayOfWeek].push(m);
    return acc;
  }, {});

  const progressPct = plan.completionPercent;

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                ● Aktif plan
              </span>
            </div>
            <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
            {plan.description && <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>}
            <p className="text-xs text-muted-foreground mt-2">
              {new Date(plan.startDate).toLocaleDateString('tr-TR')}
              {plan.endDate ? ` → ${new Date(plan.endDate).toLocaleDateString('tr-TR')}` : ' (açık uçlu)'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground">{progressPct.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">tamamlandı</p>
            </div>
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all"
            >
              <Pencil className="w-3 h-3" />
              Düzenle
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-2 rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, progressPct)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{plan.completedMeals} tamamlandı</span>
          <span>{plan.totalMeals} toplam öğün</span>
        </div>
      </Card>

      {/* Meals by day */}
      {Object.keys(mealsByDay).length > 0 && (
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">Haftalık öğün planı</h3>
          <div className="space-y-2">
            {Object.entries(mealsByDay).map(([dowStr, meals]) => {
              const dow = parseInt(dowStr);
              const isExpanded = expandedDays.has(dow);
              const completedCount = meals.filter((m) => m.isCompleted).length;
              return (
                <div key={dow} className="rounded-xl border border-border overflow-hidden">
                  <button
                    onClick={() => toggleDay(dow)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 text-xs font-semibold text-muted-foreground">{meals[0].dayName}</span>
                      <span className="text-sm font-medium text-foreground">{meals.length} öğün</span>
                      {completedCount > 0 && (
                        <span className="text-xs text-primary font-semibold">{completedCount} tamamlandı</span>
                      )}
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 space-y-2 border-t border-border/50">
                      {meals.map((meal) => (
                        <div key={meal.id} className="flex items-center gap-3 py-1.5">
                          {meal.isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-border flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm text-foreground">{meal.recipe?.name ?? 'Tarif bağlı değil'}</p>
                            <p className="text-xs text-muted-foreground">
                              {MEAL_TYPE_LABELS[meal.mealType] ?? meal.mealType} · {meal.servings} porsiyon
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function EmptyPlanCard({ onOpen }: { onOpen: (mode: ModalMode) => void }) {
  return (
    <Card className="p-10">
      <div className="text-center mb-8">
        <Calendar className="w-14 h-14 mx-auto mb-4 text-muted-foreground/40" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Aktif plan yok</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Bu danışana henüz aktif bir beslenme planı atanmamış. Aşağıdan bir yöntem seçin.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
        <button
          onClick={() => onOpen('template')}
          className="flex flex-col items-center gap-2 p-5 rounded-2xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all group"
        >
          <LayoutTemplate className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
          <p className="text-sm font-semibold text-foreground">Şablondan ata</p>
          <p className="text-xs text-muted-foreground text-center">Kayıtlı şablonlardan hızlıca uygula</p>
        </button>
        <button
          onClick={() => onOpen('new')}
          className="flex flex-col items-center gap-2 p-5 rounded-2xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all group"
        >
          <PlusCircle className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
          <p className="text-sm font-semibold text-foreground">Yeni plan oluştur</p>
          <p className="text-xs text-muted-foreground text-center">Sıfırdan bir plan oluştur ve ata</p>
        </button>
      </div>
    </Card>
  );
}
