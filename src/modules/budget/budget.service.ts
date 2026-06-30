import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { SERVICE_CATALOG, serviceDef } from './budget.catalog';
import { RecordUsageDto } from './budget.dto';

export interface GateResult {
  allowed: boolean;
  reason?: string;
  remainingClp: number;
}

const BUDGET_MESSAGE = 'Presupuesto mensual alcanzado. Aumenta el límite para seguir buscando oportunidades.';

@Injectable()
export class BudgetService {
  private readonly logger = new Logger('OrionBudget');

  constructor(private readonly prisma: PrismaService) {}

  /** Config del tenant; la crea con el default oficial (10000 CLP) si no existe. */
  async getConfig(tenantId: string) {
    let cfg = await this.prisma.budgetConfig.findUnique({ where: { tenantId } });
    if (!cfg) cfg = await this.prisma.budgetConfig.create({ data: { tenantId, monthlyLimitClp: 10000 } });
    return cfg;
  }

  async updateLimit(tenantId: string, monthlyLimitClp: number) {
    return this.prisma.budgetConfig.upsert({
      where: { tenantId },
      update: { monthlyLimitClp },
      create: { tenantId, monthlyLimitClp },
    });
  }

  /** Costo estimado de N llamadas a un servicio. */
  estimate(service: string, units = 1): number {
    return serviceDef(service).unitCostClp * units;
  }

  private monthStart(): Date {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  }

  private async monthUsage(tenantId: string) {
    return this.prisma.apiUsage.findMany({
      where: { tenantId, createdAt: { gte: this.monthStart() } },
    });
  }

  /** GATE CENTRAL: ¿se puede ejecutar una llamada pagada sin pasar el presupuesto? */
  async canUseExternalService(tenantId: string, service: string, estimatedCost?: number): Promise<GateResult> {
    const def = serviceDef(service);
    // Servicios sin costo directo: siempre permitidos.
    if (!def.paid) return { allowed: true, remainingClp: Infinity };

    try {
      const cfg = await this.getConfig(tenantId);
      const usage = await this.monthUsage(tenantId);
      const used = usage.reduce((s, u) => s + u.estimatedCostClp, 0);
      const remaining = cfg.monthlyLimitClp - used;
      const cost = estimatedCost ?? def.unitCostClp;

      if (used >= cfg.monthlyLimitClp || remaining < cost) {
        this.logger.warn(`BLOQUEADO ${service}: usado ${used}/${cfg.monthlyLimitClp} CLP.`);
        return { allowed: false, reason: BUDGET_MESSAGE, remainingClp: Math.max(0, remaining) };
      }
      return { allowed: true, remainingClp: remaining };
    } catch (e) {
      // Fail-closed: si no se puede verificar el presupuesto, NO se gasta.
      this.logger.error(`No se pudo verificar presupuesto (¿DB?): ${String((e as Error).message)}`);
      return { allowed: false, reason: 'No se pudo verificar el presupuesto (base de datos no disponible).', remainingClp: 0 };
    }
  }

  /** Registra un uso de API (item 12 y 13). */
  async record(tenantId: string, dto: RecordUsageDto) {
    const cost = dto.estimatedCostClp ?? this.estimate(dto.service);
    return this.prisma.apiUsage.create({
      data: {
        tenantId, service: dto.service, endpoint: dto.endpoint,
        estimatedCostClp: cost, executor: dto.executor ?? 'ORION', result: dto.result ?? 'ok',
      },
    });
  }

  private activeFlag(envFlag?: string): boolean {
    if (!envFlag) return false;
    return Boolean(process.env[envFlag] && String(process.env[envFlag]).length > 0);
  }

  /** Estado completo para el panel de la UI. */
  async status(tenantId: string) {
    const cfg = await this.getConfig(tenantId);
    const usage = await this.monthUsage(tenantId);
    const used = usage.reduce((s, u) => s + u.estimatedCostClp, 0);
    const remaining = Math.max(0, cfg.monthlyLimitClp - used);
    const percent = cfg.monthlyLimitClp > 0 ? Math.min(100, Math.round((used / cfg.monthlyLimitClp) * 100)) : 0;

    const perService = Object.values(SERVICE_CATALOG).map((def) => {
      const rows = usage.filter((u) => u.service === def.key);
      return {
        key: def.key, label: def.label, paid: def.paid,
        active: this.activeFlag(def.envFlag),
        unitCostClp: def.unitCostClp,
        calls: rows.length,
        costClp: rows.reduce((s, r) => s + r.estimatedCostClp, 0),
      };
    });

    const history = [...usage]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 25)
      .map((u) => ({ service: u.service, endpoint: u.endpoint, costClp: u.estimatedCostClp, executor: u.executor, result: u.result, at: u.createdAt }));

    return {
      monthlyLimitClp: cfg.monthlyLimitClp,
      usedClp: used,
      remainingClp: remaining,
      percent,
      alert80: percent >= 80,
      blocked: used >= cfg.monthlyLimitClp,
      perService,
      history,
    };
  }
}
