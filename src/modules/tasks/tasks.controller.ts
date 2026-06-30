import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto } from './tasks.dto';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { ScopesGuard } from '../../shared/auth/guards/scopes.guard';
import { Scopes } from '../../shared/auth/decorators/scopes.decorator';
import { CurrentTenant } from '../../shared/auth/decorators/current-user.decorator';
@UseGuards(JwtAuthGuard, ScopesGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get() @Scopes('tasks:read')
  list(@CurrentTenant() t: string, @Query('state') state?: string) { return this.tasks.list(t, state); }

  @Get('board') @Scopes('tasks:read')
  board(@CurrentTenant() t: string) { return this.tasks.board(t); }

  @Post() @Scopes('tasks:write')
  create(@CurrentTenant() t: string, @Body() dto: CreateTaskDto) { return this.tasks.create(t, dto); }

  @Patch(':id') @Scopes('tasks:write')
  update(@CurrentTenant() t: string, @Param('id') id: string, @Body() dto: UpdateTaskDto) { return this.tasks.update(t, id, dto); }

  @Delete(':id') @Scopes('tasks:write')
  remove(@CurrentTenant() t: string, @Param('id') id: string) { return this.tasks.remove(t, id); }
}
