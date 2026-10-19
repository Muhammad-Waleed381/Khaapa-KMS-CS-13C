import type { Metadata, Viewport } from "next";
import { Archivo, Arimo } from "next/font/google";
import { SwRegister } from "@/components/sw-register";
import { ThemeProvider } from "@/components/theme";
import { Toaster } from "@/components/toast";
import "./globals.css";

// Archivo, set condensed for headings (see .font-display). Arimo, the Google
// Fonts face metrically matched to Helvetica, for everything else.
const display = Archivo({ variable: "--font-archivo", subsets: ["latin"], weight: "variable", axes: ["wdth"] });
const text = Arimo({
  variable: "--font-helvetica",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: { default: "Khaapa SEECS", template: "%s · Khaapa SEECS" },
  description:
    "Khaapa SEECS is the student-run tuck shop at NUST SEECS. Live rate list and stock, and pre-orders for today or tomorrow paid on NayaPay.",
  applicationName: "Khaapa SEECS",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // next-themes sets the theme class on <html> before React hydrates.
    <html lang="en" className={`${display.variable} ${text.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
        <SwRegister />
      </body>
    </html>
  );
}
