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

  @Post('search')
  search(@Body() dto: SearchProspectDto) { return this.prospect.search(dto); }

  @Post('save')
  save(@Body() dto: SaveProspectDto) { return this.prospect.save(dto); }

  @Post('draft')
  draft(@Body() dto: DraftDto) { return this.prospect.draft(dto); }
}
