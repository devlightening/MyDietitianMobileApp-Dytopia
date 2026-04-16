import api from '../api';

export interface Client {
  id: string;
  fullName: string;
  email: string;
  publicUserId: string;
  isPremium: boolean;
  premiumActivatedAt?: string;
  premiumExpiresAt?: string;
  activeDietitianId?: string;
}

export interface ClientDetail extends Client {
  gender: number;
  birthDate: string;
  compliancePercent?: number;
  latestWeight?: number | null;
  latestHeight?: number | null;
  latestBmi?: number | null;
  latestBmr?: number | null;
  lastMeasurementDate?: string | null;
  activePlanId?: string | null;
  activePlanName?: string | null;
  activePlanStartDate?: string | null;
  activePlanEndDate?: string | null;
  linkedAt?: string;
  programStartDate?: string | null;
  programEndDate?: string | null;
}

export interface ActivePlanMeal {
  id: string;
  dayOfWeek: number;
  dayName: string;
  mealType: string;
  servings: number;
  isCompleted: boolean;
  recipe?: { id: string; name: string } | null;
}

export interface ActivePlan {
  id: string;
  name: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
  totalMeals: number;
  completedMeals: number;
  completionPercent: number;
  meals: ActivePlanMeal[];
}

export interface PlanTemplate {
  id: string;
  name: string;
  description?: string | null;
  itemCount?: number;
}

export interface ClientMeasurement {
  id: string;
  recordedAtUtc: string;
  sourceType: 'client' | 'dietitian' | 'smart_scale' | 'system';
  weightKg?: number | null;
  heightCm?: number | null;
  bodyFatPercent?: number | null;
  musclePercent?: number | null;
  waterPercent?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  chestCm?: number | null;
  bmi?: number | null;
  bmiCategory?: string | null;
  bmr?: number | null;
  waistHipRatio?: number | null;
  notes?: string | null;
  isClinicallyVerified: boolean;
}

export interface DietitianMeasurementPayload {
  weightKg?: number | null;
  heightCm?: number | null;
  bodyFatPercent?: number | null;
  musclePercent?: number | null;
  waterPercent?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  chestCm?: number | null;
  notes?: string | null;
  isClinicallyVerified?: boolean;
  recordedAtUtc?: string | null;
}

export interface ClientActivity {
  id: string;
  type:
    | 'meal_logged'
    | 'weight_update'
    | 'login'
    | 'plan_assigned'
    | 'badge_unlocked'
    | 'streak_milestone'
    | 'streak_at_risk'
    | 'compliance';
  timestamp: string;
  metadata?: {
    mealName?: string;
    weight?: number;
    planName?: string;
    isCompliant?: boolean;
    badgeId?: string;
    currentStreak?: number;
  };
}

export interface ClientNote {
  id: string;
  content: string;
  createdAt: string;
  createdBy: string;
}

export interface CareTimelineItem {
  id: string;
  kind: 'dietitian_note' | 'client_message' | 'dietitian_reply';
  author: string;
  direction: 'inbound' | 'outbound';
  text: string;
  createdAtUtc: string;
  isRead: boolean;
}

export interface ClientAppointment {
  id: string;
  title: string;
  scheduledAtUtc: string;
  mode: string;
  location?: string | null;
  note?: string | null;
  attendanceStatus?: 'pending' | 'attended' | 'missed';
  attendanceMarkedAtUtc?: string | null;
}

export interface ClientCareHubResponse {
  client: {
    id: string;
    fullName: string;
    email: string;
    publicUserId: string;
  };
  appointments: ClientAppointment[];
  items: CareTimelineItem[];
}

// Query parameters for clients list
export interface ClientsQueryParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: 'premium' | 'free';
  expiringSoon?: boolean;
  lowCompliance?: boolean;
  sortBy?: 'lastActivity' | 'name' | 'endDate';
  sortDir?: 'asc' | 'desc';
}

// Client row for table display
export interface ClientRow {
  clientId: string;
  publicUserId: string;
  fullName: string;
  email: string;
  isPremium: boolean;
  premiumEndDate?: string;
  daysRemaining?: number; // Days until premium expires
  compliancePercent: number;
  lastActivityAt?: string;
  hasActivePlan: boolean; // Has an active meal plan assigned
  linkedAt: string;
}

