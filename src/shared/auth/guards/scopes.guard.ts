import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SCOPES_KEY } from '../decorators/scopes.decorator';
import { AuthUser } from '../decorators/current-user.decorator';

@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(SCOPES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const user: AuthUser = ctx.switchToHttp().getRequest().user;
    const scopes = user?.scopes ?? [];
    if (scopes.includes('*')) return true;
    const ok = required.every((s) => scopes.includes(s));
    if (!ok) throw new ForbiddenException('Permisos insuficientes');
    return true;
  }
}
