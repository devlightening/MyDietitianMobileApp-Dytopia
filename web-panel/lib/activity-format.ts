export type ActivityType =
  | 'client_linked'
  | 'login'
  | 'meal_logged'
  | 'meal_done'
  | 'meal_selection'
  | 'meal_recipe_selected'
  | 'meal_feedback'
  | 'meal_feedback_saved'
  | 'meal_alternative'
  | 'meal_skipped'
  | 'kitchen_used'
  | 'shopping_list'
  | 'pantry'
  | 'notification_preferences'
  | 'water_goal_hit'
  | 'measurement_logged'
  | 'weight_update'
  | 'plan_assigned'
  | 'plan_updated'
  | 'compliance'
  | 'badge_unlocked'
  | 'streak_milestone'
  | 'streak_at_risk';

export type ActivityCategory =
  | 'plan'
  | 'meals'
  | 'kitchen'
  | 'shopping'
  | 'pantry'
  | 'notifications'
  | 'water'
  | 'measurements'
  | 'badges'
  | 'other';

export type ActivityMetadata = Record<string, unknown> & {
  note?: string;
  weight?: number;
  weightKg?: number;
  bmi?: number;
  mealName?: string;
  mealTitle?: string;
  mealType?: string;
  mealTime?: string;
  planName?: string;
  isCompliant?: boolean;
  badgeId?: string;
  currentStreak?: number;
  glasses?: number;
  recipeName?: string;
  plannedRecipeName?: string;
  selectedRecipeName?: string;
  selectedRecipeSource?: string;
  completedRecipeId?: string;
  completedRecipeName?: string;
  completedRecipeSource?: string;
  alternativeRecipeName?: string;
  feedbackKey?: string;
  feedbackLabel?: string;
  generatedCount?: number;
  recipeCount?: number;
  mealCount?: number;
  mandatoryCount?: number;
  optionalCount?: number;
  flavoringCount?: number;
  pantryCoveredCount?: number;
  selectedAlternativeCount?: number;
  activeCount?: number;
  addedCount?: number;
  updatedCount?: number;
  removedCount?: number;
  ingredientName?: string;
  title?: string;
  count?: number;
  sourceType?: string;
  notificationsEnabled?: boolean;
  inAppCoachNotificationsEnabled?: boolean;
  achievementNotificationsEnabled?: boolean;
  pantryActivityNotificationsEnabled?: boolean;
};

export function parseActivityMetadata(input: unknown): ActivityMetadata {
  if (!input) return {};
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return parsed && typeof parsed === 'object' ? (parsed as ActivityMetadata) : {};
    } catch {
      return {};
    }
  }
  return typeof input === 'object' ? (input as ActivityMetadata) : {};
}

export function getActivityCategory(type: string): ActivityCategory {
  switch (type) {
    case 'plan_assigned':
    case 'plan_updated':
    case 'meal_selection':
    case 'meal_recipe_selected':
      return 'plan';
    case 'meal_logged':
    case 'meal_done':
    case 'meal_feedback':
    case 'meal_feedback_saved':
    case 'meal_alternative':
    case 'meal_skipped':
      return 'meals';
    case 'kitchen_used':
      return 'kitchen';
    case 'shopping_list':
      return 'shopping';
    case 'pantry':
      return 'pantry';
    case 'notification_preferences':
      return 'notifications';
    case 'water_goal_hit':
      return 'water';
    case 'measurement_logged':
    case 'weight_update':
      return 'measurements';
    case 'badge_unlocked':
    case 'streak_milestone':
    case 'streak_at_risk':
      return 'badges';
    default:
      return 'other';
  }
}

export function getActivityTitle(type: string): string {
  switch (type) {
    case 'client_linked':
      return 'Danışan bağlandı';
    case 'login':
      return 'Uygulamaya giriş';
    case 'meal_logged':
    case 'meal_done':
      return 'Öğün tamamlandı';
    case 'meal_selection':
    case 'meal_recipe_selected':
      return 'Aktif tarif seçimi';
    case 'meal_feedback':
    case 'meal_feedback_saved':
      return 'Öğün değerlendirildi';
    case 'meal_alternative':
      return 'Alternatif öğün tamamlandı';
    case 'meal_skipped':
      return 'Öğün atlandı';
    case 'kitchen_used':
      return 'Mutfak kullanıldı';
    case 'shopping_list':
      return 'Alışveriş listesi';
    case 'pantry':
      return 'Dolabım güncellendi';
    case 'notification_preferences':
      return 'Bildirim tercihleri';
    case 'water_goal_hit':
      return 'Su hedefi';
    case 'measurement_logged':
      return 'Ölçüm kaydedildi';
    case 'weight_update':
      return 'Kilo güncellendi';
    case 'plan_assigned':
      return 'Plan atandı';
    case 'plan_updated':
      return 'Plan güncellendi';
    case 'badge_unlocked':
      return 'Rozet kazanıldı';
    case 'streak_milestone':
      return 'Seri başarısı';
    case 'streak_at_risk':
      return 'Seri risk altında';
    case 'compliance':
      return 'Günlük uyum';
    default:
      return 'Aktivite';
  }
}

