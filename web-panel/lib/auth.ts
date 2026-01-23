// Server-only: check if an access_token cookie exists
export function isAuthenticatedServer(): boolean {
  const { cookies } = require('next/headers');
  const token = cookies().get('access_token');
  return !!token;
}

// Client: perform logout by calling backend to clear HttpOnly cookie
export async function logout(): Promise<void> {
  const api = (await import('./api')).default;
  try {
    // Call backend logout endpoint with credentials to clear cookie
    await api.post('/api/auth/logout', {});
    // Redirect to login page
    window.location.href = '/auth/login';
  } catch (error) {
    console.error('Logout failed:', error);
    // Force redirect anyway
    window.location.href = '/auth/login';
  }
}
