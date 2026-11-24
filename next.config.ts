import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Metadatos (SEO/Open Graph) siempre en el <head>, sin streaming, para cualquier cliente.
  htmlLimitedBots: /.*/,
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  serverExternalPackages: ["@react-pdf/renderer", "pg"],
  experimental: {
    // 50 MB por archivo + margen del multipart (el servidor valida el límite exacto de 50 MB).
    serverActions: { bodySizeLimit: "52mb" },
    proxyClientMaxBodySize: "52mb",
    authInterrupts: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        // Logos e íconos de marca (archivos con nombre fijo): 1 día en caché, revalidación en segundo plano.
        source: "/brand/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      {
        // La API no sirve HTML: política mínima (las páginas reciben su CSP con nonce en proxy.ts).
        source: "/api/:path*",
        headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'; sandbox" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
