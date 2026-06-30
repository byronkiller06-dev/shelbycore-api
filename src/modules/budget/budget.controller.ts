import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { BudgetService } from './budget.service';
import { RecordUsageDto, UpdateBudgetDto } from './budget.dto';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Controller('budget')
export class BudgetController {
  constructor(private readonly budget: BudgetService, private readonly prisma: PrismaService) {}

  private async tenantId(): Promise<string> {
    let t = await this.prisma.tenant.findFirst({ where: { slug: 'shelbycore' } });
    if (!t) t = await this.prisma.tenant.findFirst();
    if (!t) {
      const org = await this.prisma.organization.create({ data: { name: 'ShelbyCore' } });
      t = await this.prisma.tenant.create({ data: { orgId: org.id, name: 'ShelbyCore', slug: 'shelbycore', status: 'ACTIVE' } });
    }
    return t.id;
  }

  @Get('status')
  async status() { return this.budget.status(await this.tenantId()); }

  @Put()
  async update(@Body() dto: UpdateBudgetDto) { return this.budget.updateLimit(await this.tenantId(), dto.monthlyLimitClp); }

  @Post('usage')
  async usage(@Body() dto: RecordUsageDto) { return this.budget.record(await this.tenantId(), dto); }

  @Get('can')
  async can(@Query('service') service: string, @Query('cost') cost?: string) {
    return this.budget.canUseExternalService(await this.tenantId(), service, cost ? Number(cost) : undefined);
  }
}
