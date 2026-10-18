import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Tunnel / localtunnel 経由の開発アクセスを許可
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "*.loca.lt",
  ],
};

export default nextConfig;
