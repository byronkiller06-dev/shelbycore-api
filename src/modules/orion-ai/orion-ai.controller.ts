import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { OrionAiService } from './orion-ai.service';
import { AnalyzeDto, AskDto, AssistDto } from './dto/orion.dto';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('orion')
export class OrionAiController {
  constructor(private readonly orion: OrionAiService) {}

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
}
