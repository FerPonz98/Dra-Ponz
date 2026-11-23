import { centavosATexto } from "@/lib/dinero";
import type { ValorAsistente } from "./asistente";

export function valorInicialNuevo(hoy: string, precioDiapositivas: number | null): ValorAsistente {
  return {
    modoEstudiante: "nuevo",
    clienteId: "",
    nuevo: { nombre: "", ci: "", whatsapp: "", correo: "" },
    titulo: "",
    universidad: "",
    nivel: "pregrado",
    moneda: "BOB",
    cuotas: [],
    cronograma: { fechaInicio: hoy, meses: 5, actividades: [] },
    reglas: { plazoPrimeraCuotaDias: 7, diasGracia: 5, recargoActivo: false, recargoPorcentaje: null, recargoModo: "unico", diasGraciaNuevaMora: 10 },
    precioTercera: "",
    extras: precioDiapositivas !== null ? [{ nombre: "Diapositivas para la sustentación", precio: centavosATexto(precioDiapositivas) }] : [],
    formularioId: "",
    vigenciaDias: 7,
  };
}

type ProyectoParaEditar = {
  propuesta: { clienteId: string; titulo: string; universidad: string | null; nivel: "pregrado" | "posgrado"; precioTerceraRevisionCentavos: number; formularioId: string | null; vigenciaDias: number };
  plan: { plan: { moneda: "BOB" | "BRL" }; reglas: ValorAsistente["reglas"]; cuotas: { id: string; concepto: string | null; montoCentavos: number; fechaVencimiento: string; estado: "pendiente" | "pagada" }[] };
  vigente: { fechaInicio: string; meses: number; actividades: { nombre: string; meses: number[]; aCargoEstudiante: boolean; hecha: boolean }[] } | null;
  extras: { nombre: string; precioCentavos: number; estado: string }[];
};

export function valorDesdeProyecto(p: ProyectoParaEditar, hoy: string): ValorAsistente {
  return {
    modoEstudiante: "existente",
    clienteId: p.propuesta.clienteId,
    nuevo: { nombre: "", ci: "", whatsapp: "", correo: "" },
    titulo: p.propuesta.titulo,
    universidad: p.propuesta.universidad ?? "",
    nivel: p.propuesta.nivel,
    moneda: p.plan.plan.moneda,
    cuotas: p.plan.cuotas.map((c) => ({ id: c.id, concepto: c.concepto, montoCentavos: c.montoCentavos, fechaVencimiento: c.fechaVencimiento, estado: c.estado })),
    cronograma: p.vigente
      ? { fechaInicio: p.vigente.fechaInicio, meses: p.vigente.meses, actividades: p.vigente.actividades.map((a) => ({ nombre: a.nombre, meses: a.meses, aCargoEstudiante: a.aCargoEstudiante, hecha: a.hecha })) }
      : { fechaInicio: hoy, meses: 5, actividades: [] },
    reglas: p.plan.reglas,
    precioTercera: centavosATexto(p.propuesta.precioTerceraRevisionCentavos),
    extras: p.extras.filter((x) => x.estado === "ofrecido").map((x) => ({ nombre: x.nombre, precio: centavosATexto(x.precioCentavos) })),
    formularioId: p.propuesta.formularioId ?? "",
    vigenciaDias: p.propuesta.vigenciaDias,
  };
}