export function getActivityDescription(type: string, rawMeta: unknown): string {
  const meta = parseActivityMetadata(rawMeta);
  const mealTitle = asText(meta.mealTitle) || asText(meta.mealName);
  const selectedRecipeName =
    asText(meta.selectedRecipeName) || asText(meta.alternativeRecipeName) || asText(meta.recipeName);
  const completedRecipeName = asText(meta.completedRecipeName) || selectedRecipeName;
  const completedSource = asText(meta.completedRecipeSource);

  switch (type) {
    case 'client_linked':
      return asText(meta.note) || 'kliniğe bağlandı';
    case 'login':
      return 'uygulamaya giriş yaptı';
    case 'meal_logged':
    case 'meal_done':
      return mealTitle
        ? `${mealTitle} için planlanan tarifi tamamladı${completedRecipeName ? `: ${completedRecipeName}` : ''}`
        : `planlanan tarifi tamamladı${completedRecipeName ? `: ${completedRecipeName}` : ''}`;
    case 'meal_selection':
    case 'meal_recipe_selected':
      if (asText(meta.selectedRecipeSource) === 'Alternative') {
        return `${mealTitle ? `${mealTitle} için ` : ''}${selectedRecipeName || 'alternatif tarif'} seçildi`;
      }
      return `${mealTitle ? `${mealTitle} için ` : ''}planlanan tarife dönüldü`;
    case 'meal_feedback':
    case 'meal_feedback_saved':
      return `${mealTitle || 'Öğün'} için ${completedSource === 'Alternative' ? 'alternatif tarif' : 'planlanan tarif'} değerlendirildi: ${feedbackLabel(meta)}`;
    case 'meal_alternative':
      return completedRecipeName
        ? `alternatif tarifle tamamladı: ${completedRecipeName}`
        : mealTitle
        ? `${mealTitle} için alternatif öğün tamamladı`
        : 'alternatif öğün tamamladı';
    case 'meal_skipped':
      return mealTitle ? `${mealTitle} atlandı` : 'bir öğünü atladı';
    case 'kitchen_used':
      return selectedRecipeName
        ? `mutfakta tarif aradı: ${selectedRecipeName}`
        : `mutfakta tarif aradı${asNumber(meta.totalResults) != null ? ` (${asNumber(meta.totalResults)} sonuç)` : ''}`;
    case 'shopping_list':
      return shoppingSummary(meta);
    case 'pantry':
      return pantrySummary(meta);
    case 'notification_preferences':
      return `bildirim ayarlarını güncelledi (${asBool(meta.notificationsEnabled) === false ? 'genel kapalı' : 'genel açık'})`;
    case 'water_goal_hit':
      return asNumber(meta.glasses) != null ? `${asNumber(meta.glasses)} bardak su içti` : 'su hedefine ulaştı';
    case 'measurement_logged':
    case 'weight_update': {
      const weight = asNumber(meta.weight) ?? asNumber(meta.weightKg);
      return weight != null ? `ölçüm kaydetti: ${weight} kg${asNumber(meta.bmi) ? `, BMI ${asNumber(meta.bmi)}` : ''}` : 'ölçüm kaydetti';
    }
    case 'plan_assigned':
      return asText(meta.planName) ? `plana atandı: ${asText(meta.planName)}` : 'yeni plana atandı';
    case 'plan_updated':
      return asText(meta.planName) ? `plan güncellendi: ${asText(meta.planName)}` : 'plan güncellendi';
    case 'badge_unlocked':
      return 'yeni bir rozet kazandı';
    case 'streak_milestone':
      return `${asNumber(meta.currentStreak) || 0} günlük seri seviyesine ulaştı`;
    case 'streak_at_risk':
      return 'günlük ritim zayıflıyor';
    case 'compliance':
      return asBool(meta.isCompliant) ? 'günlük plan tamamlandı' : 'günlük uyum eksik';
    default:
      return 'bir hareket gerçekleştirdi';
  }
}

