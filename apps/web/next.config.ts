import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@telecalling-crm/api-client", "@telecalling-crm/shared"],
};

export default nextConfig;
