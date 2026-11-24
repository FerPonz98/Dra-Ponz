import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: ["/es", "/pt", "/$"], disallow: ["/panel", "/p/", "/api/", "/superadmin", "/login", "/recuperar", "/restablecer", "/inicio", "/ayuda"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}

// Se genera al pedirlo (no en el build): en Docker, APP_URL solo existe al arrancar el contenedor.
export const dynamic = "force-dynamic";
