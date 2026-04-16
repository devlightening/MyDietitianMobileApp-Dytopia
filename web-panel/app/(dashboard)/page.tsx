import { redirect } from 'next/navigation';

// This route group exists to apply ServerGuard + AppLayout to authenticated routes.
// The root URL (/) is served by app/page.tsx (marketing landing page).
// Authenticated users entering the dashboard always land at /dashboard.
export default function DashboardGroupRoot() {
  redirect('/dashboard');
}

