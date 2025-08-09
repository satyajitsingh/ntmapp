import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Notes → Email | MVP",
  description: "Turn messy meeting notes into ready-to-send email summaries."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
