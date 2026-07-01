import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { OrionAiService } from './orion-ai.service';
import { AnalyzeDto, AskDto, AssistDto, FindProspectsDto, AnalyzeCompanyDto, GeneratePitchDto, SearchPlacesDto } from './dto/orion.dto';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { PlacesService } from './places.service';
import { ProductsService } from '../products/products.service';
import { CurrentTenant } from '../../shared/auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('orion')
export class OrionAiController {
  constructor(
    private readonly orion: OrionAiService,
    private readonly places: PlacesService,
    private readonly products: ProductsService,
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
    return this.orion.analyzeCompany(
      { name: dto.name, company: dto.company, industry: dto.industry, location: dto.location, notes: dto.notes },
      catalog,
    );
  }

  @Post('generate-pitch')
  async generatePitch(@CurrentTenant() tenantId: string, @Body() dto: GeneratePitchDto) {
    const catalog = await this.products.buildCatalogContext(tenantId);
    return this.orion.generatePitch(
      { name: dto.name, company: dto.company, industry: dto.industry, location: dto.location, analysis: dto.analysis, recommendedProduct: dto.recommendedProduct, painPoint: dto.painPoint },
      catalog,
    );
  }

  @Post('search-places')
  searchPlaces(@Body() dto: SearchPlacesDto) {
    return this.places.searchBusinesses(dto.query, dto.location, dto.limit ?? 20);
  }
}
