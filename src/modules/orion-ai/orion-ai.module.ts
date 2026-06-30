import { Module } from '@nestjs/common';
import { OrionAiService } from './orion-ai.service';
import { OrionAiController } from './orion-ai.controller';
import { GeminiProvider } from './providers/gemini.provider';
import { LLM_PROVIDER } from './llm.types';

/**
 * ORION AI — cerebro central. Exporta OrionAiService para que cualquier otro
 * módulo (Prospect, Agentes, ShelbyPOS, futuros) lo inyecte y use la misma IA.
 * El proveedor (Gemini) se enchufa por token: migrar a Vertex u otro = cambiar
 * el useClass, sin tocar a los consumidores.
 */
@Module({
  controllers: [OrionAiController],
  providers: [
    OrionAiService,
    { provide: LLM_PROVIDER, useClass: GeminiProvider },
  ],
  exports: [OrionAiService],
})
export class OrionAiModule {}
