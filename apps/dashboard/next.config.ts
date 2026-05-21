import type { NextConfig } from "next";
import path from "path";

// Resolve the monorepo root (two levels up from apps/dashboard)
const monorepoRoot = path.resolve(__dirname, "../..");

// On CI/CD (Vercel, GitHub Actions), use the dynamic monorepo root.
// Locally these are needed to work around iCloud Desktop's symlink sandbox.
const isCI = Boolean(process.env.CI || process.env.VERCEL);

const nextConfig: NextConfig = {
  // Tells Vercel/Turbopack where the true root of the project is
  // so it can safely resolve packages in the workspace.
  outputFileTracingRoot: isCI ? monorepoRoot : "/Users/rindrajith",
  turbopack: {
    root: isCI ? monorepoRoot : "/Users/rindrajith",
  },
};

export default nextConfig;
