/**
 * Catálogo de servicios externos de ORION y su costo estimado (CLP por llamada).
 * `paid:false` = sin costo directo (no consume presupuesto, siempre permitido).
 * Los valores son estimaciones razonables; ajustables aquí en un solo lugar.
 */
export interface ServiceDef {
  key: string;
  label: string;
  paid: boolean;
  unitCostClp: number;
  /** Variable de entorno que indica si el servicio está activo/configurado. */
  envFlag?: string;
}

export const SERVICE_CATALOG: Record<string, ServiceDef> = {
  gemini: { key: 'gemini', label: 'Gemini API', paid: true, unitCostClp: 10, envFlag: 'GEMINI_API_KEY' },
  'google-places': { key: 'google-places', label: 'Google Places API', paid: true, unitCostClp: 30, envFlag: 'GOOGLE_PLACES_API_KEY' },
  'google-places-details': { key: 'google-places-details', label: 'Places Details', paid: true, unitCostClp: 17, envFlag: 'GOOGLE_PLACES_API_KEY' },
  'google-geocoding': { key: 'google-geocoding', label: 'Geocoding API', paid: true, unitCostClp: 5, envFlag: 'GOOGLE_PLACES_API_KEY' },
  'custom-search': { key: 'custom-search', label: 'Custom Search API', paid: true, unitCostClp: 5, envFlag: 'GOOGLE_CSE_API_KEY' },
  'meta-whatsapp': { key: 'meta-whatsapp', label: 'Meta / WhatsApp Business', paid: true, unitCostClp: 30, envFlag: 'META_WHATSAPP_TOKEN' },
  gmail: { key: 'gmail', label: 'Gmail API', paid: false, unitCostClp: 0, envFlag: 'GMAIL_ENABLED' },
  'google-calendar': { key: 'google-calendar', label: 'Google Calendar API', paid: false, unitCostClp: 0, envFlag: 'GOOGLE_CALENDAR_ENABLED' },
};

export function serviceDef(key: string): ServiceDef {
  return SERVICE_CATALOG[key] ?? { key, label: key, paid: true, unitCostClp: 0 };
}
