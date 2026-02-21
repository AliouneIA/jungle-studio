import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
    ],
  },
  // Désactive ESLint errors pendant le build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Désactive TypeScript errors pendant le build
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
