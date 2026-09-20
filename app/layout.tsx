import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Navis",
    template: "%s · Navis",
  },
  description:
    "Governed Solana equity-agent workspace with policy-checked proposals, wallet authorization, and hash-verifiable receipts.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
