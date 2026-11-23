// Contenido editable de la landing. Listas: un ítem por línea; pares: "a | b" por línea.
export type TipoContenido = "texto" | "parrafo" | "lista" | "pares";
export type DefCampo = { clave: string; etiqueta: string; tipo: TipoContenido; ayuda?: string };
export type DefSeccion = { id: string; titulo: string; campos: DefCampo[] };

export const SECCIONES_LANDING: DefSeccion[] = [
  {
    id: "seo",
    titulo: "SEO (buscadores y redes)",
    campos: [
      { clave: "seo.titulo", etiqueta: "Título de la página", tipo: "texto" },
      { clave: "seo.descripcion", etiqueta: "Descripción", tipo: "parrafo" },
    ],
  },
  {
    id: "portada",
    titulo: "1. Portada",
    campos: [
      { clave: "portada.titulo", etiqueta: "Título", tipo: "parrafo" },
      { clave: "portada.subtitulo", etiqueta: "Subtítulo", tipo: "parrafo" },
      { clave: "portada.firma", etiqueta: "Firma", tipo: "parrafo" },
    ],
  },
  { id: "cifras", titulo: "2. Cifras", campos: [{ clave: "cifras.items", etiqueta: "Cifras", tipo: "pares", ayuda: "Una por línea: número | texto" }] },
  {
    id: "problemas",
    titulo: "3. ¿Te pasa esto?",
    campos: [
      { clave: "problemas.titulo", etiqueta: "Título", tipo: "texto" },
      { clave: "problemas.items", etiqueta: "Situaciones", tipo: "lista", ayuda: "Una por línea" },
      { clave: "problemas.cierre", etiqueta: "Cierre", tipo: "parrafo" },
    ],
  },
  {
    id: "servicios",
    titulo: "4. Servicios",
    campos: [
      { clave: "servicios.titulo", etiqueta: "Título", tipo: "texto" },
      { clave: "servicios.items", etiqueta: "Servicios", tipo: "pares", ayuda: "Uno por línea: nombre | detalle" },
    ],
  },
  {
    id: "proceso",
    titulo: "5. Cómo trabajamos",
    campos: [
      { clave: "proceso.titulo", etiqueta: "Título", tipo: "texto" },
      { clave: "proceso.items", etiqueta: "Pasos", tipo: "lista", ayuda: "Uno por línea" },
    ],
  },
  {
    id: "pago",
    titulo: "6. Pago en cuotas",
    campos: [
      { clave: "pago.titulo", etiqueta: "Título", tipo: "texto" },
      { clave: "pago.texto", etiqueta: "Texto", tipo: "parrafo" },
    ],
  },
  {
    id: "porque",
    titulo: "7. Por qué con la Dra. Ponz",
    campos: [
      { clave: "porque.titulo", etiqueta: "Título", tipo: "texto" },
      { clave: "porque.items", etiqueta: "Razones", tipo: "lista", ayuda: "Una por línea" },
    ],
  },
  {
    id: "trayectoria",
    titulo: "8. Trayectoria",
    campos: [
      { clave: "trayectoria.titulo", etiqueta: "Título", tipo: "texto" },
      { clave: "trayectoria.items", etiqueta: "Línea de tiempo", tipo: "lista", ayuda: "Un hito por línea" },
    ],
  },
  {
    id: "testimonios",
    titulo: "9. Testimonios",
    campos: [
      { clave: "testimonios.titulo", etiqueta: "Título", tipo: "texto" },
      { clave: "testimonios.items", etiqueta: "Testimonios", tipo: "pares", ayuda: "Uno por línea: testimonio | nombre y carrera. Vacío = la sección no se muestra." },
    ],
  },
  {
    id: "faq",
    titulo: "10. Preguntas frecuentes",
    campos: [
      { clave: "faq.titulo", etiqueta: "Título", tipo: "texto" },
      { clave: "faq.items", etiqueta: "Preguntas", tipo: "pares", ayuda: "Una por línea: pregunta | respuesta" },
    ],
  },
  {
    id: "cierre",
    titulo: "11. Cierre",
    campos: [{ clave: "cierre.titulo", etiqueta: "Título", tipo: "parrafo" }],
  },
];

export const CLAVES_LANDING = SECCIONES_LANDING.flatMap((s) => s.campos.map((c) => c.clave));

