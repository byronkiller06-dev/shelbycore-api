import { Injectable, NotFoundException } from '@nestjs/common';
import { ShelbyProduct } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './products.dto';
import { OFFICIAL_CATALOG } from './catalog.seed';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    await this.seedIfEmpty(tenantId);
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

  /** Seed the official ShelbyCore catalog for this tenant if they have 0 products. */
  async seedIfEmpty(tenantId: string): Promise<void> {
    const count = await this.prisma.shelbyProduct.count({ where: { tenantId } });
    if (count > 0) return;
    await this.seedOfficialCatalog(tenantId);
  }

  /** Create official products that don't already exist (dedup by name). */
  async seedOfficialCatalog(tenantId: string): Promise<{ created: number; skipped: number }> {
    const existing = await this.prisma.shelbyProduct.findMany({
      where: { tenantId },
      select: { name: true },
    });
    const existingNames = new Set(existing.map(p => p.name.toLowerCase()));
    let created = 0;
    let skipped = 0;
    for (const p of OFFICIAL_CATALOG) {
      if (existingNames.has(p.name.toLowerCase())) { skipped++; continue; }
      await this.prisma.shelbyProduct.create({
        data: {
          tenantId,
          name: p.name,
          category: p.category,
          description: p.description,
          idealClient: p.idealClient,
          targetRubros: JSON.stringify(p.targetRubros),
          problems: JSON.stringify(p.problems),
          benefits: JSON.stringify(p.benefits),
          price: p.price,
          objections: JSON.stringify(p.objections),
          shortMessage: p.shortMessage,
          longMessage: p.longMessage,
          salesPriority: p.salesPriority,
          commercialMargin: p.commercialMargin,
          active: p.active,
        },
      });
      created++;
    }
    return { created, skipped };
  }

  /** Returns active products as context string for ORION. */
  async buildCatalogContext(tenantId: string): Promise<string> {
    const products = await this.listActive(tenantId);
    if (!products.length) return '';
    const lines = products.map((p: ShelbyProduct) => {
      const rubros   = this.parseList(p.targetRubros).join(', ') || 'General';
      const problems = this.parseList(p.problems).join('; ') || '';
      const benefits = this.parseList(p.benefits).join('; ') || '';
      const cat      = p.category || '';
      const priority = p.salesPriority || 'media';
      const margin   = p.commercialMargin || '';
      return [
        `• ${p.name}${cat ? ` [${cat}]` : ''}${p.price ? ` (${p.price})` : ''}`,
        `  Prioridad comercial: ${priority}${margin ? ` · Margen: ${margin}` : ''}`,
        `  ${p.description}`,
        `  Ideal para: ${p.idealClient || rubros}`,
        `  Resuelve: ${problems}`,
        `  Beneficios: ${benefits}`,
        `  Mensaje corto: ${p.shortMessage}`,
      ].join('\n');
    });
    return `\nCATÁLOGO SHELBYCORE (productos activos disponibles):\n${lines.join('\n---\n')}`;
  }

  /** Returns products matching a list of names (for cross-referencing package selections). */
  async findByNames(tenantId: string, names: string[]): Promise<ShelbyProduct[]> {
    if (!names.length) return [];
    return this.prisma.shelbyProduct.findMany({
      where: {
        tenantId,
        name: { in: names },
      },
    });
  }

  private parseList(json: string): string[] {
    try { return JSON.parse(json) as string[]; } catch { return []; }
  }
}
