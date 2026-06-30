import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import {
  Attachment,
  ChatTurn,
  LlmError,
  LlmProvider,
  LlmRequest,
  LlmResponse,
} from '../llm.types';

/**
 * Proveedor Gemini sobre el Google Gen AI SDK oficial (@google/genai).
 *
 * Autenticación (dos modos, mismo código):
 *  - Developer API  → GEMINI_API_KEY (variable de entorno; NUNCA en código).
 *  - Vertex AI/Prod → GOOGLE_GENAI_USE_VERTEXAI=true + ADC (credenciales de
 *    servicio vía GOOGLE_APPLICATION_CREDENTIALS) + GOOGLE_CLOUD_PROJECT/LOCATION.
 *
 * Para migrar a producción NO se cambia este archivo: solo variables de entorno.
 */
@Injectable()
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';
  private readonly logger = new Logger('OrionAI:Gemini');
  private client: GoogleGenAI | null = null;

  private readonly useVertex = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';
  private readonly apiKey = process.env.GEMINI_API_KEY ?? '';
  private readonly defaultModel = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  private readonly timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS ?? 30000);

  isConfigured(): boolean {
    return this.useVertex
      ? Boolean(process.env.GOOGLE_CLOUD_PROJECT)
      : this.apiKey.length > 0;
  }

  /** Cliente perezoso (no se instancia hasta el primer uso). */
  private getClient(): GoogleGenAI {
    if (this.client) return this.client;
    if (!this.isConfigured()) {
      throw new LlmError('NOT_CONFIGURED', 'Gemini no está configurado. Define GEMINI_API_KEY (o credenciales de Vertex).');
    }
    this.client = this.useVertex
      ? new GoogleGenAI({
          vertexai: true,
          project: process.env.GOOGLE_CLOUD_PROJECT,
          location: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
        } as any)
      : new GoogleGenAI({ apiKey: this.apiKey });
    this.logger.log(`Cliente Gemini listo (modo=${this.useVertex ? 'vertex' : 'developer'}, modelo=${this.defaultModel})`);
    return this.client;
  }

  async generate(req: LlmRequest): Promise<LlmResponse> {
    const client = this.getClient();
    const model = req.config?.model ?? this.defaultModel;
    const t0 = Date.now();

    const systemInstruction = [req.system, req.businessContext].filter(Boolean).join('\n\n') || undefined;
    const contents = this.buildContents(req.history ?? [], req.prompt, req.attachments ?? []);

    const config: Record<string, unknown> = {
      ...(systemInstruction ? { systemInstruction } : {}),
      ...(req.config?.temperature !== undefined ? { temperature: req.config.temperature } : {}),
      ...(req.config?.maxOutputTokens !== undefined ? { maxOutputTokens: req.config.maxOutputTokens } : {}),
      ...(req.config?.topP !== undefined ? { topP: req.config.topP } : {}),
      ...(req.config?.topK !== undefined ? { topK: req.config.topK } : {}),
      ...(req.config?.json ? { responseMimeType: 'application/json' } : {}),
    };

    try {
      this.logger.debug(`→ generateContent modelo=${model} turnos=${contents.length}`);
      // Frontera con el SDK: tipamos como any para tolerar diferencias de versión.
      const params: any = { model, contents, config };
      const response: any = await this.withTimeout(client.models.generateContent(params), this.timeoutMs);

      const text: string = response?.text ?? '';
      const usageRaw = response?.usageMetadata as
        | { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
        | undefined;
      this.logger.log(`← Gemini OK (${Date.now() - t0}ms, ${usageRaw?.totalTokenCount ?? '?'} tokens)`);

      return {
        text,
        model,
        provider: this.name,
        usage: usageRaw
          ? { inputTokens: usageRaw.promptTokenCount, outputTokens: usageRaw.candidatesTokenCount, totalTokens: usageRaw.totalTokenCount }
          : undefined,
      };
    } catch (err) {
      throw this.mapError(err);
    }
  }

  /** Construye los `contents` (historial + prompt + adjuntos multimodales). */
  private buildContents(history: ChatTurn[], prompt: string, attachments: Attachment[]): any[] {
    const contents: any[] = history.map((t) => ({ role: t.role, parts: [{ text: t.text }] }));
    const parts: any[] = [{ text: prompt }];
    for (const a of attachments) {
      if (a.data) parts.push({ inlineData: { mimeType: a.mimeType, data: a.data } });
      else if (a.fileUri) parts.push({ fileData: { mimeType: a.mimeType, fileUri: a.fileUri } });
    }
    contents.push({ role: 'user', parts });
    return contents;
  }

  /** Timeout duro: si Gemini no responde a tiempo, error claro. */
  private withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      p,
      new Promise<T>((_, reject) => setTimeout(() => reject(new LlmError('TIMEOUT', `Tiempo de espera agotado (${ms}ms) esperando a Gemini.`)), ms)),
    ]);
  }

  /** Traduce cualquier fallo a un LlmError con código claro + log. */
  private mapError(err: unknown): LlmError {
    if (err instanceof LlmError) { this.logger.error(`Gemini ${err.code}: ${err.message}`); return err; }

    const e = err as { message?: string; status?: number; code?: string };
    const msg = (e.message ?? '').toLowerCase();
    const status = e.status ?? (msg.match(/\b(429|401|403|500|503)\b/) ? Number(RegExp.$1) : undefined);

    let code: LlmError['code'] = 'GOOGLE_ERROR';
    let message = 'Error de Google AI al generar la respuesta.';

    if (e.code === 'ENOTFOUND' || e.code === 'ECONNREFUSED' || msg.includes('fetch failed') || msg.includes('network')) {
      code = 'NO_CONNECTION'; message = 'Sin conexión con el servicio de Gemini.';
    } else if (status === 429 || msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource_exhausted')) {
      code = 'QUOTA'; message = 'Se alcanzó el límite de cuota o de tasa de Gemini. Intenta más tarde.';
    } else if (status === 401 || status === 403 || msg.includes('api key') || msg.includes('api_key_invalid') || msg.includes('permission')) {
      code = 'INVALID_KEY'; message = 'API key de Gemini inválida o sin permisos. Revisa GEMINI_API_KEY.';
    }

    this.logger.error(`Gemini ${code}: ${message} | original: ${String(e.message ?? err)}`);
    return new LlmError(code, message, err);
  }
}
