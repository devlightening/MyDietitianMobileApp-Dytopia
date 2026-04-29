import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const api =
      process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:5000'

    return [
      // Forward /uploads to backend for static files (logos, etc.)
      {
        source: '/uploads/:path*',
        destination: `${api}/uploads/:path*`,
      },
      // Forward API requests to backend
      {
        source: '/api/:path*',
        destination: `${api}/api/:path*`,
      },
      // Forward SignalR hub (HTTP negotiate + WebSocket upgrade)
      {
        source: '/hubs/:path*',
        destination: `${api}/hubs/:path*`,
      },
    ]
  },

  async redirects() {
    return [
      { source: '/login', destination: '/auth/login', permanent: false },
      { source: '/register', destination: '/auth/register', permanent: false },
      { source: '/access-key', destination: '/auth/client-access', permanent: false },
    ]
  },
}

export default withNextIntl(nextConfig);
