/** @type {import('next').NextConfig} */
const baseConfig = {
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
};

const isDev = process.env.NODE_ENV !== "production";
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: isDev, // enable PWA only in production
  // optional: cache control tweaks
  runtimeCaching: undefined,
});

module.exports = withPWA(baseConfig);
