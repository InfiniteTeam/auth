/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  allowedDevOrigins: ['testdev2.kho.kr'],
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
