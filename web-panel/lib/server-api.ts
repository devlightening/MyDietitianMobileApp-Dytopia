/**
 * Get the internal API base URL for server-side requests (Next.js API routes)
 * Uses HTTP to avoid self-signed certificate errors in development
 */
export function getInternalApiBaseUrl(): string {
  return process.env.INTERNAL_API_BASE_URL || 'http://127.0.0.1:5000';
}

/**
 * Get the public API base URL for client-side requests (browser)
 * Uses HTTP in development to avoid SSL certificate errors
 */
export function getPublicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:5000';
}
