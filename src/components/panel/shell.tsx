"use client";
import {
  BellRing,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  FileStack,
  FileText,
  Globe,
  GraduationCap,
  Home,
  LayoutGrid,
  LogOut,
  Menu as IconoMenu,
  MessageSquareText,
  Moon,
  Palette,
  Receipt,
  Search,
  Settings,
  Sun,
  Users,
  UsersRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Menu, MenuContenido, MenuDisparador, MenuEtiqueta, MenuItem, MenuSeparador } from "@/components/ui/menu";
import { Avatar } from "@/components/ui/varios";

export const ICONOS = {
  inicio: Home,
  clientes: Users,
  planes: Wallet,
  comprobantes: Receipt,
  recordar: BellRing,
  plantillas: MessageSquareText,
  propuestas: GraduationCap,
  calendario: CalendarDays,
  formularios: FileStack,
  landing: Globe,
  organizacion: Settings,
  apariencia: Palette,
  usuarios: UsersRound,
  documento: FileText,
} satisfies Record<string, LucideIcon>;
export type NombreIcono = keyof typeof ICONOS;

export type ItemNav = { href: string; etiqueta: string; icono: NombreIcono; contador?: number; exacto?: boolean };
export type GrupoNav = { titulo: string; items: ItemNav[] };

function activo(ruta: string, it: ItemNav) {
  return it.exacto ? ruta === it.href : ruta === it.href || ruta.startsWith(`${it.href}/`);
}

function escribirCookie(nombre: string, valor: string) {
  document.cookie = `${nombre}=${valor}; path=/; max-age=31536000; samesite=lax`;
}

function Marca({ nombre, simbolo, colapsado }: { nombre: string; simbolo: React.ReactNode; colapsado?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {/* Isotipo de la organización (subido, incorporado o la inicial), resuelto en el servidor */}
      <span className="flex size-8 shrink-0 items-center justify-center" aria-hidden>
        {simbolo}
      </span>
      {!colapsado && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold leading-tight" title={nombre}>
            {nombre}
          </span>
          <span className="block text-[11px] leading-tight text-muted-foreground">Panel de gestión</span>
        </span>
      )}
    </div>
  );
}

