import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';

/**
 * Módulo PREPARADO (v3 §06 Planner / §07 Eventos). El motor durable de
 * automatizaciones (DAG, reintentos, secuencias de seguimiento) se activa por fases.
 */
@UseGuards(JwtAuthGuard)
@Controller('automations')
export class AutomationsController {
  @Get('status')
  status() {
    return { module: 'automations', status: 'prepared', engine: 'durable-planner (pendiente)' };
  }
}
