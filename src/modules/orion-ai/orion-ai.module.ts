import { Module } from '@nestjs/common';
import { OrionAiService } from './orion-ai.service';
import { OrionAiController } from './orion-ai.controller';
import { GeminiProvider } from './providers/gemini.provider';
import { LLM_PROVIDER } from './llm.types';
import { PlacesService } from './places.service';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [ProductsModule],
  controllers: [OrionAiController],
  providers: [
    OrionAiService,
    PlacesService,
    { provide: LLM_PROVIDER, useClass: GeminiProvider },
  ],
  exports: [OrionAiService, PlacesService],
})
export class OrionAiModule {}