export const CONTENIDO_INICIAL: Record<"es" | "pt", Record<string, string>> = {
  es: {
    "seo.titulo": "Dra. Julieta Ponz · Asesoría de tesis de pregrado y posgrado",
    "seo.descripcion":
      "Asesoría metodológica para tesis de pregrado y posgrado en Bolivia y Brasil. 29 años de docencia universitaria y 58 tesis acompañadas como asesora y tribunal. Pago en cuotas con QR.",
    "portada.titulo": "Tu tesis, de la idea a la defensa, con quien sabe lo que el tribunal va a observar.",
    "portada.subtitulo": "Asesoría metodológica para tesis de pregrado y posgrado. 29 años de docencia universitaria y 58 tesis acompañadas como asesora y tribunal.",
    "portada.firma": "Dra. Elizabeth Julieta Ponz Sejas — Coautora del Modelo Académico del Sistema Universitario Boliviano.",
    "cifras.items": "29 | años en la universidad\n58 | tesis como asesora y tribunal\n2 | libros publicados\n3 | carreras acreditadas como evaluadora CEUB\n+45 | ponencias",
    "problemas.titulo": "¿Te pasa esto?",
    "problemas.items": "No sabes cómo plantear el problema ni los objetivos.\nEl tribunal te observó y no sabes por dónde empezar.\nTienes datos, pero no sabes cómo analizarlos.\nSe te acaba el plazo.",
    "problemas.cierre": "No tienes que hacerlo solo. Lo hacemos con un plan.",
    "servicios.titulo": "Servicios",
    "servicios.items":
      "Pregrado | Perfil, instrumentos, análisis de datos, documento final y 2 revisiones del tribunal.\nPosgrado | Especialidad, maestría y doctorado.\nExtras | Diapositivas para la sustentación y revisiones adicionales.",
    "proceso.titulo": "Cómo trabajamos",
    "proceso.items": "Diagnóstico de tu tesis\nPropuesta con cronograma\nAvance mes a mes\nRevisiones del tribunal\nTu defensa",
    "pago.titulo": "Pago en cuotas",
    "pago.texto": "Paga mes a mes en bolivianos o en reales, con QR, sin sorpresas.",
    "porque.titulo": "Por qué con la Dra. Ponz",
    "porque.items":
      "Coautora del Modelo Académico del Sistema Universitario Boliviano.\nCoordinadora de Metodología de la Investigación (UAP).\nEvaluadora externa del CEUB.\nHa sido tribunal: sabe lo que se va a observar.\nInvestigadora con libros y artículos publicados.",
    "trayectoria.titulo": "Trayectoria",
    "trayectoria.items":
      "Licenciada en Farmacia y Bioquímica (USFX).\nEspecialidad en Diseño Curricular (CEUB – Universidad de Barcelona).\nMagíster en Educación Superior (UAP).\nMagíster en Investigación en Ciencias Sociales para el Desarrollo (PIEB).\nCandidata a Ph.D. en Educación Superior (UAP).\nDocente en la UAP, Universidad Cosmos, Universidad Domingo Savio y Universidad Siglo XX.\nDirectora del Área de Ciencias Biológicas y Naturales (UAP).\nPresidenta de la Sociedad Boliviana de Bioquímica Clínica, filial Pando.",
    "testimonios.titulo": "Testimonios",
    "testimonios.items": "",
    "faq.titulo": "Preguntas frecuentes",
    "faq.items":
      "¿Cuánto dura la asesoría? | Depende de tu avance y nivel; una tesis de pregrado suele organizarse en unos 5 meses. Te lo mostramos en el cronograma de tu propuesta.\n¿Cómo pago? | En cuotas mensuales, en bolivianos o en reales, con QR. Subes tu comprobante desde tu enlace personal.\n¿Qué pasa si me atraso? | Tienes días de gracia. Si el atraso continúa, el proyecto se pausa hasta regularizar y armamos un cronograma nuevo.\n¿Es confidencial? | Sí. Tus datos y archivos solo los ves tú y la asesora.\n¿Quién defiende la tesis? | Tú. Te preparamos para que llegues seguro a tu defensa.\n¿En qué carreras asesora? | Ciencias de la salud, ciencias biológicas, educación y ciencias sociales, en pregrado y posgrado.",
    "cierre.titulo": "Tu defensa empieza con una conversación.",
  },
  pt: {
    "seo.titulo": "Dra. Julieta Ponz · Orientação de TCC, dissertação e tese",
    "seo.descripcion":
      "Orientação metodológica para trabalhos de graduação e pós-graduação. 29 anos de docência universitária e 58 teses acompanhadas como orientadora e banca. Pagamento em parcelas com QR.",
    "portada.titulo": "Sua tese, da ideia à defesa, com quem sabe o que a banca vai observar.",
    "portada.subtitulo": "Orientação metodológica para graduação e pós-graduação. 29 anos de docência universitária e 58 teses acompanhadas como orientadora e banca.",
    "portada.firma": "Dra. Elizabeth Julieta Ponz Sejas — Coautora do Modelo Acadêmico do Sistema Universitário Boliviano.",
    "cifras.items": "29 | anos na universidade\n58 | teses como orientadora e banca\n2 | livros publicados\n3 | cursos acreditados como avaliadora CEUB\n+45 | palestras",
    "problemas.titulo": "Isso acontece com você?",
    "problemas.items": "Não sabe como formular o problema e os objetivos.\nA banca fez observações e você não sabe por onde começar.\nTem dados, mas não sabe como analisá-los.\nO prazo está acabando.",
    "problemas.cierre": "Você não precisa fazer isso sozinho. Fazemos com um plano.",
    "servicios.titulo": "Serviços",
    "servicios.items":
      "Graduação | Projeto, instrumentos, análise de dados, documento final e 2 revisões da banca.\nPós-graduação | Especialização, mestrado e doutorado.\nExtras | Slides para a defesa e revisões adicionais.",
    "proceso.titulo": "Como trabalhamos",
    "proceso.items": "Diagnóstico da sua tese\nProposta com cronograma\nAvanço mês a mês\nRevisões da banca\nSua defesa",
    "pago.titulo": "Pagamento em parcelas",
    "pago.texto": "Pague mês a mês em bolivianos ou em reais, com QR, sem surpresas.",
    "porque.titulo": "Por que com a Dra. Ponz",
    "porque.items":
      "Coautora do Modelo Acadêmico do Sistema Universitário Boliviano.\nCoordenadora de Metodologia da Pesquisa (UAP).\nAvaliadora externa do CEUB.\nJá foi banca: sabe o que vai ser observado.\nPesquisadora com livros e artigos publicados.",
    "trayectoria.titulo": "Trajetória",
    "trayectoria.items":
      "Graduada em Farmácia e Bioquímica (USFX).\nEspecialização em Desenho Curricular (CEUB – Universidade de Barcelona).\nMestre em Educação Superior (UAP).\nMestre em Pesquisa em Ciências Sociais para o Desenvolvimento (PIEB).\nDoutoranda em Educação Superior (UAP).\nDocente na UAP, Universidad Cosmos, Universidad Domingo Savio e Universidad Siglo XX.\nDiretora da Área de Ciências Biológicas e Naturais (UAP).\nPresidente da Sociedade Boliviana de Bioquímica Clínica, filial Pando.",
    "testimonios.titulo": "Depoimentos",
    "testimonios.items": "",
    "faq.titulo": "Perguntas frequentes",
    "faq.items":
      "Quanto tempo dura a orientação? | Depende do seu avanço e nível; um trabalho de graduação costuma levar cerca de 5 meses. Mostramos no cronograma da sua proposta.\nComo pago? | Em parcelas mensais, em bolivianos ou em reais, com QR. Você envia o comprovante pelo seu link pessoal.\nE se eu atrasar? | Você tem dias de carência. Se o atraso continuar, o projeto fica em pausa até regularizar e montamos um novo cronograma.\nÉ confidencial? | Sim. Seus dados e arquivos só são vistos por você e pela orientadora.\nQuem defende a tese? | Você. Preparamos você para chegar seguro à defesa.\nEm quais cursos orienta? | Ciências da saúde, ciências biológicas, educação e ciências sociais, na graduação e pós-graduação.",
    "cierre.titulo": "Sua defesa começa com uma conversa.",
  },
};

export function lineas(v: string | undefined): string[] {
  return (v ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function pares(v: string | undefined): [string, string][] {
  return lineas(v).map((l) => {
    const i = l.indexOf("|");
    return i === -1 ? [l, ""] : [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  });
}
