import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let db = 'down';
    try { await this.prisma.$queryRaw`SELECT 1`; db = 'up'; } catch { db = 'down'; }
    return { status: 'ok', service: 'shelbycore-ai-api', db, orion: 'online', ts: new Date().toISOString() };
  }

  /** Public diagnostic — confirms which search source is active. NEVER exposes the key. */
  @Get('places')
  async placesCheck() {
    const key = process.env.GOOGLE_PLACES_API_KEY ?? '';

    if (!key) {
      return { configured: false, formatOk: false, source: 'openstreetmap', error: 'GOOGLE_PLACES_API_KEY no está configurada en Railway' };
    }

    const formatOk = key.length >= 35 && key.startsWith('AIza');
    if (!formatOk) {
      return { configured: true, formatOk: false, source: 'openstreetmap', error: 'La key no tiene el formato AIza... (Google Maps Platform)' };
    }

    // Live test — single cheap Text Search call, no user data involved
    try {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=restaurant+en+Mexico+City&language=es&key=${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const data = (await res.json()) as { status: string; error_message?: string };

      if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
        return { configured: true, formatOk: true, source: 'google_places', apiStatus: data.status };
      }

      return {
        configured: true,
        formatOk: true,
        source: 'openstreetmap',
        apiStatus: data.status,
        error: data.error_message ?? `Google Places respondió: ${data.status}`,
      };
    } catch (err) {
      return {
        configured: true,
        formatOk: true,
        source: 'openstreetmap',
        error: `Error de red al contactar Google Places: ${String((err as Error).message)}`,
      };
    }
  }
}
