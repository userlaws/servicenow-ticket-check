import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Build plain HTML files, so the site can be hosted on GitHub Pages.
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: { root: __dirname },
};

export default nextConfig;
