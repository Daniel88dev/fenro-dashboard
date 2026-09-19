import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel needs nothing here. Moving to a container host (ECS, App Runner)
  // means adding `output: "standalone"` and, with more than one instance, a
  // shared `cacheHandler`. See the deployment section of the README.
};

export default nextConfig;
