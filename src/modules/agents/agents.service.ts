import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.agent.findMany({ where: { tenantId }, orderBy: { code: 'asc' } });
  }

  async get(tenantId: string, id: string) {
    const agent = await this.prisma.agent.findFirst({ where: { id, tenantId } });
    if (!agent) throw new NotFoundException('Agente no encontrado');
    return agent;
  }

  async setStatus(tenantId: string, id: string, status: string) {
    await this.get(tenantId, id);
    return this.prisma.agent.update({ where: { id }, data: { status } });
  }

  async stats(tenantId: string) {
    const agents = await this.prisma.agent.findMany({ where: { tenantId } });
    return {
      total: agents.length,
      active: agents.filter((a) => a.status === 'ACTIVE').length,
      down: agents.filter((a) => a.status === 'DOWN').length,
    };
  }
}
