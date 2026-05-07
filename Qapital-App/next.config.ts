import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "preview-chat-41b9dbe3-bce7-4662-9956-f567893b29f4.space-z.ai",
    ".space-z.ai",
    ".space.chatglm.site",
    "192.168.1.10",
  ],
};

export default nextConfig;
