import { Injectable, Logger } from '@nestjs/common';

export interface PlaceResult {
  name: string;
  address: string;
  phone?: string;
  website?: string;
  category: string;
  lat?: number;
  lon?: number;
  osmId?: number;
  placeId?: string;
  rating?: number;
  verified: boolean;
  source: 'openstreetmap' | 'google_places' | 'manual';
}

interface NominatimResult {
  boundingbox: [string, string, string, string];
  display_name: string;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

/** Human-readable Spanish labels for OSM category values */
const ES_LABELS: Record<string, string> = {
  restaurant: 'Restaurante', fast_food: 'Comida rápida', cafe: 'Café',
  bar: 'Bar', pub: 'Bar/Pub', bakery: 'Panadería', supermarket: 'Supermercado',
  marketplace: 'Mercado', convenience: 'Minimarket/Tienda', kiosk: 'Kiosco',
  hotel: 'Hotel', hostel: 'Hostal', guest_house: 'Hostal',
  pharmacy: 'Farmacia', clinic: 'Clínica', hospital: 'Hospital',
  dentist: 'Dentista', veterinary: 'Veterinaria', optician: 'Óptica',
  fitness_centre: 'Gimnasio', gym: 'Gimnasio', sports_centre: 'Centro deportivo',
  beauty: 'Belleza', hairdresser: 'Peluquería', barbershop: 'Barbería',
  clothes: 'Ropa', shoes: 'Calzado', boutique: 'Boutique',
  electronics: 'Electrónica', hardware: 'Ferretería', doityourself: 'Ferretería',
  car_repair: 'Taller mecánico', car_parts: 'Autopartes', car_wash: 'Autolavado',
  laundry: 'Lavandería', dry_cleaning: 'Tintorería',
  butcher: 'Carnicería', greengrocer: 'Verdulería', florist: 'Floristería',
  bakery_shop: 'Panadería', confectionery: 'Dulcería',
  travel_agency: 'Agencia de viajes',
  bicycle_shop: 'Bicicletería', mobile_phone: 'Celulares', computer: 'Computadoras',
  printing: 'Imprenta', photo: 'Fotografía',
  school: 'Escuela', kindergarten: 'Guardería', language_school: 'Centro de idiomas',
  accounting: 'Contador', insurance: 'Seguros', real_estate: 'Inmobiliaria',
  copyshop: 'Papelería/Copias',
};

/**
 * QUERY_MAP: maps Spanish user input → one or more OSM [key, value] tag pairs.
 * Multiple pairs = OR search (each pair is a separate union branch).
 */
const QUERY_MAP: Record<string, string[][]> = {
  // Alimentos
  restaurante: [['amenity', 'restaurant']],
  'comida rápida': [['amenity', 'fast_food']],
  'fast food': [['amenity', 'fast_food']],
  comida: [['amenity', 'restaurant'], ['amenity', 'fast_food'], ['amenity', 'cafe']],
  cafe: [['amenity', 'cafe']],
  café: [['amenity', 'cafe']],
  cafetería: [['amenity', 'cafe']],
  bar: [['amenity', 'bar'], ['amenity', 'pub']],
  panadería: [['shop', 'bakery']],
  pastelería: [['shop', 'bakery'], ['shop', 'confectionery']],
  dulcería: [['shop', 'confectionery']],
  carnicería: [['shop', 'butcher']],
  verdulería: [['shop', 'greengrocer']],
  floristería: [['shop', 'florist']],
  // Supermercados y tiendas
  supermercado: [['shop', 'supermarket']],
  minimarket: [['shop', 'convenience']],
  tienda: [['shop', 'convenience'], ['shop', 'general']],
  almacén: [['shop', 'convenience'], ['shop', 'supermarket']],
  abarrotes: [['shop', 'convenience'], ['shop', 'supermarket']],
  ferretería: [['shop', 'hardware'], ['shop', 'doityourself']],
  // Moda
  ropa: [['shop', 'clothes']],
  calzado: [['shop', 'shoes']],
  zapatos: [['shop', 'shoes']],
  boutique: [['shop', 'clothes'], ['shop', 'boutique']],
  // Salud
  farmacia: [['amenity', 'pharmacy']],
  clínica: [['amenity', 'clinic']],
  hospital: [['amenity', 'hospital']],
  dentista: [['amenity', 'dentist']],
  veterinaria: [['amenity', 'veterinary']],
  óptica: [['shop', 'optician']],
  // Belleza y bienestar
  peluquería: [['shop', 'hairdresser']],
  barbería: [['shop', 'hairdresser'], ['shop', 'barber']],
  estética: [['shop', 'beauty'], ['shop', 'hairdresser']],
  spa: [['leisure', 'spa']],
  // Deporte
  gimnasio: [['leisure', 'fitness_centre']],
  gym: [['leisure', 'fitness_centre']],
  deportes: [['leisure', 'sports_centre'], ['shop', 'sports']],
  // Mecánica y autos
  'taller mecánico': [['shop', 'car_repair']],
  taller: [['shop', 'car_repair']],
  mecánica: [['shop', 'car_repair']],
  autopartes: [['shop', 'car_parts']],
  autolavado: [['amenity', 'car_wash']],
  // Alojamiento
  hotel: [['tourism', 'hotel']],
  hostal: [['tourism', 'hostel'], ['tourism', 'guest_house']],
  // Tecnología
  electrónica: [['shop', 'electronics']],
  computadoras: [['shop', 'computer']],
  celulares: [['shop', 'mobile_phone']],
  // Servicios
  lavandería: [['shop', 'laundry']],
  tintorería: [['shop', 'dry_cleaning']],
  imprenta: [['shop', 'copyshop'], ['shop', 'printing']],
  papelería: [['shop', 'stationery'], ['shop', 'copyshop']],
  fotografía: [['shop', 'photo']],
  // Educación
  escuela: [['amenity', 'school']],
  guardería: [['amenity', 'kindergarten']],
  idiomas: [['amenity', 'language_school']],
  // Finanzas y servicios pro
  contador: [['office', 'accountant']],
  seguros: [['office', 'insurance']],
  inmobiliaria: [['office', 'estate_agent']],
};

/** Alternative fallback tag sets to try if the primary query returns 0 results */
const FALLBACK_TAGS: Record<string, string[][]> = {
  comida: [['amenity', 'restaurant'], ['amenity', 'fast_food'], ['amenity', 'food_court']],
  tienda: [['shop', 'supermarket'], ['shop', 'department_store']],
  gimnasio: [['leisure', 'sports_centre']],
  taller: [['craft', 'car_repair']],
};

const OVERPASS_API_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const OVERPASS_TIMEOUT_MS = 22_000;
const GEOCODE_TIMEOUT_MS = 10_000;

@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);

  async searchBusinesses(query: string, location: string, limit = 20): Promise<PlaceResult[]> {
    const MINIMUM = 15;
    const googleKey = process.env.GOOGLE_PLACES_API_KEY ?? '';
    let gpResults: PlaceResult[] = [];

    if (this.isValidGoogleKey(googleKey)) {
      this.logger.log('Google Places key detected — attempting Google Places search');
      try {
        gpResults = await this.searchGooglePlaces(query, location, limit, googleKey);
        this.logger.log(`Google Places returned ${gpResults.length} results`);
      } catch (err) {
        this.logger.warn(`Google Places failed (${String((err as Error).message)}), falling back to OSM`);
      }
    }

    // If Google Places returned enough, return them directly
    if (gpResults.length >= MINIMUM) return gpResults;

    // Complement with OSM to reach at least MINIMUM results
    const needMore = gpResults.length < MINIMUM;
    if (needMore) {
      this.logger.log(`Google Places returned ${gpResults.length} (< ${MINIMUM}), complementing with OSM`);
    }
    const osmResults = await this.searchOSM(query, location, limit);

    const seen = new Set(gpResults.map(r => r.name.toLowerCase()));
    for (const r of osmResults) {
      if (!seen.has(r.name.toLowerCase())) {
        gpResults.push(r);
        seen.add(r.name.toLowerCase());
        if (gpResults.length >= limit) break;
      }
    }

    return gpResults;
  }

  // ─── OSM / Overpass ───────────────────────────────────────────

  private async searchOSM(query: string, location: string, limit: number): Promise<PlaceResult[]> {
    try {
      const bbox = await this.geocode(location);
      if (!bbox) {
        this.logger.warn(`Geocoding sin resultado para: "${location}"`);
        return [];
      }

      const normalizedQuery = query.toLowerCase().trim();
      const primaryTags = this.resolveTagFilters(normalizedQuery);

      let results = await this.runOverpassQuery(primaryTags, bbox, limit, normalizedQuery);

      // Fallback: if primary tags returned nothing, try broader alternatives
      if (results.length === 0) {
        const fallbackKey = Object.keys(FALLBACK_TAGS).find(k => normalizedQuery.includes(k));
        if (fallbackKey) {
          this.logger.log(`No results with primary tags, trying fallback for "${fallbackKey}"`);
          results = await this.runOverpassQuery(FALLBACK_TAGS[fallbackKey], bbox, limit, normalizedQuery);
        }
      }

      // Second fallback: generic name-based search
      if (results.length === 0) {
        this.logger.log(`Still 0 results, trying name-based search for "${query}"`);
        results = await this.runOverpassQuery([['name', query]], bbox, limit, normalizedQuery);
      }

      return results;
    } catch (err) {
      this.logger.error('searchOSM error', err);
      return [];
    }
  }

  private async geocode(location: string): Promise<string | null> {
    // Try full query first, then city-only
    for (const q of [location, location.split(',')[0].trim()]) {
      const result = await this.nominatimSearch(q);
      if (result) return result;
    }
    return null;
  }

  private async nominatimSearch(q: string): Promise<string | null> {
    try {
      // No featuretype restriction — works for neighborhoods, boroughs, municipalities, etc.
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=3&addressdetails=0`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'ORION-ShelbyCore/1.0 byronkiller06@gmail.com' },
        signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as NominatimResult[];
      if (!data.length) return null;
      const [s, n, w, e] = data[0].boundingbox;
      return `${s},${w},${n},${e}`;
    } catch {
      return null;
    }
  }

  private resolveTagFilters(query: string): string[][] {
    // Exact match first
    if (QUERY_MAP[query]) return QUERY_MAP[query];
    // Substring match (longest key wins)
    const matchingKey = Object.keys(QUERY_MAP)
      .filter(k => query.includes(k))
      .sort((a, b) => b.length - a.length)[0];
    if (matchingKey) return QUERY_MAP[matchingKey];
    // Nothing found → search by name substring in OSM
    return [['name', query]];
  }

  private async runOverpassQuery(
    tagFilters: string[][],
    bbox: string,
    limit: number,
    _rawQuery: string,
  ): Promise<PlaceResult[]> {
    const overpassQuery = this.buildOverpassQuery(tagFilters, bbox, limit + 15);
    try {
      const res = await fetch(OVERPASS_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
      });
      if (!res.ok) {
        this.logger.error(`Overpass HTTP ${res.status}`);
        return [];
      }
      const data = (await res.json()) as OverpassResponse;
      return this.parseElements(data.elements ?? [], limit);
    } catch (err) {
      this.logger.error('Overpass query error', err);
      return [];
    }
  }

  private buildOverpassQuery(tagFilters: string[][], bbox: string, limit: number): string {
    const isNameSearch = tagFilters.length === 1 && tagFilters[0][0] === 'name';

    let nodeLines: string;
    if (isNameSearch) {
      const val = tagFilters[0][1];
      nodeLines = [
        `node["name"~"${val}",i]["amenity"](${bbox});`,
        `way["name"~"${val}",i]["amenity"](${bbox});`,
        `node["name"~"${val}",i]["shop"](${bbox});`,
        `way["name"~"${val}",i]["shop"](${bbox});`,
        `node["name"~"${val}",i]["leisure"](${bbox});`,
        `way["name"~"${val}",i]["leisure"](${bbox});`,
      ].join('\n');
    } else {
      // Build union of all tag pairs — node + way for each
      nodeLines = tagFilters
        .map(([k, v]) => `node["${k}"="${v}"](${bbox});\nway["${k}"="${v}"](${bbox});`)
        .join('\n');
    }

    return `[out:json][timeout:20];\n(\n${nodeLines}\n);\nout center ${limit};`;
  }

  private parseElements(elements: OverpassElement[], limit: number): PlaceResult[] {
    const seen = new Set<string>();
    const results: PlaceResult[] = [];

    for (const el of elements) {
      if (results.length >= limit) break;
      const tags = el.tags ?? {};
      const name = tags.name;
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());

      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;

      const addrParts = [
        tags['addr:street'],
        tags['addr:housenumber'],
        tags['addr:suburb'] ?? tags['addr:colonia'] ?? tags['addr:neighbourhood'],
        tags['addr:city'] ?? tags['addr:municipality'],
      ].filter(Boolean);

      const rawCat = tags.amenity ?? tags.shop ?? tags.tourism ?? tags.leisure ?? tags.office ?? tags.craft ?? 'negocio';
      const category = ES_LABELS[rawCat] ?? rawCat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      results.push({
        name,
        address: addrParts.length ? addrParts.join(', ') : (tags['addr:full'] ?? ''),
        phone: tags.phone ?? tags['contact:phone'] ?? tags['phone:mobile'],
        website: tags.website ?? tags['contact:website'] ?? tags['contact:url'],
        category,
        lat,
        lon,
        osmId: el.id,
        verified: true,
        source: 'openstreetmap',
      });
    }

    return results;
  }

  // ─── Key status (for /orion/places-status endpoint) ──────────

  async keyStatus(): Promise<{
    configured: boolean;
    formatOk: boolean;
    source: 'google_places' | 'openstreetmap';
    apiStatus?: string;
    error?: string;
  }> {
    const key = process.env.GOOGLE_PLACES_API_KEY ?? '';
    if (!key) return { configured: false, formatOk: false, source: 'openstreetmap' };
    if (!this.isValidGoogleKey(key)) return { configured: true, formatOk: false, source: 'openstreetmap', error: 'La key no tiene el formato AIza... esperado para Google Maps Platform' };

    // Minimal test: search for "restaurant" near "Mexico City" — cheap single call
    try {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=restaurant+en+Mexico+City&language=es&key=${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const data = (await res.json()) as { status: string };
      if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
        return { configured: true, formatOk: true, source: 'google_places', apiStatus: data.status };
      }
      return { configured: true, formatOk: true, source: 'openstreetmap', apiStatus: data.status, error: `Google Places respondió: ${data.status}` };
    } catch (err) {
      return { configured: true, formatOk: true, source: 'openstreetmap', error: `No se pudo conectar a Google Places: ${String((err as Error).message)}` };
    }
  }

  // ─── Google Places (only when key is valid) ───────────────────

  private isValidGoogleKey(key: string): boolean {
    // Google API keys are 39 chars, start with "AIza"
    return key.length >= 35 && key.startsWith('AIza');
  }

  private async searchGooglePlaces(query: string, location: string, limit: number, key: string): Promise<PlaceResult[]> {
    const term = encodeURIComponent(`${query} en ${location}`);
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${term}&language=es&key=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    const data = (await res.json()) as {
      status: string;
      results?: Array<{ place_id: string; name: string; formatted_address?: string; types?: string[]; rating?: number }>;
    };

    if (data.status === 'REQUEST_DENIED' || data.status === 'INVALID_REQUEST') {
      throw new Error(`Google Places API error: ${data.status}`);
    }

    const top = (data.results ?? []).slice(0, limit);
    const out: PlaceResult[] = [];
    for (const place of top) {
      const det = await this.googlePlaceDetails(place.place_id, key);
      out.push({
        name: place.name,
        address: place.formatted_address ?? '',
        phone: det.phone,
        website: det.website,
        category: (place.types?.[0] ?? 'establishment').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        placeId: place.place_id,
        rating: place.rating,
        verified: true,
        source: 'google_places',
      });
    }
    return out;
  }

  private async googlePlaceDetails(placeId: string, key: string): Promise<{ phone?: string; website?: string }> {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,website&key=${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      const data = (await res.json()) as { result?: { formatted_phone_number?: string; website?: string } };
      return { phone: data.result?.formatted_phone_number, website: data.result?.website };
    } catch {
      return {};
    }
  }
}
