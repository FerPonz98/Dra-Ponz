import { z } from "zod";

export const esquemaCliente = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre").max(150),
  ci: z.string().trim().max(30).regex(/^[0-9A-Za-z.\- ]*$/, "CI inválido").optional().default(""),
  whatsapp: z
    .string()
    .trim()
    .transform((v) => v.replace(/[^\d]/g, ""))
    .refine((v) => v === "" || (v.length >= 8 && v.length <= 15), "Número con código de país, ej. 59171234567")
    .optional()
    .default(""),
  correo: z.union([z.literal(""), z.email("Correo inválido")]).optional().default(""),
  notas: z.string().trim().max(2000).optional().default(""),
});
export type DatosCliente = z.input<typeof esquemaCliente>;

