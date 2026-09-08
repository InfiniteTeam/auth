/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/.kratos/:path*',
        destination: '/api/kratos/:path*',
      },
    ];
  },
};

export default nextConfig;