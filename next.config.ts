
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
  // This is to allow cross-origin requests in development.
  // The API proxy is now handled by the route handler in /api/[...path]/route.ts
  // so the rewrites configuration is no longer needed.
  // The 'experimental' block is not needed for this config in recent Next.js versions.
  devServer: {
    allowedHosts: ["192.168.3.84"],
  },
};

export default nextConfig;
