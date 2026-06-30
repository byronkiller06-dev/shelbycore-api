import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './crm.dto';

const PIPELINE_STAGES = ['LEAD', 'PROSPECT', 'NEGOTIATION', 'CUSTOMER', 'LOST'];

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, stage?: string, search?: string) {
    return this.prisma.customer.findMany({
      where: {
        tenantId,
        ...(stage ? { stage } : {}),
        ...(search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { company: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(tenantId: string, id: string) {
    const c = await this.prisma.customer.findFirst({ where: { id, tenantId }, include: { tasks: true, documents: true } });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    return c;
  }

  async create(tenantId: string, dto: CreateCustomerDto) {
    const customer = await this.prisma.customer.create({ data: { tenantId, ...dto } });
    await this.prisma.eventLog.create({ data: { tenantId, type: 'customer.created', payload: JSON.stringify({ id: customer.id }) } });
    return customer;
  }

  async update(tenantId: string, id: string, dto: UpdateCustomerDto) {
    await this.get(tenantId, id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    await this.prisma.customer.delete({ where: { id } });
    return { ok: true };
  }

  async summary(tenantId: string) {
    const customers = await this.prisma.customer.findMany({ where: { tenantId } });
    const hot = customers.filter((c) => c.score >= 0.7).length;
    const open = customers.filter((c) => c.stage === 'PROSPECT' || c.stage === 'NEGOTIATION');
    const pipeline = open.reduce((s, c) => s + c.value, 0);
    return {
      total: customers.length,
      hotLeads: hot,
      openOpportunities: open.length,
      pipelineValue: pipeline,
      byStage: Object.fromEntries(
        PIPELINE_STAGES.map((s): [string, number] => [s, customers.filter((c) => c.stage === s).length]),
      ),
    };
  }
}
