import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "Peoples CRM",
  description: "Find construction firms with no website, and actually follow up",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Peoples" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfc" },
    { media: "(prefers-color-scheme: dark)", color: "#16181c" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <Providers>
          <Nav />
          {/* Bottom padding clears the mobile tab bar. */}
          <main className="mx-auto max-w-3xl px-4 pb-24 pt-4 sm:pb-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
