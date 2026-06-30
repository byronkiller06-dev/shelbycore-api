import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto, UpdateDocumentDto } from './documents.dto';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { ScopesGuard } from '../../shared/auth/guards/scopes.guard';
import { Scopes } from '../../shared/auth/decorators/scopes.decorator';
import { CurrentTenant } from '../../shared/auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, ScopesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  @Get() @Scopes('docs:read')
  list(@CurrentTenant() t: string) { return this.docs.list(t); }

  @Get(':id') @Scopes('docs:read')
  get(@CurrentTenant() t: string, @Param('id') id: string) { return this.docs.get(t, id); }

  @Post() @Scopes('docs:write')
  create(@CurrentTenant() t: string, @Body() dto: CreateDocumentDto) { return this.docs.create(t, dto); }

  @Patch(':id') @Scopes('docs:write')
  update(@CurrentTenant() t: string, @Param('id') id: string, @Body() dto: UpdateDocumentDto) { return this.docs.update(t, id, dto); }

  @Delete(':id') @Scopes('docs:write')
  remove(@CurrentTenant() t: string, @Param('id') id: string) { return this.docs.remove(t, id); }
}
