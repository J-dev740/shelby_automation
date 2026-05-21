import type { NextConfig } from "next";
import path from "path";

// Resolve the monorepo root (two levels up from apps/dashboard)
const monorepoRoot = path.resolve(__dirname, "../..");

// On Vercel, VERCEL=1 is set automatically. We use the monorepo root.
// Locally these are needed to work around iCloud Desktop's symlink sandbox.
const isVercel = Boolean(process.env.VERCEL);

const nextConfig: NextConfig = {
  // Tells Vercel/Turbopack where the true root of the project is
  // so it can safely resolve packages in the workspace.
  outputFileTracingRoot: isVercel ? monorepoRoot : "/Users/rindrajith",
  turbopack: {
    root: isVercel ? monorepoRoot : "/Users/rindrajith",
  },
};

export default nextConfig;
