import { Module } from '@nestjs/common';
import { OrionAiService } from './orion-ai.service';
import { OrionAiController } from './orion-ai.controller';
import { GeminiProvider } from './providers/gemini.provider';
import { LLM_PROVIDER } from './llm.types';
import { PlacesService } from './places.service';

@Module({
  controllers: [OrionAiController],
  providers: [
    OrionAiService,
    PlacesService,
    { provide: LLM_PROVIDER, useClass: GeminiProvider },
  ],
  exports: [OrionAiService, PlacesService],
})
export class OrionAiModule {}
