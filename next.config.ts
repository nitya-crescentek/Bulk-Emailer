import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/CJS packages that must not be bundled into server chunks.
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
};

export default nextConfig;
