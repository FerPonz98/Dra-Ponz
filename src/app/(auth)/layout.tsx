import { BellRing, QrCode, ShieldCheck } from "lucide-react";
import { headers } from "next/headers";
import { MarcaOrganizacion } from "@/components/marca/marca";
import { EstiloTema } from "@/components/tema/estilo-tema";
import { temaDeOrganizacion } from "@/core/tema/cache";
import { derivarColores } from "@/core/tema/tema";
import { organizacionDeLandingCacheada } from "@/modules/tesis/servicios/landing-cache";

const PUNTOS = [
  { I: QrCode, t: "Cobros con QR y comprobante", d: "Tus clientes pagan desde su enlace; tú apruebas con un clic." },
  { I: BellRing, t: "Recordatorios sin costo", d: "WhatsApp con el mensaje listo y correos automáticos." },
  { I: ShieldCheck, t: "Datos protegidos", d: "Cada negocio ve solo su información." },
];

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // La organización dueña del dominio (en julietaponz.com, la Dra.) pone su marca; si no hay, la de la plataforma.
  const org = await organizacionDeLandingCacheada((await headers()).get("host")).catch(() => null);
  const tema = org ? await temaDeOrganizacion(org.id).catch(() => null) : null;
  const c = tema ? derivarColores(tema) : null;
  return (
    <main className="grid min-h-screen flex-1 lg:grid-cols-[1fr_minmax(480px,560px)]">
      {/* Con tema de la organización: el botón del formulario usa su primario (como en el panel) */}
      {tema && org && <EstiloTema tema={tema} alcance="panel" id={org.id} />}
      <section className="relative hidden overflow-hidden bg-[#1e1b4b] p-12 text-indigo-50 lg:flex lg:flex-col lg:justify-between" style={c ? { background: c.secundario } : undefined}>
        <div aria-hidden className="absolute -right-24 -top-24 size-96 rounded-full bg-indigo-500/25 blur-3xl" style={c ? { background: c.primario, opacity: 0.55 } : undefined} />
        <div aria-hidden className="absolute -bottom-32 left-10 size-[28rem] rounded-full bg-violet-500/20 blur-3xl" style={c ? { background: c.acento, opacity: 0.18 } : undefined} />
        {org ? (
          <MarcaOrganizacion org={org} cual="logo" variante="blanco" conLema={false} className="relative h-16 w-auto max-w-[22rem] self-start" claseInicial="relative size-10 rounded-lg bg-white/10 text-base ring-1 ring-white/20" />
        ) : (
          <div className="relative flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-sm font-bold ring-1 ring-white/20">C</span>
            <span className="font-semibold">Cobros</span>
          </div>
        )}
        <div className="relative max-w-md space-y-8">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white">Cobra en cuotas sin perseguir a nadie.</h2>
          <ul className="space-y-5">
            {PUNTOS.map(({ I, t, d }) => (
              <li key={t} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <I className="size-4" />
                </span>
                <span>
                  <span className="block font-medium text-white">{t}</span>
                  <span className="text-sm text-indigo-200">{d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-indigo-300">© {new Date().getFullYear()} · Hecho en Bolivia</p>
      </section>
      <section className="flex items-center justify-center bg-background px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          {org && (
            <div className="mb-8 flex justify-center lg:hidden">
              <MarcaOrganizacion org={org} cual="isotipo" className="size-16" claseInicial="size-12 text-xl" />
            </div>
          )}
          {children}
        </div>
      </section>
    </main>
  );
}
