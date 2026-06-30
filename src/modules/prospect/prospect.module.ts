import { Module } from '@nestjs/common';
import { ProspectService } from './prospect.service';
import { ProspectController } from './prospect.controller';
import { QualificationService } from './qualification.service';
import { DISCOVERY_PROVIDER, GooglePlacesProvider } from './discovery.provider';
import { OrionAiModule } from '../orion-ai/orion-ai.module';
import { BudgetModule } from '../budget/budget.module';

@Module({
  imports: [OrionAiModule, BudgetModule],
  controllers: [ProspectController],
  providers: [
    ProspectService,
    QualificationService,
    { provide: DISCOVERY_PROVIDER, useClass: GooglePlacesProvider },
  ],
})
export class ProspectModule {}
