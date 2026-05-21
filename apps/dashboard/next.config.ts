import type { NextConfig } from "next";
import os from "os";

// turbopack.root needs to be broad enough to encompass all file lookups.
// Turbopack traverses upward from src/app/, finds pnpm-workspace.yaml at the
// monorepo root, then uses that as the workspace root for package resolution.
// Setting root to the HOME directory ensures all node_modules paths resolve
// correctly in any environment:
//   - Locally:  /Users/rindrajith  (same as the original hardcoded value)
//   - Vercel:   /vercel            (the Vercel runner home dir)
//   - Railway:  /root              (typical Linux container home)
const homeDir = os.homedir();

const nextConfig: NextConfig = {
  outputFileTracingRoot: homeDir,
  turbopack: {
    root: homeDir,
  },
};

export default nextConfig;
