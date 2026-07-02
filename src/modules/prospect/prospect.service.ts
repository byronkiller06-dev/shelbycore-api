import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { QualificationService, QualifiedProspect } from './qualification.service';
import { DISCOVERY_PROVIDER, DiscoveryProvider, DiscoveredCompany } from './discovery.provider';
import { OrionAiService } from '../orion-ai/orion-ai.service';
import { BudgetService } from '../budget/budget.service';
import { DraftDto, SaveProspectDto, SearchProspectDto } from './prospect.dto';

const SHELBY_CATALOG = 'MiComunidad360, ShelbyPOS, ShelbyEats, Desarrollo Web, Desarrollo de Apps, Automatización con IA';

@Injectable()
export class ProspectService {
  private readonly logger = new Logger('OrionProspect');

  constructor(
    private readonly prisma: PrismaService,
    private readonly qualifier: QualificationService,
    private readonly orion: OrionAiService,
    private readonly budget: BudgetService,
    @Inject(DISCOVERY_PROVIDER) private readonly provider: DiscoveryProvider,
  ) {}

  status() {
    return {
      discovery: { provider: this.provider.name, available: this.provider.available() },
      gemini: this.orion.status(),
    };
  }

  /**
   * FLUJO REAL con CONTROL DE PRESUPUESTO obligatorio:
   * 1) calcular costo estimado · 2) revisar presupuesto · 3) si hay, buscar ·
   * 4) registrar uso · 5) (UI se actualiza) · 6) si no hay, bloquear y avisar.
   */
  async search(dto: SearchProspectDto): Promise<QualifiedProspect[]> {
    if (!this.provider.available()) {
      this.logger.warn('GOOGLE_PLACES_API_KEY no configurada: no hay descubrimiento real.');
      return [];
    }

    // tenant (requiere DB: el control de presupuesto necesita persistencia)
    let tenantId: string;
    try {
      tenantId = await this.defaultTenantId();
    } catch {
      throw new HttpException(
        { error: 'DB_REQUIRED', message: 'Base de datos no disponible. Es requerida para el control de presupuesto antes de buscar.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // (1) costo estimado de Places (1 text search + hasta 6 details)
    const placesEstimate = this.budget.estimate('google-places', 1) + this.budget.estimate('google-places-details', 6);

    // (2) GATE de presupuesto ANTES de gastar
    const gate = await this.budget.canUseExternalService(tenantId, 'google-places', placesEstimate);
    if (!gate.allowed) {
      await this.budget.record(tenantId, { service: 'google-places', endpoint: 'textsearch', estimatedCostClp: 0, executor: 'ORION Prospect', result: 'blocked' });
      throw new HttpException({ error: 'BUDGET_EXCEEDED', message: gate.reason }, HttpStatus.PAYMENT_REQUIRED);
    }

    // (3) ejecutar búsqueda
    const companies = await this.provider.search(dto.service, dto.city, dto.keyword);
    this.logger.log(`Places encontró ${companies.length} empresas para "${dto.service}" en ${dto.city}.`);

    // (4) registrar uso real de Places
    const placesActual = this.budget.estimate('google-places', 1) + this.budget.estimate('google-places-details', companies.length);
    await this.budget.record(tenantId, { service: 'google-places', endpoint: 'textsearch+details', estimatedCostClp: placesActual, executor: 'ORION Prospect', result: 'ok' });

    if (companies.length === 0) return [];

    // Calificación con Gemini (también pasa por el gate; si no hay presupuesto, usa heurística gratis)
    let result: QualifiedProspect[];
    const geminiOn = this.orion.status().configured;
    const geminiGate = geminiOn ? await this.budget.canUseExternalService(tenantId, 'gemini', this.budget.estimate('gemini', 1)) : { allowed: false };
    if (geminiOn && geminiGate.allowed) {
      result = await this.qualifyWithGemini(companies, dto.service);
      await this.budget.record(tenantId, { service: 'gemini', endpoint: 'qualify', estimatedCostClp: this.budget.estimate('gemini', 1), executor: 'ORION Prospect', result: 'ok' });
    } else {
      if (geminiOn) this.logger.warn('Sin presupuesto para Gemini: califico con heurística (gratis).');
      result = companies.map((c) => this.qualifier.qualify(c, dto.service));
    }
    return result.sort((a, b) => b.probability - a.probability);
  }

  private async qualifyWithGemini(companies: DiscoveredCompany[], service: string): Promise<QualifiedProspect[]> {
    const list = companies
      .map((c, i) => `${i + 1}. ${c.company} — ${c.category} — web:${c.website ? 'sí' : 'no'} · IG:${c.instagram ? 'sí' : 'no'} · FB:${c.facebook ? 'sí' : 'no'} · tel:${c.phone ? 'sí' : 'no'} · correo:${c.email ? 'sí' : 'no'}`)
      .join('\n');
    const prompt =
      `Servicio que queremos venderle a estas empresas: ${service}.\n` +
      `Catálogo Shelby disponible: ${SHELBY_CATALOG}.\n\n` +
      `Para CADA empresa, evalúa su oportunidad comercial según su presencia pública. ` +
      `Devuelve SOLO un arreglo JSON, un objeto por empresa, EN EL MISMO ORDEN, con esta forma exacta:\n` +
      `[{"level":"alta|media|baja","probability":<entero 0-100>,"problems":["..."],"recommended":["...del catálogo..."],"reasoning":["por qué es buen cliente..."]}]\n\n` +
      `Empresas:\n${list}`;
    try {
      const res = await this.orion.generate({
        prompt,
        system: 'Eres ORION, analista comercial. Respondes SOLO con JSON válido, sin texto adicional.',
        config: { json: true, temperature: 0.3 },
      });
      const parsed = JSON.parse(res.text) as Array<Partial<QualifiedProspect>>;
      return companies.map((c, i): QualifiedProspect => {
        const q: Partial<QualifiedProspect> = parsed[i] ?? {};
        const probability = typeof q.probability === 'number' ? Math.max(0, Math.min(100, Math.round(q.probability))) : 50;
        const level: QualifiedProspect['level'] = q.level ?? (probability >= 70 ? 'alta' : probability >= 50 ? 'media' : 'baja');
        return {
          ...c,
          problems: Array.isArray(q.problems) ? q.problems : [],
          recommended: Array.isArray(q.recommended) && q.recommended.length ? q.recommended : [service],
          reasoning: Array.isArray(q.reasoning) ? q.reasoning : [],
          probability, level,
        };
      });
    } catch (e) {
      this.logger.warn(`Falló Gemini, uso heurística. ${String((e as Error).message)}`);
      return companies.map((c) => this.qualifier.qualify(c, service));
    }
  }

  async save(dto: SaveProspectDto) {
    const tenantId = await this.defaultTenantId();
    const noteParts: string[] = [];
    if (dto.address) noteParts.push(`Dir: ${dto.address}`);
    if (dto.website) noteParts.push(`Web: ${dto.website}`);
    if (dto.rating) noteParts.push(`Rating: ${dto.rating}★`);
    if (dto.source) noteParts.push(`Fuente: ${dto.source === 'google_places' ? 'Google Places' : dto.source === 'openstreetmap' ? 'OpenStreetMap' : dto.source}`);
    if (dto.placeId) noteParts.push(`PlaceID: ${dto.placeId}`);
    if (dto.verified) noteParts.push('verificado: true');
    if (dto.problems?.length) noteParts.push(`ORION: ${dto.problems.join('; ')}`);
    return this.prisma.customer.create({
      data: {
        tenantId, name: dto.company, company: dto.company, email: dto.email, phone: dto.phone,
        product: dto.product, stage: 'PROSPECT', score: (dto.probability ?? 0) / 100,
        notes: noteParts.join(' | ') || 'ORION Prospect',
      },
    });
  }

  draft(dto: DraftDto): { kind: string; text: string } {
    const rec = dto.recommended?.[0] ?? 'una solución Shelby';
    const problems = (dto.problems ?? []).map((p) => `• ${p}`).join('\n');
    let text = '';
    if (dto.kind === 'proposal') {
      text = `PROPUESTA COMERCIAL — ${dto.company}\n────────────────────────────\n\nEstimados ${dto.company},\n\nIdentificamos oportunidades concretas:\n\n${problems}\n\nRecomendamos ${rec} para resolverlas y aumentar sus ventas.\n\nEquipo ShelbyCore AI`;
    } else if (dto.kind === 'email') {
      text = `Para: ${dto.email ?? '(correo público no disponible)'}\nAsunto: Una idea para hacer crecer ${dto.company}\n\nHola ${dto.company}, con ${rec} podemos ayudarles a mejorar su operación. ¿Coordinamos una demo?\n\nShelbyCore AI`;
    } else {
      text = `Hola ${dto.company} 👋 Les escribimos de ShelbyCore AI. Con ${rec} podríamos ayudarles. ¿Una demo rápida sin compromiso? 🚀`;
    }
    return { kind: dto.kind, text };
  }

  private async defaultTenantId(): Promise<string> {
    let tenant = await this.prisma.tenant.findFirst({ where: { slug: 'shelbycore' } });
    if (!tenant) tenant = await this.prisma.tenant.findFirst();
    if (!tenant) {
      const org = await this.prisma.organization.create({ data: { name: 'ShelbyCore' } });
      tenant = await this.prisma.tenant.create({ data: { orgId: org.id, name: 'ShelbyCore', slug: 'shelbycore', status: 'ACTIVE' } });
    }
    return tenant.id;
  }
}
