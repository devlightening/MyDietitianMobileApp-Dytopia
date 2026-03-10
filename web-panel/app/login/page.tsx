import { redirect } from 'next/navigation';

export default function LoginAliasPage() {
  // Server-side redirect /login to /auth/login for compatibility
  redirect('/auth/login');
}
