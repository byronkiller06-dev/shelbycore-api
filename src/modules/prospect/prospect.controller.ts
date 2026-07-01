import { Body, Controller, Get, Post } from '@nestjs/common';
import { ProspectService } from './prospect.service';
import { DraftDto, SaveProspectDto, SearchProspectDto } from './prospect.dto';

/**
 * ORION Prospector · endpoints públicos para uso local standalone (sin login),
 * para que la plataforma funcione sin fricción. Si lo despliegas en internet,
 * vuelve a proteger estas rutas con JwtAuthGuard.
 */
@Controller('prospect')
export class ProspectController {
  constructor(private readonly prospect: ProspectService) {}

  @Get('status')
  status() { return this.prospect.status(); }

  /** Diagnostic — live Google Places test. Public. Never exposes the key. */
  @Get('places-test')
  async placesTest() {
    const key = process.env.GOOGLE_PLACES_API_KEY ?? '';
    if (!key) return { configured: false, source: 'openstreetmap', error: 'GOOGLE_PLACES_API_KEY no configurada' };

    const formatOk = key.length >= 35 && key.startsWith('AIza');
    if (!formatOk) return { configured: true, formatOk: false, source: 'openstreetmap', error: 'Formato de key incorrecto (debe empezar con AIza)' };

    try {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=sushi+Santiago+Chile&language=es&key=${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      const data = (await res.json()) as { status: string; error_message?: string; results?: unknown[] };
      return {
        configured: true,
        formatOk: true,
        source: data.status === 'OK' || data.status === 'ZERO_RESULTS' ? 'google_places' : 'openstreetmap',
        apiStatus: data.status,
        resultCount: Array.isArray(data.results) ? data.results.length : 0,
        error: data.status !== 'OK' && data.status !== 'ZERO_RESULTS'
          ? (data.error_message ?? `Google Places respondió: ${data.status}`)
          : undefined,
      };
    } catch (err) {
      return { configured: true, formatOk: true, source: 'openstreetmap', error: String((err as Error).message) };
    }
  }

  @Post('search')
  search(@Body() dto: SearchProspectDto) { return this.prospect.search(dto); }

  @Post('save')
  save(@Body() dto: SaveProspectDto) { return this.prospect.save(dto); }

  @Post('draft')
  draft(@Body() dto: DraftDto) { return this.prospect.draft(dto); }
}
