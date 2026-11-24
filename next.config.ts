import type { NextConfig } from "next";
import { PHOTO_HOSTS } from "./src/lib/photo-hosts";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    minimumCacheTTL: 2678400, // 31 days: agencies give a changed photo a new address
    remotePatterns: [
      ...PHOTO_HOSTS.map((h) => ({ protocol: "https" as const, ...h })),
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
