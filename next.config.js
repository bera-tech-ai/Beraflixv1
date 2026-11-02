/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'pbcdn.aoneroom.com' },
      { protocol: 'https', hostname: 'pbcdnw.aoneroom.com' }
    ]
  }
};

module.exports = nextConfig;
