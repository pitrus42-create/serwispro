import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "@libsql/client", "@prisma/adapter-libsql"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      const existingExternals = Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean);
      config.externals = [
        ...existingExternals,
        ({ request }: { request: string }, callback: (err?: Error | null, result?: string) => void) => {
          if (request && (request.includes(".prisma/client") || request.includes("query_compiler"))) {
            return callback(undefined, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }
    return config;
  },
  turbopack: {},
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
