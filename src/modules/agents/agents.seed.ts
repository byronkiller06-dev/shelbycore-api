/** Flota base de agentes ShelbyCore AI (configuración del sistema). */
export const DEFAULT_AGENTS = [
  { code: 'COM', name: 'Comercial',     domain: 'Prospectos, calificación, propuestas, cierre', manifest: { model: 'frontier', skills: ['calificar_lead', 'crear_propuesta'] } },
  { code: 'MKT', name: 'Marketing',     domain: 'Campañas, calendario, horarios', manifest: { model: 'medium', skills: ['crear_campana'] } },
  { code: 'SUP', name: 'Atención',      domain: 'Consultas, FAQs, escalado', manifest: { model: 'medium', skills: ['responder_consulta'] } },
  { code: 'CNT', name: 'Contenido',     domain: 'Correos, WhatsApp, posts, imágenes', manifest: { model: 'medium', skills: ['redactar_correo_comercial'] } },
  { code: 'FUP', name: 'Seguimiento',   domain: 'Recordatorios, secuencias, leads fríos', manifest: { model: 'economy', skills: ['programar_seguimiento'] } },
  { code: 'RPT', name: 'Reportes',      domain: 'Resúmenes, métricas, pipeline', manifest: { model: 'economy', skills: ['resumir_conversacion'] } },
  { code: 'DEV', name: 'Desarrollo',    domain: 'Diseño técnico, integración', manifest: { model: 'frontier', skills: [] } },
  { code: 'PRG', name: 'Programador',   domain: 'Generación y edición de código', manifest: { model: 'frontier', skills: ['analizar_bug'] } },
  { code: 'QA',  name: 'QA',            domain: 'Pruebas, revisión, validación', manifest: { model: 'medium', skills: [] } },
  { code: 'FIN', name: 'Finanzas',      domain: 'Cotizaciones, cobros, reportes', manifest: { model: 'medium', skills: ['preparar_cotizacion'] } },
  { code: 'LEG', name: 'Legal',         domain: 'Términos, contratos, cumplimiento', manifest: { model: 'frontier', skills: ['revisar_contrato'] } },
  { code: 'DSG', name: 'Diseño',        domain: 'Identidad visual, piezas, UI', manifest: { model: 'medium', skills: ['generar_flyer'] } },
  { code: 'OPS', name: 'Operaciones',   domain: 'Coordinación interna, salud del sistema', manifest: { model: 'economy', skills: [] } },
  { code: 'DOC', name: 'Documentación', domain: 'Manuales, knowledge base', manifest: { model: 'medium', skills: [] } },
];
