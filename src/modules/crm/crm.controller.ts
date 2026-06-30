import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CrmService } from './crm.service';
import { CreateCustomerDto, UpdateCustomerDto } from './crm.dto';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { ScopesGuard } from '../../shared/auth/guards/scopes.guard';
import { Scopes } from '../../shared/auth/decorators/scopes.decorator';
import { CurrentTenant } from '../../shared/auth/decorators/current-user.decorator';
@UseGuards(JwtAuthGuard, ScopesGuard)
@Controller('crm/customers')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get() @Scopes('crm:read')
  list(@CurrentTenant() t: string, @Query('stage') stage?: string, @Query('search') search?: string) { return this.crm.list(t, stage, search); }

  @Get('summary') @Scopes('crm:read')
  summary(@CurrentTenant() t: string) { return this.crm.summary(t); }

  @Get(':id') @Scopes('crm:read')
  get(@CurrentTenant() t: string, @Param('id') id: string) { return this.crm.get(t, id); }

  @Post() @Scopes('crm:write')
  create(@CurrentTenant() t: string, @Body() dto: CreateCustomerDto) { return this.crm.create(t, dto); }

  @Patch(':id') @Scopes('crm:write')
  update(@CurrentTenant() t: string, @Param('id') id: string, @Body() dto: UpdateCustomerDto) { return this.crm.update(t, id, dto); }

  @Delete(':id') @Scopes('crm:write')
  remove(@CurrentTenant() t: string, @Param('id') id: string) { return this.crm.remove(t, id); }
}
