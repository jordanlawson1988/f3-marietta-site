import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        // Slackblast bot hosts uploaded backblast photos here.
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "files.slack.com",
      },
    ],
  },
  turbopack: {
    root: ".",
  },
};

export default nextConfig;
