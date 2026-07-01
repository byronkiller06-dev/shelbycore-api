/**
 * Puerto de descubrimiento. ORION Prospect es agnóstico a la fuente:
 * hoy Google Places, mañana búsqueda web, directorios, etc.
 * Si NO hay proveedor configurado, NO se fabrican datos (cero ficticios).
 */
export interface DiscoveredCompany {
  company: string;
  category: string;
  city: string;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
  facebook?: string | null;
  instagram?: string | null;
}

export interface DiscoveryProvider {
  readonly name: string;
  available(): boolean;
  search(service: string, city: string, keyword?: string): Promise<DiscoveredCompany[]>;
}

export const DISCOVERY_PROVIDER = Symbol('DISCOVERY_PROVIDER');

/** Mapea un servicio Shelby a un término de búsqueda de negocios. */
const SERVICE_QUERY: Record<string, string> = {
  ShelbyPOS: 'minimarket tienda almacén',
  MiComunidad360: 'administradora de edificios condominios',
  ShelbyEats: 'restaurantes cafeterías',
  'Desarrollo Web': 'pymes negocios locales',
  'Desarrollo de Apps': 'servicios locales',
  'Automatización con IA': 'empresas pyme',
};

/**
 * Proveedor real basado en Google Places (Text Search + Details).
 * Requiere GOOGLE_PLACES_API_KEY. Node 18+ trae fetch global.
 */
export class GooglePlacesProvider implements DiscoveryProvider {
  readonly name = 'google-places';
  private readonly key = process.env.GOOGLE_PLACES_API_KEY ?? '';

  available(): boolean {
    return this.key.length > 0;
  }

  async search(service: string, city: string, keyword?: string): Promise<DiscoveredCompany[]> {
    if (!this.available()) return [];
    const term = `${keyword || SERVICE_QUERY[service] || service} en ${city}`;
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(term)}&language=es&key=${this.key}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      error_message?: string;
      results?: Array<{ place_id: string; name: string; formatted_address?: string; types?: string[] }>;
    };

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      const msg = `Google Places API error: ${data.status}${data.error_message ? ' — ' + data.error_message : ''}`;
      console.error('[GooglePlacesProvider]', msg);
      throw new Error(msg);
    }

    const top = (data.results ?? []).slice(0, 6);

    const out: DiscoveredCompany[] = [];
    for (const place of top) {
      const det = await this.details(place.place_id);
      out.push({
        company: place.name,
        category: (place.types?.[0] ?? 'establishment').replace(/_/g, ' '),
        city,
        phone: det.phone ?? null,
        website: det.website ?? null,
        email: null, // Places no expone correos; lo aporta el analizador web (preparado)
        facebook: null,
        instagram: null,
      });
    }
    return out;
  }

  private async details(placeId: string): Promise<{ phone?: string; website?: string }> {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,website&key=${this.key}`;
      const res = await fetch(url);
      const data = (await res.json()) as { result?: { formatted_phone_number?: string; website?: string } };
      return { phone: data.result?.formatted_phone_number, website: data.result?.website };
    } catch {
      return {};
    }
  }
}
