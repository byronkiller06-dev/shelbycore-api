import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { OrionAiService } from './orion-ai.service';
import { SystemPrompts } from './prompts/system-prompts';

// ─── Interfaces internas ───────────────────────────────────────

interface BusinessAnalysis {
  industry: string; estimatedSize: string; economicPotential: string;
  shelbyCompatibility: number; urgencySignals: string[]; painPoints: string[];
}
interface CommercialDecision { worthSelling: boolean; reason: string; confidence: number; }
interface SelectedStrategy { type: string; name: string; approach: string; reason: string; openingLine: string; }
interface LeadScoreMetrics { closeProbability: number; urgency: string; economicValue: number; estimatedROI: string; priority: string; effortRequired: string; }
interface Objection { objection: string; response: string; priority: string; }
interface SmartFollowup { recommendedDays: number; method: string; reason: string; suggestedMessage: string; }

export interface CommercialResult {
  businessAnalysis: BusinessAnalysis;
  commercialDecision: CommercialDecision;
  selectedStrategy: SelectedStrategy;
  leadScore: LeadScoreMetrics;
  benefitsToHighlight: string[];
  salesBrief: string;
  nextAction: string;
  riskFactors: string[];
  topObjections: Objection[];
  smartFollowup: SmartFollowup;
  whyThisProduct: string;
}

export interface LearningStats {
  totalAnalyses: number;
  last7Days: number;
  strategyCounts: Record<string, number>;
  topStrategy: string;
  totalCustomers: number;
  convertedCustomers: number;
  conversionRate: number;
  worthSkipped: number;
}

@Injectable()
export class CommercialEngineService {
  private readonly logger = new Logger(CommercialEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly orion: OrionAiService,
  ) {}

  // ─── Análisis completo ────────────────────────────────────────

