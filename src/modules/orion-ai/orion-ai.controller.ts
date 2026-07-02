import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { OrionAiService } from './orion-ai.service';
import {
  AnalyzeDto, AskDto, AssistDto, FindProspectsDto,
  AnalyzeCompanyDto, GeneratePitchDto, SearchPlacesDto,
  CommercialAnalysisDto, ObjectionResponseDto, ExplainDto, AnalyzeResponseDto,
} from './dto/orion.dto';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { Public } from '../../shared/auth/decorators/public.decorator';
import { PlacesService } from './places.service';
import { ProductsService } from '../products/products.service';
import { PackagesService } from '../products/packages.service';
import { CommercialEngineService } from './commercial-engine.service';
import { CurrentTenant } from '../../shared/auth/decorators/current-user.decorator';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@UseGuards(JwtAuthGuard)
@Controller('orion')
export class OrionAiController {
  private readonly logger = new Logger(OrionAiController.name);

  constructor(
    private readonly orion: OrionAiService,
    private readonly places: PlacesService,
    private readonly products: ProductsService,
    private readonly packages: PackagesService,
    private readonly commercialEngine: CommercialEngineService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('status')
  status() { return this.orion.status(); }

  @Post('ask')
  ask(@Body() dto: AskDto) { return this.orion.ask(dto.prompt, dto.businessContext, dto.history); }

  @Post('analyze-sales')
  analyzeSales(@Body() dto: AnalyzeDto) { return this.orion.analyzeSales(dto.data, dto.question, dto.businessContext); }

  @Post('analyze-inventory')
  analyzeInventory(@Body() dto: AnalyzeDto) { return this.orion.analyzeInventory(dto.data, dto.question, dto.businessContext); }

  @Post('recommend-purchases')
  recommendPurchases(@Body() dto: AnalyzeDto) { return this.orion.recommendPurchases(dto.data, dto.businessContext); }

  @Post('report')
  report(@Body() dto: AnalyzeDto) { return this.orion.generateReport(dto.data, dto.businessContext); }

  @Post('assist')
  assist(@Body() dto: AssistDto) { return this.orion.assist(dto.prompt, dto.audience, dto.businessContext, dto.history); }

  @Post('find-prospects')
  findProspects(@Body() dto: FindProspectsDto) {
    return this.orion.findProspects(dto.industry, dto.location, dto.count ?? 8);
  }

  @Post('analyze-company')
  async analyzeCompany(@CurrentTenant() tenantId: string, @Body() dto: AnalyzeCompanyDto) {
    const catalog = await this.products.buildCatalogContext(tenantId);
    const result = await this.orion.analyzeCompany(
      { name: dto.name, company: dto.company, industry: dto.industry, location: dto.location, notes: dto.notes },
      catalog,
    ) as Record<string, unknown>;

    if (dto.customerId) {
      try {
        const selectedProductNames = (result.selectedProducts as string[] | undefined) ?? [];
        const dbProducts = selectedProductNames.length
          ? await this.products.findByNames(tenantId, selectedProductNames)
          : [];
        const selectedProductIds = dbProducts.map(p => p.id);
        await this.packages.upsert({
          tenantId,
          customerId: dto.customerId,
          mainProduct: String(result.mainProduct ?? result.recommendedProduct ?? ''),
          complementary: (result.complementaryProducts as string[]) ?? [],
          packageName: String(result.packageName ?? result.recommendedProduct ?? ''),
          explanation: String(result.packageExplanation ?? result.analysis ?? ''),
          estimatedValue: Number(result.estimatedValue ?? 0),
          suggestedStrategy: String(result.suggestedStrategy ?? ''),
          selectedProductIds,
          salesPriority: String(result.salesPriority ?? 'media'),
          commercialMargin: Number(result.commercialMarginPct ?? 0),
        });
      } catch (e) { this.logger.warn('Package save failed (non-critical)', e); }
    }
    return result;
  }

  @Post('generate-pitch')
  async generatePitch(@CurrentTenant() tenantId: string, @Body() dto: GeneratePitchDto) {
    const catalog = await this.products.buildCatalogContext(tenantId);
    const result = await this.orion.generatePitch(
      { name: dto.name, company: dto.company, industry: dto.industry, location: dto.location, analysis: dto.analysis, recommendedProduct: dto.packageName ?? dto.recommendedProduct, painPoint: dto.painPoint, complementaryProducts: dto.complementaryProducts, estimatedValue: dto.estimatedValue },
      catalog,
    ) as Record<string, unknown>;

    if (dto.customerId) {
      try {
        const existing = await this.packages.getForCustomer(tenantId, dto.customerId);
        if (existing) {
          await this.packages.upsert({
            tenantId,
            customerId: dto.customerId,
            mainProduct: existing.mainProduct,
            complementary: JSON.parse(existing.complementary) as string[],
            packageName: existing.packageName,
            explanation: existing.explanation,
            estimatedValue: existing.estimatedValue,
            suggestedStrategy: existing.suggestedStrategy,
            whatsappMessage: String(result.whatsappMessage ?? ''),
            emailSubject: String(result.emailSubject ?? ''),
            emailBody: String(result.emailBody ?? ''),
            followUpDate: Number(result.followUpDate ?? 3),
          });
        }
      } catch (e) { this.logger.warn('Package pitch update failed (non-critical)', e); }
    }
    return result;
  }

  @Get('package/:customerId')
  getPackage(@CurrentTenant() tenantId: string, @Param('customerId') customerId: string) {
    return this.packages.getForCustomer(tenantId, customerId);
  }

  // ─── Motor Comercial Autónomo ──────────────────────────────────

  @Post('commercial-analysis')
  commercialAnalysis(@CurrentTenant() tenantId: string, @Body() dto: CommercialAnalysisDto) {
    return this.commercialEngine.analyze(tenantId, dto.customerId);
  }

  @Get('lead-score/:customerId')
  getLeadScore(@CurrentTenant() tenantId: string, @Param('customerId') customerId: string) {
    return this.commercialEngine.getLeadScore(tenantId, customerId);
  }

  // ─── Objeciones ───────────────────────────────────────────────

  @Post('objection-response')
  handleObjection(@CurrentTenant() tenantId: string, @Body() dto: ObjectionResponseDto) {
    return this.commercialEngine.handleObjection(tenantId, dto.customerId, dto.objectionText);
  }

  // ─── Modo explicación ─────────────────────────────────────────

  @Post('explain')
  explain(@CurrentTenant() tenantId: string, @Body() dto: ExplainDto) {
    return this.commercialEngine.explain(tenantId, dto.customerId);
  }

  // ─── Aprendizaje ──────────────────────────────────────────────

  @Get('learning/stats')
  learningStats(@CurrentTenant() tenantId: string) {
    return this.commercialEngine.getLearningStats(tenantId);
  }

  // ─── Respuesta del Cliente / Hotspots ─────────────────────────

  @Post('analyze-response')
  async analyzeClientResponse(@CurrentTenant() tenantId: string, @Body() dto: AnalyzeResponseDto) {
    const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, tenantId } });
    if (!customer) throw new HttpException('Cliente no encontrado', HttpStatus.NOT_FOUND);

    const customerCtx = [
      `Empresa: ${customer.company || customer.name}`,
      `Rubro: ${customer.product ?? 'desconocido'}`,
      `Etapa CRM: ${customer.stage}`,
      `Notas: ${customer.notes ?? 'sin notas'}`,
      `Score: ${customer.score}`,
    ].join('\n');

    const productCtx = await this.products.buildCatalogContext(tenantId);
    const result = await this.orion.analyzeClientResponse(customerCtx, productCtx, dto.responseText) as Record<string, unknown>;

    // Persist response
    // Use $executeRawUnsafe to support any Prisma client version (clientResponse may not be typed yet until generate runs)
    const id = `cr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "ClientResponse" (id,"tenantId","customerId","responseText","channel","intent","urgency","hotspot","recommendation","replyMessage","whatsappText","emailSubject","emailBody","reasoning","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())`,
        id, tenantId, dto.customerId,
        dto.responseText, dto.channel ?? 'whatsapp',
        String(result.intent ?? 'neutral'), String(result.urgency ?? 'media'),
        Boolean(result.hotspot),
        String(result.recommendation ?? 'schedule_followup'),
        String(result.replyMessage ?? ''), String(result.whatsappText ?? ''),
        String(result.emailSubject ?? ''), String(result.emailBody ?? ''),
        String(result.reasoning ?? ''),
      );
    } catch (e) { this.logger.warn('ClientResponse save failed (non-critical)', e); }

    // If hotspot: stamp customer
    if (result.hotspot) {
      try {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "Customer" SET "hotspotAt" = NOW() WHERE id = $1`,
          dto.customerId,
        );
      } catch (e) { this.logger.warn('hotspotAt update failed', e); }
    }

    return { ...result, id };
  }

  @Get('responses/:customerId')
  async getClientResponses(@CurrentTenant() tenantId: string, @Param('customerId') customerId: string) {
    try {
      return await this.prisma.$queryRawUnsafe<unknown[]>(
        `SELECT * FROM "ClientResponse" WHERE "tenantId" = $1 AND "customerId" = $2 ORDER BY "createdAt" DESC LIMIT 10`,
        tenantId, customerId,
      );
    } catch { return []; }
  }

  @Get('hotspots')
  async getHotspots(@CurrentTenant() tenantId: string) {
    try {
      return await this.prisma.$queryRawUnsafe<unknown[]>(
        `SELECT * FROM "Customer" WHERE "tenantId" = $1 AND "hotspotAt" >= NOW() - INTERVAL '7 days' ORDER BY "hotspotAt" DESC LIMIT 20`,
        tenantId,
      );
    } catch { return []; }
  }

  // ─── Places ───────────────────────────────────────────────────

  @Public()
  @Get('places-status')
  placesStatus() {
    return this.places.keyStatus();
  }

  @Post('search-places')
  searchPlaces(@Body() dto: SearchPlacesDto) {
    return this.places.searchBusinesses(dto.query, dto.location, dto.limit ?? 20);
  }
}
