import api from '../api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface TemplateSummary {
  id: string;
  name: string;
  description?: string;
  itemCount: number;
  createdAtUtc: string;
}

export interface TemplateItemDetail {
  id: string;
  time: string;         // "HH:mm"
  mealType: string;
  title: string;
  note?: string;
  calories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  recipeId?: string;
  orderIndex: number;
}

export interface TemplateDetail {
  id: string;
  name: string;
  description?: string;
  items: TemplateItemDetail[];
  createdAtUtc: string;
}

export interface TemplateItemInput {
  time: string;
  mealType: string;
  title: string;
  note?: string;
  calories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  recipeId?: string;
  orderIndex: number;
}

// ── API functions ───────────────────────────────────────────────────────────

export async function listTemplates(): Promise<TemplateSummary[]> {
  const res = await api.get('/api/dietitian/plan-templates');
  return res.data.templates as TemplateSummary[];
}

export async function getTemplate(templateId: string): Promise<TemplateDetail> {
  const res = await api.get(`/api/dietitian/plan-templates/${templateId}`);
  return res.data as TemplateDetail;
}

export async function createTemplate(data: {
  name: string;
  description?: string;
  items: TemplateItemInput[];
}): Promise<TemplateDetail> {
  const res = await api.post('/api/dietitian/plan-templates', data);
  return res.data as TemplateDetail;
}

export async function createTemplateFromPlan(data: {
  planId: string;
  name: string;
  description?: string;
}): Promise<TemplateDetail> {
  const res = await api.post('/api/dietitian/plan-templates/from-plan', data);
  return res.data as TemplateDetail;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  await api.delete(`/api/dietitian/plan-templates/${templateId}`);
}

export async function applyTemplate(
  clientId: string,
  data: { templateId: string; targetDate: string }
): Promise<object> {
  const res = await api.post(
    `/api/dietitian/daily-plans/clients/${clientId}/apply-template`,
    data
  );
  return res.data;
}
