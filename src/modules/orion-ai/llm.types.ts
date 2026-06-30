/**
 * Puerto de proveedor LLM. ORION es agnóstico al motor: hoy Gemini,
 * mañana Vertex/otro, con la misma interfaz. Preparado para multimodal
 * (texto + imágenes/OCR/documentos) vía `attachments`.
 */
export type ChatRole = 'user' | 'model';

export interface ChatTurn {
  role: ChatRole;
  text: string;
}

export interface Attachment {
  /** MIME, p.ej. image/png, application/pdf, audio/wav (futuro: voz/OCR/docs). */
  mimeType: string;
  /** Datos en base64 (inline) … */
  data?: string;
  /** …o URI de un archivo previamente subido (Files API). */
  fileUri?: string;
}

export interface ModelConfig {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  /** Respuesta forzada a JSON (responseMimeType=application/json). */
  json?: boolean;
}

export interface LlmRequest {
  prompt: string;
  history?: ChatTurn[];
  /** Contexto del negocio (tenant/ShelbyPOS): se inyecta como system instruction. */
  businessContext?: string;
  /** Instrucción de sistema adicional (rol/objetivo de la capacidad). */
  system?: string;
  attachments?: Attachment[];
  config?: ModelConfig;
}

export interface LlmResponse {
  text: string;
  model: string;
  provider: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}

export type LlmErrorCode =
  | 'NO_CONNECTION'
  | 'TIMEOUT'
  | 'QUOTA'
  | 'INVALID_KEY'
  | 'NOT_CONFIGURED'
  | 'GOOGLE_ERROR'
  | 'UNKNOWN';

export class LlmError extends Error {
  constructor(public readonly code: LlmErrorCode, message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'LlmError';
  }
}

export interface LlmProvider {
  readonly name: string;
  isConfigured(): boolean;
  generate(req: LlmRequest): Promise<LlmResponse>;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
