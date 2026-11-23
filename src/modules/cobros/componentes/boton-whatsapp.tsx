import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { urlWhatsApp } from "@/modules/cobros/dominio/mensajes";

/**
 * Botón que abre WhatsApp con el mensaje listo (wa.me, sin API paga).
 * Solo se usa en páginas del panel, que exigen sesión iniciada; nunca en el portal ni la landing.
 */
export function BotonWhatsApp({ numero, mensaje, etiqueta = "WhatsApp" }: { numero: string | null | undefined; mensaje: string; etiqueta?: string }) {
  if (!numero) return <span className="text-xs text-muted-foreground">Sin WhatsApp</span>;
  return (
    <Button asChild variant="whatsapp" size="sm">
      <a href={urlWhatsApp(numero, mensaje)} target="_blank" rel="noopener noreferrer" data-testid="boton-whatsapp">
        <MessageCircle /> {etiqueta}
      </a>
    </Button>
  );
}
