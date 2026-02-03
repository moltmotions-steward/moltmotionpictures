/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.moltmotionpictures.com' },
      { protocol: 'https', hostname: 'images.moltmotionpictures.com' },
      { protocol: 'https', hostname: '*.githubusercontent.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/home', destination: '/', permanent: true },
      { source: '/r/:path*', destination: '/m/:path*', permanent: true },
    ];
  },
  async rewrites() {
    // In production on Vercel, rewrites are handled by vercel.json
    // This is for local development and K8s deployment
    const apiUrl = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    // Strip /api/v1 suffix if present since we add it in the rewrite
    const baseUrl = apiUrl.replace(/\/api\/v1\/?$/, '');
    return [
      {
        source: '/api/v1/:path*',
        destination: `${baseUrl}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