  async analyze(tenantId: string, customerId: string): Promise<CommercialResult> {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId } });
    if (!customer) throw new Error(`Customer ${customerId} not found`);

    const [tasks, pkg, catalogContext] = await Promise.all([
      this.prisma.task.findMany({ where: { customerId, tenantId }, orderBy: { createdAt: 'desc' }, take: 10 }),
      this.prisma.prospectPackage.findFirst({ where: { customerId, tenantId } }),
      this.products.buildCatalogContext(tenantId),
    ]);

    const customerCtx = this.buildCustomerContext(customer);
    const tasksCtx = this.buildTasksContext(tasks);
    const packageCtx = this.buildPackageContext(pkg);

    const prompt = [
      'CONTEXTO COMPLETO DEL PROSPECTO:\n', customerCtx,
      '\nHISTORIAL DE SEGUIMIENTOS:\n', tasksCtx,
      '\nPAQUETE / ANÁLISIS PREVIO:\n', packageCtx,
      '\nToma la decisión comercial completa. Devuelve solo el JSON, sin texto adicional.',
    ].join('');

    const res = await this.orion.generate({
      prompt,
      system: SystemPrompts.commercialEngine(catalogContext),
      config: { json: true, temperature: 0.3 },
    });

    let result: CommercialResult;
    try {
      const text = res.text.replace(/```json|```/g, '').trim();
      result = JSON.parse(text) as CommercialResult;
    } catch {
      this.logger.warn('CommercialEngine JSON parse failed — using fallback');
      result = this.buildFallback(customer);
    }

    await Promise.all([
      this.saveLeadScore(tenantId, customerId, result),
      this.logEvent(tenantId, 'COMMERCIAL_ANALYSIS', {
        customerId, strategyType: result.selectedStrategy?.type ?? '',
        worthSelling: result.commercialDecision?.worthSelling,
        closeProbability: result.leadScore?.closeProbability,
      }),
    ]);

    return result;
  }

  // ─── Manejo de objeciones ─────────────────────────────────────

  async handleObjection(tenantId: string, customerId: string, objectionText: string): Promise<{ response: string }> {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId } });
    const catalogContext = await this.products.buildCatalogContext(tenantId);
    const customerCtx = customer ? this.buildCustomerContext(customer) : 'Prospecto sin datos adicionales';

    const res = await this.orion.generate({
      prompt: `Objeción del cliente: "${objectionText}"\n\nGenera una respuesta efectiva y personalizada.`,
      system: SystemPrompts.objectionHandler(customerCtx, catalogContext),
      config: { temperature: 0.5 },
    });

    await this.logEvent(tenantId, 'OBJECTION_HANDLED', { customerId, objection: objectionText });
    return { response: res.text.trim() };
  }

  // ─── Modo explicación ─────────────────────────────────────────

  async explain(tenantId: string, customerId: string): Promise<{ explanation: string }> {
    const [customer, leadScore, pkg] = await Promise.all([
      this.prisma.customer.findFirst({ where: { id: customerId, tenantId } }),
      this.prisma.leadScore.findFirst({ where: { customerId, tenantId } }),
      this.prisma.prospectPackage.findFirst({ where: { customerId, tenantId } }),
    ]);

    const customerCtx = customer ? this.buildCustomerContext(customer) : 'Sin datos del prospecto';
    const recommendationCtx = this.buildRecommendationContext(leadScore, pkg);

    const res = await this.orion.generate({
      prompt: 'Explica en detalle la recomendación comercial para este prospecto.',
      system: SystemPrompts.explainRecommendation(customerCtx, recommendationCtx),
      config: { temperature: 0.4 },
    });

    const explanation = res.text.trim();

    // Save explanation back to LeadScore for future loads (avoid re-calling Gemini)
    if (leadScore) {
      try {
        await this.prisma.leadScore.update({
          where: { customerId },
          data: { whyExplanation: explanation },
        });
      } catch { /* non-critical */ }
    }

    await this.logEvent(tenantId, 'EXPLANATION_GENERATED', { customerId });
    return { explanation };
  }

  // ─── Learning stats ───────────────────────────────────────────

  async getLearningStats(tenantId: string): Promise<LearningStats> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

    const [allAnalyses, recentAnalyses, totalCustomers, convertedCustomers] = await Promise.all([
      this.prisma.eventLog.findMany({ where: { tenantId, type: 'COMMERCIAL_ANALYSIS' }, select: { payload: true, createdAt: true } }),
      this.prisma.eventLog.count({ where: { tenantId, type: 'COMMERCIAL_ANALYSIS', createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.customer.count({ where: { tenantId } }),
      this.prisma.customer.count({ where: { tenantId, stage: 'CUSTOMER' } }),
    ]);

    const strategyCounts: Record<string, number> = {};
    let worthSkipped = 0;

    for (const log of allAnalyses) {
      try {
        const payload = JSON.parse(log.payload ?? '{}') as { strategyType?: string; worthSelling?: boolean };
        if (payload.strategyType) strategyCounts[payload.strategyType] = (strategyCounts[payload.strategyType] ?? 0) + 1;
        if (payload.worthSelling === false) worthSkipped++;
      } catch { /* ignore malformed */ }
    }

    const topStrategy = Object.entries(strategyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'ninguna';

    return {
      totalAnalyses: allAnalyses.length,
      last7Days: recentAnalyses,
      strategyCounts,
      topStrategy,
      totalCustomers,
      convertedCustomers,
      conversionRate: totalCustomers > 0 ? convertedCustomers / totalCustomers : 0,
      worthSkipped,
    };
  }

  // ─── Lectura simple ───────────────────────────────────────────

  getLeadScore(tenantId: string, customerId: string) {
    return this.prisma.leadScore.findFirst({ where: { customerId, tenantId } });
  }

  // ─── Context builders ──────────────────────────────────────────

  buildCustomerContext(c: {
    company?: string | null; name: string; product?: string | null; stage: string;
    value: number; score: number; notes?: string | null; createdAt: Date;
  }): string {
    const stageMap: Record<string, string> = {
      LEAD: 'Lead inicial', PROSPECT: 'Prospecto activo', NEGOTIATION: 'En negociación',
      CUSTOMER: 'Cliente activo', LOST: 'Perdido / descartado',
    };
    const daysSince = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86_400_000);
    return [
      `Empresa: ${c.company || 'Sin empresa registrada'}`,
      `Contacto: ${c.name}`,
      `Rubro: ${c.product || 'No especificado'}`,
      `Etapa CRM: ${stageMap[c.stage] ?? c.stage}`,
      `Valor estimado: $${c.value.toLocaleString('es-MX')} MXN`,
      `Score actual: ${Math.round((c.score ?? 0) * 100)}%`,
      `En CRM desde: ${daysSince} día${daysSince !== 1 ? 's' : ''}`,
      `Notas: ${c.notes || 'Sin notas adicionales'}`,
    ].join('\n');
  }

  private buildTasksContext(tasks: { state: string; title: string; priority: string }[]): string {
    if (!tasks.length) return 'Sin seguimientos previos registrados en el CRM.';
    const done = tasks.filter(t => t.state === 'DONE').length;
    const pending = tasks.filter(t => t.state === 'PENDING').length;
    const lines = tasks.map(t => `  - [${t.state}] ${t.title} · ${t.priority}`);
    return [`Total: ${tasks.length} tarea(s) · ${done} completadas · ${pending} pendientes`, ...lines].join('\n');
  }

  private buildPackageContext(pkg: {
    packageName: string; mainProduct: string; complementary: string;
    estimatedValue: number; suggestedStrategy: string; explanation: string;
  } | null): string {
    if (!pkg) return 'Sin paquete registrado.';
    const comps = this.parseSafe(pkg.complementary) as string[];
    return [
      `Paquete: ${pkg.packageName}`,
      `Principal: ${pkg.mainProduct}`,
      `Complementarios: ${comps.length ? comps.join(', ') : 'ninguno'}`,
      `Valor: $${pkg.estimatedValue.toLocaleString('es-MX')}`,
      `Estrategia previa: ${pkg.suggestedStrategy || 'no definida'}`,
    ].join('\n');
  }

  private buildRecommendationContext(
    ls: { strategyName: string; strategyApproach: string; strategyReason: string; salesBrief: string; estimatedROI: string; economicValue: number; closeProbability: number; } | null,
    pkg: { packageName: string; mainProduct: string; complementary: string; estimatedValue: number; explanation: string; } | null,
  ): string {
    const lines: string[] = [];
    if (pkg) {
      const comps = this.parseSafe(pkg.complementary) as string[];
      lines.push(`Paquete recomendado: ${pkg.packageName}`);
      lines.push(`Producto principal: ${pkg.mainProduct}`);
      if (comps.length) lines.push(`Complementarios: ${comps.join(', ')}`);
      lines.push(`Valor estimado: $${pkg.estimatedValue.toLocaleString('es-MX')}`);
      lines.push(`Justificación del paquete: ${pkg.explanation}`);
    }
    if (ls) {
      lines.push(`Estrategia: ${ls.strategyName} — ${ls.strategyApproach}`);
      lines.push(`ROI estimado: ${ls.estimatedROI}`);
      lines.push(`Probabilidad de cierre: ${Math.round(ls.closeProbability * 100)}%`);
      lines.push(`Brief comercial: ${ls.salesBrief}`);
    }
    return lines.join('\n') || 'Sin recomendación previa registrada.';
  }

  // ─── Persist ──────────────────────────────────────────────────

  private async saveLeadScore(tenantId: string, customerId: string, r: CommercialResult): Promise<void> {
    try {
      const ba = r.businessAnalysis ?? {};
      const ls = r.leadScore ?? {};
      const ss = r.selectedStrategy ?? {};
      const cd = r.commercialDecision ?? {};

      const data = {
        tenantId, customerId,
        worthSelling:        cd.worthSelling !== false,
        decisionReason:      String(cd.reason ?? ''),
        decisionConfidence:  Number(cd.confidence ?? 0),
        closeProbability:    Number(ls.closeProbability ?? 0),
        urgency:             String(ls.urgency ?? 'media'),
        economicValue:       Number(ls.economicValue ?? 0),
        estimatedROI:        String(ls.estimatedROI ?? ''),
        priority:            String(ls.priority ?? 'NORMAL'),
        effortRequired:      String(ls.effortRequired ?? 'medio'),
        strategyType:        String(ss.type ?? ''),
        strategyName:        String(ss.name ?? ''),
        strategyApproach:    String(ss.approach ?? ''),
        strategyReason:      String(ss.reason ?? ''),
        openingLine:         String(ss.openingLine ?? ''),
        benefitsToHighlight: JSON.stringify(r.benefitsToHighlight ?? []),
        salesBrief:          String(r.salesBrief ?? ''),
        nextAction:          String(r.nextAction ?? ''),
        riskFactors:         JSON.stringify(r.riskFactors ?? []),
        industry:            String(ba.industry ?? ''),
        estimatedSize:       String(ba.estimatedSize ?? ''),
        economicPotential:   String(ba.economicPotential ?? ''),
        shelbyCompatibility: Number(ba.shelbyCompatibility ?? 0),
        topObjections:       JSON.stringify(r.topObjections ?? []),
        smartFollowup:       JSON.stringify(r.smartFollowup ?? {}),
        whyExplanation:      String(r.whyThisProduct ?? ''),
      };

      await this.prisma.leadScore.upsert({
        where: { customerId },
        create: data,
        update: data,
      });
    } catch (e) {
      this.logger.warn('LeadScore save failed (non-critical)', String(e));
    }
  }

  private async logEvent(tenantId: string, type: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await this.prisma.eventLog.create({ data: { tenantId, type, payload: JSON.stringify(payload) } });
    } catch { /* non-critical */ }
  }

  // ─── Fallback ─────────────────────────────────────────────────

  private buildFallback(c: { product?: string | null; value: number }): CommercialResult {
    return {
      businessAnalysis: { industry: c.product ?? '', estimatedSize: 'pequeño', economicPotential: 'medio', shelbyCompatibility: 0.7, urgencySignals: [], painPoints: [] },
      commercialDecision: { worthSelling: true, reason: 'Prospecto activo en pipeline', confidence: 0.5 },
      selectedStrategy: { type: 'venta_consultiva', name: 'Venta Consultiva', approach: 'Iniciar con conversación de descubrimiento.', reason: 'Información limitada; enfoque consultivo primero.', openingLine: '¿Cuáles son los mayores desafíos de tu negocio hoy?' },
      leadScore: { closeProbability: 0.5, urgency: 'media', economicValue: c.value ?? 0, estimatedROI: 'Por determinar', priority: 'NORMAL', effortRequired: 'medio' },
      benefitsToHighlight: ['Ahorro de tiempo', 'Control del negocio', 'Automatización de procesos'],
      salesBrief: 'Primera reunión de descubrimiento. Escuchar antes de presentar.',
      nextAction: 'Contacto inicial en 24-48 horas.',
      riskFactors: ['Información insuficiente del prospecto'],
      topObjections: [
        { objection: 'Es muy caro', response: 'Entiendo la preocupación. ¿Podemos revisar juntos cuánto le cuesta actualmente operar sin este sistema? Generalmente el ahorro supera la inversión en los primeros 3 meses.', priority: 'alta' },
        { objection: 'No es el momento', response: 'Lo entiendo. ¿Cuándo sería el momento ideal? Podemos programar una demo corta ahora para que tengas la información cuando estés listo.', priority: 'media' },
        { objection: '¿Qué soporte ofrecen?', response: 'Incluimos soporte por WhatsApp, capacitación inicial y actualizaciones sin costo adicional. Nunca estás solo en la implementación.', priority: 'baja' },
      ],
      smartFollowup: { recommendedDays: 3, method: 'whatsapp', reason: 'WhatsApp es el canal más directo para primer contacto con pequeñas empresas.', suggestedMessage: 'Hola, ¿tuviste oportunidad de revisar la información que te compartí? Tengo una demo lista de 15 min que puede ser muy útil para tu negocio.' },
      whyThisProduct: 'La recomendación se basó en los problemas detectados en el negocio y el catálogo de productos disponibles. El objetivo es resolver el problema principal con la inversión más ajustada posible.',
    };
  }

  private parseSafe(val: string): unknown {
    try { return JSON.parse(val); } catch { return []; }
  }
}
