"use client";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function MenuMovil({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const ruta = usePathname();
  // eslint-disable-next-line react-hooks/set-state-in-effect -- cerrar el menú al navegar
  useEffect(() => setAbierto(false), [ruta]);
  return (
    <div className="md:hidden">
      <Button variant="ghost" size="icon" aria-label="Abrir menú" aria-expanded={abierto} onClick={() => setAbierto(true)}>
        <Menu />
      </Button>
      {abierto && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-72 max-w-[85%] overflow-y-auto bg-background p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-semibold">{titulo}</p>
              <Button variant="ghost" size="icon" aria-label="Cerrar menú" onClick={() => setAbierto(false)}>
                <X />
              </Button>
            </div>
            {children}
          </div>
          <button aria-label="Cerrar menú" className="flex-1 bg-black/40" onClick={() => setAbierto(false)} />
        </div>
      )}
    </div>
  );
}