function Navegacion({ grupos, colapsado, alNavegar }: { grupos: GrupoNav[]; colapsado?: boolean; alNavegar?: () => void }) {
  const ruta = usePathname();
  return (
    <nav aria-label="Menú principal" className="space-y-5">
      {grupos.map((g) => (
        <div key={g.titulo}>
          {colapsado ? <div className="mx-3 mb-2 h-px bg-border" aria-hidden /> : <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">{g.titulo}</p>}
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const Icono = ICONOS[it.icono];
              const act = activo(ruta, it);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={alNavegar}
                    aria-current={act ? "page" : undefined}
                    title={colapsado ? it.etiqueta : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      act ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      colapsado && "justify-center px-0",
                    )}
                  >
                    <Icono className={cn("size-[18px] shrink-0", act ? "text-primary" : "text-subtle-foreground group-hover:text-foreground")} aria-hidden />
                    <span className={cn("flex-1 truncate", colapsado && "sr-only")}>{it.etiqueta}</span>
                    {!!it.contador && !colapsado && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">{it.contador}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function ShellPanel({
  organizacion,
  usuario,
  grupos,
  inferior,
  colapsadoInicial,
  oscuroInicial,
  children,
}: {
  organizacion: { nombre: string; zona: string; simbolo: React.ReactNode };
  usuario: { nombre: string; correo: string };
  grupos: GrupoNav[];
  inferior: ItemNav[];
  colapsadoInicial: boolean;
  oscuroInicial: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const [colapsado, setColapsado] = React.useState(colapsadoInicial);
  const [drawer, setDrawer] = React.useState(false);
  const [oscuro, setOscuro] = React.useState(oscuroInicial);

  React.useEffect(() => {
    if (!drawer) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [drawer]);

  function alternarTema() {
    const v = !oscuro;
    setOscuro(v);
    document.documentElement.classList.toggle("dark", v);
    escribirCookie("tema", v ? "oscuro" : "claro");
  }
  async function salir() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-background">
      <a href="#contenido-panel" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:shadow-lg">
        Saltar al contenido
      </a>
      {/* Barra lateral (escritorio) */}
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 lg:flex", colapsado ? "w-[72px]" : "w-64")}>
        <div className={cn("flex h-16 items-center border-b border-border px-4", colapsado && "justify-center px-0")}>
          <Marca nombre={organizacion.nombre} simbolo={organizacion.simbolo} colapsado={colapsado} />
        </div>
        <div className={cn("flex-1 overflow-y-auto py-4", colapsado ? "px-2" : "px-3")}>
          <Navegacion grupos={grupos} colapsado={colapsado} />
        </div>
        <div className={cn("border-t border-border p-3", colapsado && "px-2")}>
          <Button
            variant="ghost"
            size="sm"
            className={cn("w-full justify-start text-muted-foreground", colapsado && "justify-center")}
            aria-label={colapsado ? "Expandir menú" : "Contraer menú"}
            onClick={() => {
              setColapsado(!colapsado);
              escribirCookie("panel_colapsado", colapsado ? "0" : "1");
            }}
          >
            {colapsado ? <ChevronsRight /> : <ChevronsLeft />}
            {!colapsado && "Contraer menú"}
          </Button>
        </div>
      </aside>

      {/* Drawer (celular y tablet) */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button className="absolute inset-0 bg-stone-950/40 backdrop-blur-[2px]" aria-label="Cerrar menú" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-surface shadow-lg animate-[aparecer_.2s_ease-out]">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <Marca nombre={organizacion.nombre} simbolo={organizacion.simbolo} />
              <Button variant="ghost" size="icon-sm" aria-label="Cerrar menú" onClick={() => setDrawer(false)}>
                <X />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <Navegacion grupos={grupos} alNavegar={() => setDrawer(false)} />
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/85 px-4 backdrop-blur-md md:px-6">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Abrir menú" aria-expanded={drawer} onClick={() => setDrawer(true)}>
            <IconoMenu />
          </Button>
          <form action="/panel/buscar" role="search" className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden />
            <input
              name="q"
              type="search"
              placeholder="Buscar clientes, planes, proyectos…"
              aria-label="Buscar en el panel"
              className="h-9 w-full rounded-lg border border-border bg-surface-2 pl-9 pr-3 text-sm placeholder:text-subtle-foreground focus-visible:border-primary focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
            />
          </form>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="hidden items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground xl:flex" title={`Zona horaria: ${organizacion.zona}`}>
              <LayoutGrid className="size-3.5" aria-hidden />
              <span className="max-w-48 truncate font-medium text-foreground">{organizacion.nombre}</span>
            </span>
            <Button variant="ghost" size="icon-sm" aria-label={oscuro ? "Usar modo claro" : "Usar modo oscuro"} onClick={alternarTema}>
              {oscuro ? <Sun /> : <Moon />}
            </Button>
            <Menu>
              <MenuDisparador asChild>
                <button className="flex items-center gap-2 rounded-lg p-1 pr-2 text-left hover:bg-muted">
                  <Avatar nombre={usuario.nombre} className="size-8" />
                  <span className="sr-only text-sm font-medium sm:not-sr-only" data-testid="usuario-actual">
                    {usuario.nombre}
                  </span>
                </button>
              </MenuDisparador>
              <MenuContenido className="w-64">
                <MenuEtiqueta>
                  <span className="block text-sm font-semibold text-foreground">{usuario.nombre}</span>
                  <span className="block truncate font-normal">{usuario.correo}</span>
                </MenuEtiqueta>
                <MenuSeparador />
                <MenuItem onSelect={alternarTema}>
                  {oscuro ? <Sun /> : <Moon />} {oscuro ? "Modo claro" : "Modo oscuro"}
                </MenuItem>
                <MenuItem asChild>
                  <Link href="/panel/configuracion">
                    <Settings /> Organización
                  </Link>
                </MenuItem>
                <MenuSeparador />
                <MenuItem onSelect={salir}>
                  <LogOut /> Cerrar sesión
                </MenuItem>
              </MenuContenido>
            </Menu>
          </div>
        </header>

        <main id="contenido-panel" className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 md:px-6 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Menú inferior (celular) */}
      <nav aria-label="Accesos rápidos" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${inferior.length + 1}, minmax(0, 1fr))` }}>
          {inferior.map((it) => {
            const Icono = ICONOS[it.icono];
            const act = activo(ruta, it);
            return (
              <li key={it.href}>
                <Link href={it.href} aria-current={act ? "page" : undefined} className={cn("flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium", act ? "text-primary" : "text-muted-foreground")}>
                  <Icono className="size-5" aria-hidden />
                  <span className="truncate">{it.etiqueta}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button onClick={() => setDrawer(true)} className="flex w-full flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium text-muted-foreground">
              <IconoMenu className="size-5" aria-hidden />
              Más
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
