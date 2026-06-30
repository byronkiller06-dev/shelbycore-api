import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { ScopesGuard } from '../../shared/auth/guards/scopes.guard';
import { Scopes } from '../../shared/auth/decorators/scopes.decorator';
import { CurrentTenant } from '../../shared/auth/decorators/current-user.decorator';
@UseGuards(JwtAuthGuard, ScopesGuard)
@Controller('agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get() @Scopes('agents:read')
  list(@CurrentTenant() tenantId: string) { return this.agents.list(tenantId); }

  @Get('stats') @Scopes('agents:read')
  stats(@CurrentTenant() tenantId: string) { return this.agents.stats(tenantId); }

  @Get(':id') @Scopes('agents:read')
  get(@CurrentTenant() tenantId: string, @Param('id') id: string) { return this.agents.get(tenantId, id); }

  @Patch(':id/status') @Scopes('agents:write')
  setStatus(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body('status') status: string) {
    return this.agents.setStatus(tenantId, id, status);
  }
}