// Paged response
export interface ClientsPagedResponse {
  items: ClientRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Get paginated list of clients with search and filtering
 */
export async function getClients(params: ClientsQueryParams): Promise<ClientsPagedResponse> {
  const res = await api.get('/api/dietitian/clients', { params });
  return res.data;
}

/**
 * Get detailed information for a specific client by ID
 * IDOR protected - only returns clients linked to authenticated dietitian
 */
export async function getClientById(clientId: string): Promise<ClientDetail> {
  const res = await api.get(`/api/dietitian/clients/${clientId}`);
  return res.data;
}

/**
 * Get client measurements history
 */
export async function getClientMeasurements(
  clientId: string,
  lastNDays?: number
): Promise<{ measurements: ClientMeasurement[] }> {
  const params = lastNDays ? { lastNDays } : {};
  const res = await api.get(`/api/dietitian/clients/${clientId}/measurements`, { params });
  return res.data;
}

/**
 * Get the active meal plan for a client with full meal detail
 */
export async function getClientActivePlan(clientId: string): Promise<{ plan: ActivePlan | null }> {
  const res = await api.get(`/api/dietitian/clients/${clientId}/active-plan`);
  return res.data;
}

/**
 * Get all meal plans for a client (history)
 */
export async function getClientPlans(clientId: string): Promise<{ items: { id: string; name: string; isActive: boolean; startDate: string; endDate?: string; mealCount: number; completedMeals: number }[] }> {
  const res = await api.get(`/api/dietitian/plans/clients/${clientId}`);
  return res.data;
}

/**
 * Create and assign a new plan to a client from scratch
 */
export async function assignNewPlan(
  clientId: string,
  payload: { name: string; description?: string; startDate: string; endDate?: string; meals: { recipeId: string; dayOfWeek: number; mealType: string; servings: number }[] }
): Promise<{ id: string; name: string }> {
  const res = await api.post(`/api/dietitian/plans/clients/${clientId}/assign`, payload);
  return res.data;
}

/**
 * Assign a plan from an existing template
 */
export async function assignFromTemplate(
  clientId: string,
  payload: { templateId: string; startDate: string; endDate?: string; name?: string; deactivateCurrent?: boolean }
): Promise<{ id: string; name: string; mealsCreated: number }> {
  const res = await api.post(`/api/dietitian/plans/clients/${clientId}/assign-from-template`, payload);
  return res.data;
}

/**
 * Get all plan templates owned by the dietitian
 */
export async function getPlanTemplates(): Promise<{ templates: PlanTemplate[] }> {
  const res = await api.get('/api/dietitian/plan-templates');
  return res.data;
}

/**
 * Update name/description/dates of an existing client meal plan
 */
export async function updateClientPlan(
  planId: string,
  payload: { name?: string; description?: string | null; startDate?: string; endDate?: string | null }
): Promise<{ id: string; name: string; description?: string | null; startDate: string; endDate?: string | null }> {
  const res = await api.patch(`/api/dietitian/plans/${planId}`, payload);
  return res.data;
}

/**
 * Add a clinical measurement entry for a client (dietitian)
 */
export async function addClientMeasurement(
  clientId: string,
  payload: DietitianMeasurementPayload
): Promise<{ measurement: ClientMeasurement }> {
  const res = await api.post(`/api/dietitian/clients/${clientId}/measurements`, payload);
  return res.data;
}

/**
 * Update an existing clinical measurement entry (dietitian)
 */
export async function updateClientMeasurement(
  clientId: string,
  measurementId: string,
  payload: DietitianMeasurementPayload
): Promise<{ measurement: ClientMeasurement }> {
  const res = await api.put(`/api/dietitian/clients/${clientId}/measurements/${measurementId}`, payload);
  return res.data;
}

/**
 * Get client activities timeline
 */
export async function getClientActivities(clientId: string): Promise<{ activities: ClientActivity[] }> {
  const res = await api.get(`/api/dietitian/clients/${clientId}/activities`);
  return res.data;
}

/**
 * Get client notes
 */
export async function getClientNotes(clientId: string): Promise<{ notes: ClientNote[] }> {
  const res = await api.get(`/api/dietitian/clients/${clientId}/notes`);
  return res.data;
}

/**
 * Add a new note for a client
 */
export async function addClientNote(clientId: string, content: string): Promise<ClientNote> {
  const res = await api.post(`/api/dietitian/clients/${clientId}/notes`, { text: content, content });
  return res.data;
}

export async function getClientCareHub(clientId: string): Promise<ClientCareHubResponse> {
  const res = await api.get(`/api/dietitian/clients/${clientId}/care`);
  return res.data;
}

export async function addClientCareNote(
  clientId: string,
  text: string,
): Promise<{ item: CareTimelineItem }> {
  const res = await api.post(`/api/dietitian/clients/${clientId}/care/notes`, { text, content: text });
  return res.data;
}

export async function sendClientCareReply(
  clientId: string,
  text: string,
): Promise<{ item: CareTimelineItem }> {
  const res = await api.post(`/api/dietitian/clients/${clientId}/care/replies`, { text });
  return res.data;
}

export async function createClientAppointment(
  clientId: string,
  payload: {
    title: string;
    scheduledAtUtc: string;
    mode: string;
    location?: string;
    note?: string;
  },
): Promise<{ item: ClientAppointment }> {
  const res = await api.post(`/api/dietitian/clients/${clientId}/care/appointments`, payload);
  return res.data;
}

export async function cancelClientAppointment(clientId: string, appointmentId: string): Promise<void> {
  await api.delete(`/api/dietitian/clients/${clientId}/care/appointments/${appointmentId}`);
}
