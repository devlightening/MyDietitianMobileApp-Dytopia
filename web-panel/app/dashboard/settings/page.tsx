import { redirect } from 'next/navigation';

// Redirect old settings page to new branding page
export default function OldSettingsPage() {
  redirect('/dashboard/settings/branding');
}
