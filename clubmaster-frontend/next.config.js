/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['firebase'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        pathname: '**',
      },
    ],
  },
  // Add redirects to replace the functionality of middleware.ts
  async redirects() {
    return [
      {
        source: '/clubs',
        destination: '/club/clubs',
        permanent: true,
      },
    ];
  },
  webpack: (config) => {
    // This is required for Firebase to work properly
    config.resolve.alias = {
      ...config.resolve.alias,
      'firebase/app': require.resolve('firebase/app'),
      'firebase/auth': require.resolve('firebase/auth'),
    };
    return config;
  },
};

module.exports = nextConfig; 