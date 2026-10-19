import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SwRegister } from "@/components/sw-register";
import { Toaster } from "@/components/toast";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Khaapa — Tuck shop at K2 Block, NUST H-12", template: "%s · Khaapa" },
  description:
    "Khaapa is the student-run tuck shop at K2 Block, NUST H-12. Live menu, prices and stock, and pre-orders for today or tomorrow.",
  applicationName: "Khaapa",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#d9480f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Toaster />
        <SwRegister />
      </body>
    </html>
  );
}
