import api from '../api';

export interface DietitianAppointment {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  scheduledAtUtc: string;
  mode: string;
  location?: string | null;
  note?: string | null;
  attendanceStatus: 'pending' | 'attended' | 'missed';
  isCancelled: boolean;
}

export interface AppointmentPayload {
  title: string;
  scheduledAtUtc: string;
  mode: string;
  location?: string;
  note?: string;
}

export async function getDietitianAppointments(params?: {
  from?: string;
  to?: string;
  clientId?: string;
  limit?: number;
}): Promise<DietitianAppointment[]> {
  const res = await api.get('/api/dietitian/appointments', { params });
  return res.data?.items ?? [];
}

export async function createAppointment(
  clientId: string,
  payload: AppointmentPayload,
): Promise<DietitianAppointment> {
  const res = await api.post(
    `/api/dietitian/clients/${clientId}/care/appointments`,
    payload,
  );
  return res.data?.item ?? res.data;
}

export async function updateAppointment(
  clientId: string,
  appointmentId: string,
  payload: AppointmentPayload,
): Promise<DietitianAppointment> {
  const res = await api.put(
    `/api/dietitian/clients/${clientId}/care/appointments/${appointmentId}`,
    payload,
  );
  return res.data?.item ?? res.data;
}

export async function cancelAppointment(
  clientId: string,
  appointmentId: string,
): Promise<void> {
  await api.delete(
    `/api/dietitian/clients/${clientId}/care/appointments/${appointmentId}`,
  );
}
