// Server-only: check if an access_token cookie exists
export function isAuthenticatedServer(): boolean {
  const { cookies } = require('next/headers');
  const token = cookies().get('access_token');
  return !!token;
}

// Client: perform logout by calling backend to clear HttpOnly cookie
// Returns true if logout was successful, false otherwise
// Components should handle redirect using router.replace() and router.refresh()
export async function logout(): Promise<boolean> {
  const api = (await import('./api')).default;
  try {
    // Call backend logout endpoint with credentials to clear cookie
    await api.post('/api/auth/logout', {});
    return true;
  } catch (error) {
    console.error('Logout failed:', error);
    return false;
  }
}
