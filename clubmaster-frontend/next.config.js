/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['firebase'],
  images: {
    domains: ['lh3.googleusercontent.com', 'localhost'],
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