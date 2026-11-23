import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Dra. Julieta Ponz — Asesoría de tesis";

export default async function Imagen({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const titulo = locale === "pt" ? "Sua tese, da ideia à defesa." : "Tu tesis, de la idea a la defensa.";
  const sub = locale === "pt" ? "Orientação metodológica · graduação e pós-graduação" : "Asesoría metodológica · pregrado y posgrado";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "linear-gradient(135deg,#4a1736,#7c2d5b)", color: "white" }}>
        <div style={{ fontSize: 30, opacity: 0.85 }}>Dra. Elizabeth Julieta Ponz Sejas</div>
        <div style={{ fontSize: 72, fontWeight: 700, marginTop: 20, lineHeight: 1.1 }}>{titulo}</div>
        <div style={{ fontSize: 32, marginTop: 28, opacity: 0.9 }}>{sub}</div>
        <div style={{ fontSize: 26, marginTop: 40 }}>29 años · 58 tesis · julietaponz.com</div>
      </div>
    ),
    size,
  );
}
