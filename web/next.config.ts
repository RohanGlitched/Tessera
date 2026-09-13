import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The project lives on a Windows drive mounted into WSL, where inotify events
  // never fire, so file changes are invisible to the watcher without polling.
  // Remove this when the repository sits on a native Linux filesystem.
  watchOptions: { pollIntervalMs: 1000 },
  turbopack: { root: __dirname },
};

export default nextConfig;
