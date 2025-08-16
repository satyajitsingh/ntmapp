export const dynamic = "force-dynamic";
export const revalidate = 0;
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Notes → Email | MVP",
  description: "Turn messy meeting notes into ready-to-send emails.",
  manifest: "/manifest.webmanifest",
  themeColor: "#0b0f13",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: "/icons/icon-192.png"
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
