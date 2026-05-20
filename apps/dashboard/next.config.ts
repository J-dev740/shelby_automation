import type { NextConfig } from "next";
import path from "path";

// The monorepo root — two levels up from apps/dashboard
const monorepoRoot = path.resolve(__dirname, "../..");

const nextConfig: NextConfig = {
  // Allow Turbopack to resolve node_modules that are symlinked outside
  // the project directory (into ~/.shelby_node_modules) to avoid iCloud
  // Desktop sync interference. Without this, Turbopack's security sandbox
  // blocks resolution of any file whose real path is outside this folder.
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
