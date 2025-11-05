
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
     allowedDevOrigins: ["http://192.168.3.84:9002"],
  },
  // This is to allow cross-origin requests in development.
  // The API proxy is now handled by the route handler in /api/[...path]/route.ts
  // so the rewrites configuration is no longer needed.
};

export default nextConfig;