export function getActivityDetails(type: string, rawMeta: unknown): string[] {
  const meta = parseActivityMetadata(rawMeta);
  const details: string[] = [];

  if (meta.mealTime) details.push(`Saat ${meta.mealTime}`);
  if (meta.mealType) details.push(String(meta.mealType));

  if (type === 'meal_selection' || type === 'meal_recipe_selected') {
    if (meta.plannedRecipeName) details.push(`Planlanan: ${meta.plannedRecipeName}`);
    if (meta.selectedRecipeName) details.push(`Seçilen: ${meta.selectedRecipeName}`);
    if (meta.selectedRecipeSource === 'Alternative') details.push('Alternatif tercih');
  }

  if (type === 'meal_done' || type === 'meal_alternative' || type === 'meal_feedback' || type === 'meal_feedback_saved') {
    const completedSource = asText(meta.completedRecipeSource);
    const completedRecipeName = asText(meta.completedRecipeName);
    if (completedSource) details.push(completedSource === 'Alternative' ? 'Alternatif tarif' : 'Planlanan tarif');
    if (completedRecipeName) details.push(`Tamamlanan: ${completedRecipeName}`);
  }

  if (type === 'meal_feedback' || type === 'meal_feedback_saved') {
    details.push(feedbackLabel(meta));
  }

  if (type === 'shopping_list') {
    pushNumber(details, meta.generatedCount, 'eksik malzeme');
    pushNumber(details, meta.pantryCoveredCount, 'dolapta var');
    pushNumber(details, meta.selectedAlternativeCount, 'alternatif tarif');
    pushCategoryCounts(details, meta);
  }

  if (type === 'pantry') {
    const sourceLabel = pantrySourceLabel(meta);
    if (sourceLabel) details.push(sourceLabel);
    pushNumber(details, meta.activeCount, 'aktif ürün');
    pushNumber(details, meta.addedCount, 'eklenen');
    pushNumber(details, meta.updatedCount, 'güncellenen');
    pushNumber(details, meta.removedCount, 'çıkarılan');
    if (meta.ingredientName) details.push(String(meta.ingredientName));
  }

  if (type === 'notification_preferences') {
    details.push(asBool(meta.achievementNotificationsEnabled) === false ? 'Kazanımlar kapalı' : 'Kazanımlar açık');
    details.push(asBool(meta.pantryActivityNotificationsEnabled) === false ? 'Dolap bildirimleri kapalı' : 'Dolap bildirimleri açık');
    details.push(asBool(meta.inAppCoachNotificationsEnabled) === false ? 'Koç bildirimleri kapalı' : 'Koç bildirimleri açık');
  }

  if (type === 'kitchen_used') {
    pushNumber(details, meta.totalResults, 'sonuç');
    pushNumber(details, meta.clinicResults, 'klinik tarifi');
    pushNumber(details, meta.missingMandatoryCount, '1 eksikli tarif');
  }

  return details.filter(Boolean).slice(0, 6);
}

function shoppingSummary(meta: ActivityMetadata): string {
  const source = asText(meta.sourceType);
  const title = asText(meta.title);
  const generatedCount = asNumber(meta.generatedCount);
  const count = asNumber(meta.count);

  if (generatedCount != null) {
    if (generatedCount === 0) return 'bugünün planından üretildi; eksik malzeme görünmüyor';
    return `bugünün planından ${generatedCount} eksik malzeme çıkardı`;
  }

  if (title) return `${title} alışveriş listesinde güncellendi`;
  if (count != null) return `${count} malzeme alışveriş listesine eklendi${source ? ` (${source})` : ''}`;
  return 'alışveriş listesini güncelledi';
}

function pantrySummary(meta: ActivityMetadata): string {
  const ingredientName = asText(meta.ingredientName);
  if (ingredientName) return `${ingredientName} dolaptan çıkarıldı`;

  const added = asNumber(meta.addedCount) || 0;
  const updated = asNumber(meta.updatedCount) || 0;
  const removed = asNumber(meta.removedCount) || 0;
  const active = asNumber(meta.activeCount);
  const source = asText(meta.sourceType);
  const sourcePrefix = source === 'barcode'
    ? 'barkodla dolabını güncelledi'
    : source === 'receipt'
      ? 'fiş taramasıyla dolabını güncelledi'
      : source === 'photo'
        ? 'fotoğraf taramasıyla dolabını güncelledi'
        : 'dolabını güncelledi';

  return `${sourcePrefix}${active != null ? `: ${active} aktif ürün` : ''}${added || updated || removed ? ` (${added} eklenen, ${updated} güncellenen, ${removed} çıkarılan)` : ''}`;
}

function pantrySourceLabel(meta: ActivityMetadata): string | null {
  switch (asText(meta.sourceType)) {
    case 'barcode':
      return 'Barkod tarama';
    case 'receipt':
      return 'Fiş tarama';
    case 'photo':
      return 'Fotoğraf tarama';
    default:
      return null;
  }
}

function feedbackLabel(meta: ActivityMetadata): string {
  if (asText(meta.feedbackLabel)) return asText(meta.feedbackLabel)!;
  switch (asText(meta.feedbackKey)) {
    case 'filling':
      return 'Tok tuttu';
    case 'light':
      return 'Hafif geldi';
    case 'again':
      return 'Tekrar isterim';
    case 'hard':
      return 'Zor hazırlandı';
    default:
      return 'Değerlendirildi';
  }
}

function pushCategoryCounts(details: string[], meta: ActivityMetadata) {
  const mandatory = asNumber(meta.mandatoryCount);
  const optional = asNumber(meta.optionalCount);
  const flavoring = asNumber(meta.flavoringCount);
  if (mandatory != null) details.push(`${mandatory} zorunlu`);
  if (optional != null) details.push(`${optional} opsiyonel`);
  if (flavoring != null) details.push(`${flavoring} lezzetlendirici`);
}

function pushNumber(details: string[], value: unknown, label: string) {
  const number = asNumber(value);
  if (number != null) details.push(`${number} ${label}`);
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asBool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}
