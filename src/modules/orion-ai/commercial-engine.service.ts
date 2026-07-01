import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { OrionAiService } from './orion-ai.service';
import { SystemPrompts } from './prompts/system-prompts';

interface BusinessAnalysis {
  industry: string; estimatedSize: string; economicPotential: string;
  shelbyCompatibility: number; urgencySignals: string[]; painPoints: string[];
}
interface CommercialDecision { worthSelling: boolean; reason: string; confidence: number; }
interface SelectedStrategy { type: string; name: string; approach: string; reason: string; openingLine: string; }
interface LeadScoreMetrics { closeProbability: number; urgency: string; economicValue: number; estimatedROI: string; priority: string; effortRequired: string; }

interface CommercialResult {
  businessAnalysis: BusinessAnalysis;
  commercialDecision: CommercialDecision;
  selectedStrategy: SelectedStrategy;
  leadScore: LeadScoreMetrics;
  benefitsToHighlight: string[];
  salesBrief: string;
  nextAction: string;
  riskFactors: string[];
}

@Injectable()
export class CommercialEngineService {
  private readonly logger = new Logger(CommercialEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly orion: OrionAiService,
  ) {}

  async analyze(tenantId: string, customerId: string): Promise<CommercialResult> {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId } });
    if (!customer) throw new Error(`Customer ${customerId} not found`);

    const [tasks, pkg, catalogContext] = await Promise.all([
      this.prisma.task.findMany({ where: { customerId, tenantId }, orderBy: { createdAt: 'desc' }, take: 10 }),
      this.prisma.prospectPackage.findFirst({ where: { customerId, tenantId } }),
      this.products.buildCatalogContext(tenantId),
    ]);

    const prompt = [
      'CONTEXTO COMPLETO DEL PROSPECTO:\n',
      this.buildCustomerContext(customer),
      '\nHISTORIAL DE SEGUIMIENTOS:\n',
      this.buildTasksContext(tasks),
      '\nPAQUETE / ANÁLISIS PREVIO:\n',
      this.buildPackageContext(pkg),
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

    await this.saveLeadScore(tenantId, customerId, result);
    return result;
  }

  getLeadScore(tenantId: string, customerId: string) {
    return this.prisma.leadScore.findFirst({ where: { customerId, tenantId } });
  }

  // ─── Context builders ──────────────────────────────────────────

  private buildCustomerContext(c: {
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
      `Valor estimado del negocio: $${c.value.toLocaleString('es-MX')} MXN`,
      `Score actual: ${Math.round((c.score ?? 0) * 100)}%`,
      `En el CRM desde: ${daysSince} día${daysSince !== 1 ? 's' : ''}`,
      `Notas y contexto: ${c.notes || 'Sin notas adicionales'}`,
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
    if (!pkg) return 'Sin paquete registrado. El Motor Comercial puede crear uno nuevo.';
    const comps = this.parseSafe(pkg.complementary) as string[];
    return [
      `Paquete: ${pkg.packageName}`,
      `Producto principal: ${pkg.mainProduct}`,
      `Complementarios: ${comps.length ? comps.join(', ') : 'ninguno'}`,
      `Valor estimado: $${pkg.estimatedValue.toLocaleString('es-MX')}`,
      `Estrategia previa: ${pkg.suggestedStrategy || 'no definida'}`,
      `Explicación: ${pkg.explanation || 'no disponible'}`,
    ].join('\n');
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

  // ─── Fallback ─────────────────────────────────────────────────

  private buildFallback(c: { product?: string | null; value: number }): CommercialResult {
    return {
      businessAnalysis: {
        industry: c.product ?? '', estimatedSize: 'pequeño',
        economicPotential: 'medio', shelbyCompatibility: 0.7,
        urgencySignals: [], painPoints: [],
      },
      commercialDecision: { worthSelling: true, reason: 'Prospecto activo en pipeline', confidence: 0.5 },
      selectedStrategy: {
        type: 'venta_consultiva', name: 'Venta Consultiva',
        approach: 'Iniciar con una conversación de descubrimiento para entender las necesidades del negocio.',
        reason: 'Información limitada disponible; el enfoque consultivo permite explorar y adaptar.',
        openingLine: '¿Cuáles son los mayores desafíos que enfrenta tu negocio hoy en día?',
      },
      leadScore: {
        closeProbability: 0.5, urgency: 'media', economicValue: c.value ?? 0,
        estimatedROI: 'Por determinar en primera reunión', priority: 'NORMAL', effortRequired: 'medio',
      },
      benefitsToHighlight: ['Ahorro de tiempo en operaciones', 'Control total del negocio', 'Automatización de procesos clave'],
      salesBrief: 'Contactar para primera reunión de descubrimiento. Escuchar antes de presentar.',
      nextAction: 'Primera llamada de descubrimiento en 24-48 horas.',
      riskFactors: ['Información insuficiente del prospecto para análisis profundo'],
    };
  }

  private parseSafe(val: string): unknown {
    try { return JSON.parse(val); } catch { return []; }
  }
}
