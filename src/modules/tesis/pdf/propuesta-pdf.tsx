import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatoMoneda } from "@/lib/dinero";
import { formatoFecha } from "@/lib/fechas";
import type { Proyecto } from "@/modules/tesis/servicios/propuestas";

const s = StyleSheet.create({
  pagina: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1f2937" },
  marca: { fontSize: 9, color: "#6b7280", marginBottom: 4 },
  titulo: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  sub: { fontSize: 11, marginBottom: 12 },
  seccion: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 6, color: "#7c2d5b" },
  fila: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#d1d5db", paddingVertical: 3 },
  cab: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#6b7280", paddingVertical: 3, fontFamily: "Helvetica-Bold" },
  celda: { flex: 1 },
  nota: { fontSize: 9, color: "#4b5563", marginTop: 4 },
  pie: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: "#9ca3af", textAlign: "center" },
});

function DocumentoPropuesta({ p, organizacion }: { p: Proyecto; organizacion: string }) {
  const cr = p.nuevoPendiente ?? p.vigente;
  const meses = cr ? Array.from({ length: cr.meses }, (_, i) => i + 1) : [];
  const moneda = p.plan.plan.moneda;
  const r = p.plan.reglas;
  return (
    <Document title={`Propuesta - ${p.propuesta.titulo}`} author={organizacion} language="es">
      <Page size="A4" style={s.pagina}>
        <Text style={s.marca}>{organizacion}</Text>
        <Text style={s.titulo}>Propuesta de asesoría de tesis</Text>
        <Text style={s.sub}>{p.propuesta.titulo}</Text>
        <Text>Estudiante: {p.cliente.nombre}</Text>
        {p.propuesta.universidad && <Text>Universidad: {p.propuesta.universidad}</Text>}
        <Text>Nivel: {p.propuesta.nivel === "posgrado" ? "Posgrado" : "Pregrado"}</Text>
        <Text>Moneda: {moneda === "BRL" ? "Reales (BRL) - se paga en Bs al tipo de cambio oficial del día" : "Bolivianos (BOB)"}</Text>

        <Text style={s.seccion}>Plan de pagos</Text>
        <View style={s.cab}>
          <Text style={{ width: 40 }}>N.º</Text>
          <Text style={s.celda}>Vence</Text>
          <Text style={s.celda}>Concepto</Text>
          <Text style={{ width: 90, textAlign: "right" }}>Monto</Text>
        </View>
        {p.plan.cuotas.map((c) => (
          <View key={c.id} style={s.fila}>
            <Text style={{ width: 40 }}>{c.numero}</Text>
            <Text style={s.celda}>{formatoFecha(c.fechaVencimiento)}</Text>
            <Text style={s.celda}>{c.concepto ?? "Cuota"}</Text>
            <Text style={{ width: 90, textAlign: "right" }}>{formatoMoneda(c.montoCentavos, moneda)}</Text>
          </View>
        ))}
        <View style={[s.fila, { fontFamily: "Helvetica-Bold" }]}>
          <Text style={s.celda}>Total</Text>
          <Text style={{ width: 90, textAlign: "right" }}>{formatoMoneda(p.plan.total, moneda)}</Text>
        </View>
        {(r.plazoPrimeraCuotaDias !== null || r.diasGracia !== null || r.recargoActivo) && (
          <Text style={s.nota}>
            {r.plazoPrimeraCuotaDias !== null ? `La 1.ª cuota se paga dentro de ${r.plazoPrimeraCuotaDias} días de aceptar. ` : ""}
            {r.diasGracia !== null ? `Días de gracia: ${r.diasGracia}. ` : ""}
            {r.diasGraciaNuevaMora !== null ? `En una nueva mora: ${r.diasGraciaNuevaMora} días. ` : ""}
            {r.recargoActivo && r.recargoPorcentaje ? `Recargo por mora: ${r.recargoPorcentaje}% ${r.recargoModo === "mensual" ? "por cada mes de atraso" : "por única vez"}. ` : ""}
            Si una cuota supera la gracia, el proyecto queda en pausa (en cola) hasta regularizar el pago.
          </Text>
        )}

        {cr && (
          <>
            <Text style={s.seccion}>Cronograma (desde {formatoFecha(cr.fechaInicio)})</Text>
            <View style={s.cab}>
              <Text style={{ flex: 3 }}>Actividad</Text>
              {meses.map((m) => (
                <Text key={m} style={{ width: 28, textAlign: "center" }}>
                  M{m}
                </Text>
              ))}
            </View>
            {cr.actividades.map((a) => (
              <View key={a.id} style={s.fila} wrap={false}>
                <Text style={{ flex: 3 }}>
                  {a.nombre}
                  {a.aCargoEstudiante ? " (a cargo del estudiante)" : ""}
                </Text>
                {meses.map((m) => (
                  <Text key={m} style={{ width: 28, textAlign: "center" }}>
                    {a.meses.includes(m) ? "X" : ""}
                  </Text>
                ))}
              </View>
            ))}
          </>
        )}

        <Text style={s.seccion}>Revisiones del tribunal</Text>
        <Text>Incluye 2 revisiones del tribunal. La 3.ª revisión se cobra aparte: {formatoMoneda(p.propuesta.precioTerceraRevisionCentavos, moneda)}.</Text>
        <Text style={s.nota}>La defensa de la tesis la realiza el estudiante.</Text>

        {p.extras.length > 0 && (
          <>
            <Text style={s.seccion}>Extras opcionales</Text>
            {p.extras.map((x) => (
              <View key={x.id} style={s.fila}>
                <Text style={s.celda}>{x.nombre}</Text>
                <Text style={{ width: 90, textAlign: "right" }}>{formatoMoneda(x.precioCentavos, moneda)}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={s.seccion}>Vigencia</Text>
        <Text>
          Esta propuesta es válida por {p.propuesta.vigenciaDias} días{p.propuesta.expiraEn ? ` (hasta el ${formatoFecha(p.propuesta.expiraEn)})` : ""}.
          {p.propuesta.aceptadaEn ? ` Aceptada el ${formatoFecha(p.propuesta.aceptadaEn)}.` : ""}
        </Text>
        <Text style={s.pie} fixed>
          {organizacion} · Documento generado el {formatoFecha(new Date())}
        </Text>
      </Page>
    </Document>
  );
}

export async function generarPdfPropuesta(p: Proyecto, organizacion: string): Promise<Buffer> {
  return renderToBuffer(<DocumentoPropuesta p={p} organizacion={organizacion} />);
}

export function nombreArchivoPdf(p: Proyecto) {
  return `propuesta-${p.cliente.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`;
}
