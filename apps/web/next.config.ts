import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    // The defaults plus 1440: a 680px photo on a 2x screen needs ~1,360 device px, and the next default is 1920.
    deviceSizes: [640, 750, 828, 1080, 1200, 1440, 1920, 2048, 3840],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The old sub-pages are sections of the one page now. Next keeps the hash in Location (308).
  async redirects() {
    return [
      { source: "/services", destination: "/#services", permanent: true },
      { source: "/how-it-works", destination: "/#how-it-works", permanent: true },
      { source: "/why-nivar", destination: "/#compare", permanent: true },
    ];
  },
};

export default nextConfig;
