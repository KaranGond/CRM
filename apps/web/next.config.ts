import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile workspace packages so Next.js can bundle them
  transpilePackages: [
    "@telecalling-crm/ui",
    "@telecalling-crm/utils",
    "@telecalling-crm/types",
    "@telecalling-crm/validation",
    "@telecalling-crm/api-client",
  ],

  // Alias react-native to react-native-web for cross-platform UI
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "react-native$": "react-native-web",
    };
    return config;
  },
};

export default nextConfig;
