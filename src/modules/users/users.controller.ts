import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { ScopesGuard } from '../../shared/auth/guards/scopes.guard';
import { Scopes } from '../../shared/auth/decorators/scopes.decorator';
import { CurrentTenant } from '../../shared/auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, ScopesGuard)
@Controller('admin')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('users') @Scopes('admin:read')
  list(@CurrentTenant() t: string) { return this.users.list(t); }

  @Get('roles') @Scopes('admin:read')
  roles(@CurrentTenant() t: string) { return this.users.roles(t); }
}
