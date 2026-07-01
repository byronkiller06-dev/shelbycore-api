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

const ES_LABELS: Record<string, string> = {
  restaurant: 'Restaurante', fast_food: 'Comida rápida', cafe: 'Café',
  bar: 'Bar', pub: 'Bar/Pub', bakery: 'Panadería', supermarket: 'Supermercado',
  hotel: 'Hotel', hostel: 'Hostal', pharmacy: 'Farmacia', clinic: 'Clínica',
  hospital: 'Hospital', gym: 'Gimnasio', fitness_centre: 'Gimnasio',
  beauty: 'Belleza', hairdresser: 'Peluquería', clothes: 'Ropa',
  electronics: 'Electrónica', hardware: 'Ferretería', convenience: 'Tienda',
  butcher: 'Carnicería', laundry: 'Lavandería', optician: 'Óptica',
};

const QUERY_MAP: Record<string, string[][]> = {
  restaurante: [['amenity', 'restaurant'], ['amenity', 'fast_food']],
  comida: [['amenity', 'restaurant'], ['amenity', 'fast_food']],
  cafe: [['amenity', 'cafe']],
  café: [['amenity', 'cafe']],
  bar: [['amenity', 'bar'], ['amenity', 'pub']],
  hotel: [['tourism', 'hotel'], ['tourism', 'hostel']],
  farmacia: [['amenity', 'pharmacy']],
  gym: [['leisure', 'fitness_centre']],
  gimnasio: [['leisure', 'fitness_centre']],
  tienda: [['shop', 'convenience'], ['shop', 'clothes']],
  ropa: [['shop', 'clothes']],
  electrónica: [['shop', 'electronics']],
  ferretería: [['shop', 'hardware']],
  peluquería: [['shop', 'hairdresser']],
  panadería: [['shop', 'bakery']],
  supermercado: [['shop', 'supermarket']],
  clínica: [['amenity', 'clinic'], ['amenity', 'hospital']],
  lavandería: [['shop', 'laundry']],
};

@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);

  async searchBusinesses(query: string, location: string, limit = 20): Promise<PlaceResult[]> {
    try {
      const bbox = await this.geocode(location);
      if (!bbox) {
        this.logger.warn(`No se encontró ubicación: ${location}`);
        return [];
      }

      const tags = this.resolveTagFilters(query);
      const overpassQuery = this.buildOverpassQuery(tags, bbox, limit + 10);

      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: AbortSignal.timeout(20_000),
      });

      if (!res.ok) {
        this.logger.error(`Overpass HTTP ${res.status}`);
        return [];
      }

      const data = (await res.json()) as OverpassResponse;
      return this.parseElements(data.elements ?? [], limit);
    } catch (err) {
      this.logger.error('searchBusinesses error', err);
      return [];
    }
  }

  private async geocode(location: string): Promise<string | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1&featuretype=city`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'ORION-ShelbyCore/1.0 byronkiller06@gmail.com' },
        signal: AbortSignal.timeout(8_000),
      });
      const data = (await res.json()) as NominatimResult[];
      if (!data.length) return null;
      const [s, n, w, e] = data[0].boundingbox;
      return `${s},${w},${n},${e}`;
    } catch {
      return null;
    }
  }

  private resolveTagFilters(query: string): string[][] {
    const q = query.toLowerCase().trim();
    for (const [key, filters] of Object.entries(QUERY_MAP)) {
      if (q.includes(key)) return filters;
    }
    // Generic: search by name
    return [['name', query]];
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
      ].join('\n');
    } else {
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
      if (!name || seen.has(name)) continue;
      seen.add(name);

      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;

      const addrParts = [
        tags['addr:street'],
        tags['addr:housenumber'],
        tags['addr:suburb'] ?? tags['addr:colonia'],
        tags['addr:city'],
      ].filter(Boolean);

      const rawCat = tags.amenity ?? tags.shop ?? tags.tourism ?? tags.leisure ?? 'negocio';
      const category = ES_LABELS[rawCat] ?? rawCat.charAt(0).toUpperCase() + rawCat.slice(1);

      results.push({
        name,
        address: addrParts.length ? addrParts.join(', ') : (tags['addr:full'] ?? ''),
        phone: tags.phone ?? tags['contact:phone'],
        website: tags.website ?? tags['contact:website'],
        category,
        lat,
        lon,
        osmId: el.id,
      });
    }

    return results;
  }
}
