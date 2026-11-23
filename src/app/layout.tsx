import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Cobros", template: "%s · Cobros" },
  description: "Cobros en cuotas, recordatorios y pagos por QR.",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a09" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const oscuro = (await cookies()).get("tema")?.value === "oscuro";
  return (
    <html lang="es" className={`${inter.variable} h-full ${oscuro ? "dark" : ""}`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
