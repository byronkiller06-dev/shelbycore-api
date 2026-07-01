import { Injectable, NotFoundException } from '@nestjs/common';
import { ShelbyProduct } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './products.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.shelbyProduct.findMany({
      where: { tenantId },
      orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  listActive(tenantId: string) {
    return this.prisma.shelbyProduct.findMany({
      where: { tenantId, active: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(tenantId: string, id: string) {
    const p = await this.prisma.shelbyProduct.findFirst({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    return p;
  }

  create(tenantId: string, dto: CreateProductDto) {
    return this.prisma.shelbyProduct.create({
      data: { tenantId, ...dto },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto) {
    await this.get(tenantId, id);
    return this.prisma.shelbyProduct.update({ where: { id }, data: dto });
  }

  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    await this.prisma.shelbyProduct.delete({ where: { id } });
    return { ok: true };
  }

  /** Formatea productos activos como contexto para ORION. */
  async buildCatalogContext(tenantId: string): Promise<string> {
    const products = await this.listActive(tenantId);
    if (!products.length) return '';
    const lines = products.map((p: ShelbyProduct) => {
      const rubros = this.parseList(p.targetRubros).join(', ') || 'General';
      const problems = this.parseList(p.problems).join('; ') || '';
      return `• ${p.name}${p.price ? ` (${p.price})` : ''}: ${p.description}. Ideal para: ${p.idealClient || rubros}. Resuelve: ${problems}. Mensaje corto: ${p.shortMessage}`;
    });
    return `\nPRODUCTOS SHELBYCORE DISPONIBLES:\n${lines.join('\n')}`;
  }

  private parseList(json: string): string[] {
    try { return JSON.parse(json) as string[]; } catch { return []; }
  }
}
