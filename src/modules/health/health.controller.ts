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
}
