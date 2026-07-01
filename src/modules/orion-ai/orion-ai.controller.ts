import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { OrionAiService } from './orion-ai.service';
import { AnalyzeDto, AskDto, AssistDto, FindProspectsDto, AnalyzeCompanyDto, GeneratePitchDto, SearchPlacesDto, CommercialAnalysisDto } from './dto/orion.dto';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { PlacesService } from './places.service';
import { ProductsService } from '../products/products.service';
import { PackagesService } from '../products/packages.service';
import { CommercialEngineService } from './commercial-engine.service';
import { CurrentTenant } from '../../shared/auth/decorators/current-user.decorator';
import { Logger } from '@nestjs/common';

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
        await this.packages.upsert({
          tenantId,
          customerId: dto.customerId,
          mainProduct: String(result.mainProduct ?? result.recommendedProduct ?? ''),
          complementary: (result.complementaryProducts as string[]) ?? [],
          packageName: String(result.packageName ?? result.recommendedProduct ?? ''),
          explanation: String(result.packageExplanation ?? result.analysis ?? ''),
          estimatedValue: Number(result.estimatedValue ?? 0),
          suggestedStrategy: String(result.suggestedStrategy ?? ''),
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

  // ─── Motor Comercial ──────────────────────────────────────────

  @Post('commercial-analysis')
  commercialAnalysis(@CurrentTenant() tenantId: string, @Body() dto: CommercialAnalysisDto) {
    return this.commercialEngine.analyze(tenantId, dto.customerId);
  }

  @Get('lead-score/:customerId')
  getLeadScore(@CurrentTenant() tenantId: string, @Param('customerId') customerId: string) {
    return this.commercialEngine.getLeadScore(tenantId, customerId);
  }

  // ─── Places ───────────────────────────────────────────────────

  @Post('search-places')
  searchPlaces(@Body() dto: SearchPlacesDto) {
    return this.places.searchBusinesses(dto.query, dto.location, dto.limit ?? 20);
  }
}
