import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["three"],
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "framer-motion"],
  },
};

export default nextConfig;
