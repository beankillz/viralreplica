import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Externalize FFmpeg packages to avoid bundling issues with Turbopack
  serverExternalPackages: [
    'fluent-ffmpeg',
    '@ffmpeg-installer/ffmpeg',
    'sharp',
  ],
};

export default nextConfig;
