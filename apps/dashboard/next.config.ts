import type { NextConfig } from "next";

// On Vercel, VERCEL=1 is set automatically — skip local path overrides.
// Locally these are needed to work around iCloud Desktop's symlink sandbox.
const isVercel = Boolean(process.env.VERCEL);

const nextConfig: NextConfig = {
  ...(isVercel
    ? {}
    : {
        // Allows Turbopack to resolve symlinked node_modules outside the project
        // directory when running on a macOS desktop with iCloud Drive sync.
        outputFileTracingRoot: "/Users/rindrajith",
        turbopack: { root: "/Users/rindrajith" },
      }),
};

export default nextConfig;
