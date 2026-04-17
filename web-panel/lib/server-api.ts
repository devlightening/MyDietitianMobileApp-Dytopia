/**
 * Get the internal API base URL for server-side requests (Next.js API routes).
 *
 * Resolution order:
 *   1. INTERNAL_API_BASE_URL  — explicit server-to-server override (optional)
 *   2. NEXT_PUBLIC_API_BASE_URL — shared public env var, always set in production
 *   3. http://127.0.0.1:5000 — local dev fallback
 *
 * In production on Vercel, INTERNAL_API_BASE_URL is typically not set while
 * NEXT_PUBLIC_API_BASE_URL always is, so this order ensures proxy routes reach
 * the real backend instead of defaulting to unreachable localhost.
 */
export function getInternalApiBaseUrl(): string {
  return (
    process.env.INTERNAL_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'http://127.0.0.1:5000'
  );
}

/**
 * Get the public API base URL for client-side requests (browser)
 * Uses HTTP in development to avoid SSL certificate errors
 */
export function getPublicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:5000';
}
