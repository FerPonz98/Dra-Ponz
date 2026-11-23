import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { urlWhatsApp } from "@/modules/cobros/dominio/mensajes";

/**
 * Botón que abre WhatsApp con el mensaje listo (wa.me, sin API paga).
 * Solo se usa en páginas del panel, que exigen sesión iniciada; nunca en el portal ni la landing.
 */
export function BotonWhatsApp({ numero, mensaje, etiqueta = "WhatsApp", size = "sm" }: { numero: string | null | undefined; mensaje: string; etiqueta?: string; size?: "sm" | "default" }) {
  if (!numero) return <span className="whitespace-nowrap text-xs text-subtle-foreground">Sin WhatsApp</span>;
  return (
    <Button asChild variant="whatsapp" size={size}>
      <a href={urlWhatsApp(numero, mensaje)} target="_blank" rel="noopener noreferrer" data-testid="boton-whatsapp" title="Abrir WhatsApp con el mensaje listo">
        <MessageCircle /> {etiqueta}
      </a>
    </Button>
  );
}
