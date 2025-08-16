/** @type {import('next').NextConfig} */
/** @type {import('next').NextConfig} */
const baseConfig = {
  async headers() {
    return [
      {
        // your homepage (adjust if you have more pages)
        source: "/",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
          { key: "X-Robots-Tag", value: "noarchive" }
        ],
      },
      {
        // optional: any other routes you render
        source: "/offline",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noarchive" }
        ],
      },
    ];
  },
};

const isDev = process.env.NODE_ENV !== "production";

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV !== "production",
  runtimeCaching: [
    // Never cache HTML/documents
    {
      urlPattern: ({ request }) => request.destination === "document",
      handler: "NetworkOnly",
    },
    // Cache static assets safely
    {
      urlPattern: ({ request }) => ["style", "script", "image", "font"].includes(request.destination),
      handler: "StaleWhileRevalidate",
      options: { cacheName: "static-assets" },
    },
  ],
});

module.exports = withPWA(baseConfig);
