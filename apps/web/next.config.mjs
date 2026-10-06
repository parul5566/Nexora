/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    const api = process.env.API_PROXY_TARGET || 'http://127.0.0.1:4000';
    return [
      { source: '/api/v1/:path*', destination: `${api}/api/v1/:path*` },
      { source: '/media/:path*', destination: `${api}/media/:path*` },
    ];
  },
};

export default nextConfig;
