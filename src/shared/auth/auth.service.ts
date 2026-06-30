import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { DEFAULT_AGENTS } from '../../modules/agents/agents.seed';
import { GoogleProfile } from './google.strategy';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({ where: { email: dto.email } });
    if (existing) throw new ConflictException('El email ya está registrado');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const slug = dto.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '-' + Date.now().toString(36);

    const result = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name: dto.organizationName } });
      const tenant = await tx.tenant.create({
        data: { orgId: org.id, name: dto.organizationName, slug, status: 'ACTIVE' },
      });
      const adminRole = await tx.role.create({
        data: { tenantId: tenant.id, name: 'admin', scopes: JSON.stringify(['*']) },
      });
      await tx.role.create({ data: { tenantId: tenant.id, name: 'operator', scopes: JSON.stringify(['crm:read', 'crm:write', 'tasks:read', 'tasks:write', 'agents:read']) } });
      await tx.role.create({ data: { tenantId: tenant.id, name: 'viewer', scopes: JSON.stringify(['crm:read', 'tasks:read', 'agents:read']) } });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email,
          name: dto.name,
          passwordHash,
          roles: { connect: { id: adminRole.id } },
        },
      });

      await tx.agent.createMany({
        data: DEFAULT_AGENTS.map((a) => ({
          tenantId: tenant.id, code: a.code, name: a.name, domain: a.domain, manifest: JSON.stringify(a.manifest),
        })),
      });

      return { tenant, user, roles: ['admin'], scopes: ['*'] };
    });

    return this.sign(result.user.id, result.tenant.id, result.user.email, result.roles, result.scopes);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
      include: { roles: true },
    });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    const roles = user.roles.map((r) => r.name);
    const scopes = Array.from(new Set<string>(user.roles.flatMap((r) => JSON.parse(r.scopes) as string[])));
    return this.sign(user.id, user.tenantId, user.email, roles, scopes);
  }

  async googleLogin(profile: GoogleProfile) {
    const existing = await this.prisma.user.findFirst({
      where: { email: profile.email },
      include: { roles: true },
    });

    if (existing) {
      const roles = existing.roles.map((r) => r.name);
      const scopes = Array.from(new Set<string>(existing.roles.flatMap((r) => JSON.parse(r.scopes) as string[])));
      return this.sign(existing.id, existing.tenantId, existing.email, roles, scopes);
    }

    const orgName = profile.name || profile.email.split('@')[0];
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '-' + Date.now().toString(36);
    const passwordHash = await bcrypt.hash(randomUUID(), 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name: orgName } });
      const tenant = await tx.tenant.create({
        data: { orgId: org.id, name: orgName, slug, status: 'ACTIVE' },
      });
      const adminRole = await tx.role.create({
        data: { tenantId: tenant.id, name: 'admin', scopes: JSON.stringify(['*']) },
      });
      await tx.role.create({ data: { tenantId: tenant.id, name: 'operator', scopes: JSON.stringify(['crm:read', 'crm:write', 'tasks:read', 'tasks:write', 'agents:read']) } });
      await tx.role.create({ data: { tenantId: tenant.id, name: 'viewer', scopes: JSON.stringify(['crm:read', 'tasks:read', 'agents:read']) } });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: profile.email,
          name: profile.name,
          passwordHash,
          roles: { connect: { id: adminRole.id } },
        },
      });

      await tx.agent.createMany({
        data: DEFAULT_AGENTS.map((a) => ({
          tenantId: tenant.id, code: a.code, name: a.name, domain: a.domain, manifest: JSON.stringify(a.manifest),
        })),
      });

      return { tenant, user, roles: ['admin'], scopes: ['*'] };
    });

    return this.sign(result.user.id, result.tenant.id, result.user.email, result.roles, result.scopes);
  }

  private sign(sub: string, tid: string, email: string, roles: string[], scopes: string[]) {
    const token = this.jwt.sign({ sub, tid, email, roles, scopes });
    return { accessToken: token, user: { id: sub, email, roles, scopes, tenantId: tid } };
  }
}
