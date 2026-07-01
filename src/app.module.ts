import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './shared/prisma/prisma.module';
import { AuthModule } from './shared/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AgentsModule } from './modules/agents/agents.module';
import { CrmModule } from './modules/crm/crm.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { HealthModule } from './modules/health/health.module';
import { MemoryModule } from './modules/memory/memory.module';
import { AutomationsModule } from './modules/automations/automations.module';
import { ProspectModule } from './modules/prospect/prospect.module';
import { OrionAiModule } from './modules/orion-ai/orion-ai.module';
import { BudgetModule } from './modules/budget/budget.module';
import { ProductsModule } from './modules/products/products.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    AgentsModule,
    CrmModule,
    TasksModule,
    DocumentsModule,
    HealthModule,
    // ── Módulos preparados (estructura lista, lógica por fases) ──
    MemoryModule,
    AutomationsModule,
    ProspectModule,
    OrionAiModule,
    BudgetModule,
    ProductsModule,
  ],
})
export class AppModule {}
