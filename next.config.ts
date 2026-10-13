import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The container image runs `.next/standalone/server.js` on App Runner, so
  // the build copies only the traced files the server needs. Vercel ignores
  // this setting.
  output: "standalone",
  images: {
    // No page uses next/image, and outside Vercel the optimiser would run in
    // the app's own container. Keep it off so adding one later is a choice.
    unoptimized: true,
  },
};

export default nextConfig;
