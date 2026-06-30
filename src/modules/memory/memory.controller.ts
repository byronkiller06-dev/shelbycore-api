import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';

/**
 * Módulo PREPARADO (v3 §05 / §12). Estructura lista; las capas L0–L3,
 * el vector store (pgvector) y la sincronización se implementan por fases.
 */
@UseGuards(JwtAuthGuard)
@Controller('memory')
export class MemoryController {
  @Get('status')
  status() {
    return { module: 'memory', status: 'prepared', layers: ['L0', 'L1', 'L2', 'L3'], vector: 'pgvector (pendiente)' };
  }
}
