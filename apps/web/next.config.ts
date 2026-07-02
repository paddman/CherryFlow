import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@cherryflow/ui-schema"],
};

export default nextConfig;
