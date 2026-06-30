import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateTaskDto, UpdateTaskDto } from './tasks.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, state?: string) {
    return this.prisma.task.findMany({
      where: { tenantId, ...(state ? { state } : {}) },
      include: { agent: { select: { code: true, name: true } }, customer: { select: { name: true } } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async get(tenantId: string, id: string) {
    const task = await this.prisma.task.findFirst({ where: { id, tenantId } });
    if (!task) throw new NotFoundException('Tarea no encontrada');
    return task;
  }

  async create(tenantId: string, dto: CreateTaskDto) {
    const task = await this.prisma.task.create({
      data: { tenantId, title: dto.title, intent: dto.intent, agentId: dto.agentId, customerId: dto.customerId, priority: dto.priority, dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined },
    });
    await this.prisma.eventLog.create({ data: { tenantId, type: 'task.created', payload: JSON.stringify({ id: task.id }) } });
    return task;
  }

  async update(tenantId: string, id: string, dto: UpdateTaskDto) {
    await this.get(tenantId, id);
    return this.prisma.task.update({
      where: { id },
      data: { ...dto, dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    await this.prisma.task.delete({ where: { id } });
    return { ok: true };
  }

  async board(tenantId: string) {
    const tasks = await this.prisma.task.findMany({ where: { tenantId } });
    return {
      inProgress: tasks.filter((t) => t.state === 'RUNNING').length,
      blocked: tasks.filter((t) => t.state === 'BLOCKED').length,
      pending: tasks.filter((t) => t.state === 'PENDING').length,
      done: tasks.filter((t) => t.state === 'DONE').length,
    };
  }
}
