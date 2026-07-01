import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { LLM_PROVIDER, LlmError, LlmProvider, LlmRequest, LlmResponse } from './llm.types';
import { SystemPrompts } from './prompts/system-prompts';

/**
 * Módulo central de IA de ORION. TODA función de IA del sistema (ShelbyPOS y
 * el resto de productos/agentes) pasa por aquí. Cambiar de modelo o proveedor
 * no afecta a quien lo consume.
 */
@Injectable()
export class OrionAiService {
  private readonly logger = new Logger('OrionAI');

  constructor(@Inject(LLM_PROVIDER) private readonly llm: LlmProvider) {}

  status() {
    return { provider: this.llm.name, configured: this.llm.isConfigured() };
  }

  /** Función central: prompt + historial + contexto de negocio + config. */
  async generate(req: LlmRequest): Promise<LlmResponse> {
    try {
      return await this.llm.generate(req);
    } catch (err) {
      throw this.toHttp(err);
    }
  }

  // ─────────── Capacidades especializadas (todas usan generate) ───────────

  ask(prompt: string, businessContext?: string, history?: LlmRequest['history']) {
    return this.generate({ prompt, businessContext, history, system: SystemPrompts.assistant() });
  }

  analyzeSales(data: string, question?: string, businessContext?: string) {
    return this.generate({
      prompt: `${question ? question + '\n\n' : ''}Datos de ventas:\n${data}`,
      businessContext, system: SystemPrompts.salesAnalysis(),
    });
  }

  analyzeInventory(data: string, question?: string, businessContext?: string) {
    return this.generate({
      prompt: `${question ? question + '\n\n' : ''}Datos de inventario:\n${data}`,
      businessContext, system: SystemPrompts.inventoryAnalysis(),
    });
  }

  recommendPurchases(data: string, businessContext?: string) {
    return this.generate({
      prompt: `Con base en estas ventas e inventario, recomienda compras:\n${data}`,
      businessContext, system: SystemPrompts.purchaseRecommendation(),
    });
  }

  generateReport(data: string, businessContext?: string) {
    return this.generate({
      prompt: `Genera un reporte ejecutivo con estos datos:\n${data}`,
      businessContext, system: SystemPrompts.report(),
    });
  }

  assist(prompt: string, audience: 'admin' | 'worker', businessContext?: string, history?: LlmRequest['history']) {
    return this.generate({
      prompt, businessContext, history,
      system: audience === 'admin' ? SystemPrompts.adminAssist() : SystemPrompts.workerAssist(),
    });
  }

  async findProspects(industry: string, location: string, count = 8): Promise<unknown[]> {
    const res = await this.generate({
      prompt: `Genera exactamente ${count} negocios del rubro "${industry}" en "${location}" que necesiten tecnología de ShelbyCore AI. Devuelve solo el JSON array, sin texto adicional.`,
      system: SystemPrompts.prospectFinder(),
      config: { json: true, temperature: 0.7 },
    });
    try {
      const text = res.text.replace(/```json|```/g, '').trim();
      return JSON.parse(text) as unknown[];
    } catch { return []; }
  }

  async analyzeCompany(data: { name: string; company?: string; industry?: string; location?: string; notes?: string }, productCatalog = ''): Promise<unknown> {
    const prompt = `Empresa: ${data.company || data.name}\nContacto: ${data.name}\nRubro: ${data.industry || 'desconocido'}\nUbicación: ${data.location || 'México'}\nNotas: ${data.notes || 'sin notas adicionales'}\n\nAnaliza y devuelve solo el JSON, sin texto adicional.`;
    const res = await this.generate({
      prompt,
      system: SystemPrompts.companyAnalyzer(productCatalog),
      config: { json: true, temperature: 0.4 },
    });
    try {
      const text = res.text.replace(/```json|```/g, '').trim();
      return JSON.parse(text);
    } catch { return { analysis: res.text, fitScore: 0.7, needs: ['ShelbyCore AI'], recommendedProduct: 'ShelbyCore AI', urgency: 'media' }; }
  }

  async generatePitch(data: { name: string; company?: string; industry?: string; location?: string; analysis?: string; recommendedProduct?: string; painPoint?: string }, productCatalog = ''): Promise<unknown> {
    const prompt = `Empresa: ${data.company || data.name}\nRubro: ${data.industry || 'general'}\nUbicación: ${data.location || 'México'}\nProducto recomendado: ${data.recommendedProduct || 'ShelbyCore AI'}\nProblema principal: ${data.painPoint || 'no especificado'}\nAnálisis: ${data.analysis || 'empresa sin análisis previo'}\n\nGenera el pitch y mensajes. Devuelve solo el JSON, sin texto adicional.`;
    const res = await this.generate({
      prompt,
      system: SystemPrompts.pitchGenerator(productCatalog),
      config: { json: true, temperature: 0.6 },
    });
    try {
      const text = res.text.replace(/```json|```/g, '').trim();
      return JSON.parse(text);
    } catch { return { pitch: res.text, whatsappMessage: res.text, emailSubject: 'ShelbyCore AI para tu negocio', emailBody: res.text, followUpDate: 3 }; }
  }

  // Preparado para multimodal (voz/OCR/imágenes/documentos): basta con pasar
  // `attachments` a generate(); la infraestructura ya lo soporta.

  /** Traduce LlmError → HttpException con código HTTP y mensaje claro. */
  private toHttp(err: unknown): HttpException {
    if (!(err instanceof LlmError)) {
      this.logger.error(`Error inesperado en ORION AI: ${String(err)}`);
      return new HttpException('Error interno de ORION AI', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    const map: Record<LlmError['code'], HttpStatus> = {
      NO_CONNECTION: HttpStatus.SERVICE_UNAVAILABLE,
      TIMEOUT: HttpStatus.GATEWAY_TIMEOUT,
      QUOTA: HttpStatus.TOO_MANY_REQUESTS,
      INVALID_KEY: HttpStatus.BAD_GATEWAY,
      NOT_CONFIGURED: HttpStatus.SERVICE_UNAVAILABLE,
      GOOGLE_ERROR: HttpStatus.BAD_GATEWAY,
      UNKNOWN: HttpStatus.INTERNAL_SERVER_ERROR,
    };
    return new HttpException({ error: err.code, message: err.message }, map[err.code]);
  }
}
