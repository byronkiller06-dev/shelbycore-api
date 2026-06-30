import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateDocumentDto, UpdateDocumentDto } from './documents.dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.document.findMany({ where: { tenantId }, orderBy: { updatedAt: 'desc' } });
  }

  async get(tenantId: string, id: string) {
    const doc = await this.prisma.document.findFirst({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    return doc;
  }

  create(tenantId: string, dto: CreateDocumentDto) {
    return this.prisma.document.create({ data: { tenantId, ...dto } });
  }

  async update(tenantId: string, id: string, dto: UpdateDocumentDto) {
    await this.get(tenantId, id);
    return this.prisma.document.update({ where: { id }, data: dto });
  }

  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    await this.prisma.document.delete({ where: { id } });
    return { ok: true };
  }
}
