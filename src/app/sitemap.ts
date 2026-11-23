import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const idiomas = { es: `${base}/es`, pt: `${base}/pt` };
  return [
    { url: `${base}/es`, changeFrequency: "monthly", priority: 1, alternates: { languages: idiomas } },
    { url: `${base}/pt`, changeFrequency: "monthly", priority: 0.9, alternates: { languages: idiomas } },
  ];
}
