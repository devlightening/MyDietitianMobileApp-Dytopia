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
  latestWeight?: number;
  latestHeight?: number;
  latestBmi?: number;
  latestBmr?: number;
}

export interface ClientMeasurement {
  id: string;
  weightKg: number;
  heightCm: number;
  bmi: number;
  bmr: number;
  createdAt: string;
}

export interface ClientActivity {
  id: string;
  type: 'meal_logged' | 'weight_update' | 'login' | 'plan_assigned';
  timestamp: string;
  metadata?: {
    mealName?: string;
    weight?: number;
    planName?: string;
    isCompliant?: boolean;
  };
}

export interface ClientNote {
  id: string;
  content: string;
  createdAt: string;
  createdBy: string;
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
  const res = await api.post(`/api/dietitian/clients/${clientId}/notes`, { content });
  return res.data;
}
