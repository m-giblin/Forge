import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Manrope, Inter } from "next/font/google";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Ember Rust brand fonts (Forge-Worx redesign) — loaded globally but only
// applied via explicit --font-manrope/--font-inter usage in redesigned
// components, so unmigrated pages keep rendering in Geist untouched.
const manrope = Manrope({
  variable: "--font-manrope",
  weight: ["600", "700", "800"],
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100").replace(/\/$/, "");
const siteDescription =
  "Forge-Worx is issue tracking that ties every ticket to the code that shipped it — sprint boards, backlog, roadmap, and reporting for teams who'd rather be delivering than configuring.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Forge-Worx",
    template: "%s · Forge-Worx",
  },
  description: siteDescription,
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Forge-Worx",
    title: "Forge-Worx — Issue tracking tied to your code",
    description: siteDescription,
    images: [{ url: "/logo-384.png", width: 384, height: 384, alt: "Forge-Worx" }],
  },
  twitter: {
    card: "summary",
    title: "Forge-Worx — Issue tracking tied to your code",
    description: siteDescription,
    images: ["/logo-384.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
