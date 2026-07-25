import { GoogleGenAI, ThinkingLevel, type GenerateContentConfig } from '@google/genai';

/**
 * Primary + fallback chain for beatdown generation and knowledge analysis.
 * gemini-3.1-pro-preview is the strongest reasoning model available
 * (July 2026); gemini-3.5-flash is the GA flash-tier fallback.
 * Gemini 2.x is retired per Jordan's 3.1+-only policy (2026-07-25).
 */
export const GEMINI_MODEL = 'gemini-3.1-pro-preview';
export const GEMINI_FALLBACK_MODELS = ['gemini-3.5-flash'];

export type GeminiReasoning = 'minimal' | 'low' | 'medium' | 'high';

export interface ModelCallOptions {
  systemInstruction: string;
  reasoning: GeminiReasoning;
  maxOutputTokens: number;
  /**
   * Knobs applied ONLY to pre-Gemini-3 fallback models. Gemini 3.x rejects
   * thinkingBudget when thinkingLevel is set (400) and Google recommends
   * leaving temperature at the 1.0 default for 3.x, so these never reach a
   * 3.x request.
   */
  legacy?: { temperature?: number; topP?: number; thinkingBudget?: number };
}

let _gemini: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
  if (!_gemini) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is not set');
    _gemini = new GoogleGenAI({ apiKey });
  }
  return _gemini;
}

export function isGemini3(model: string): boolean {
  const m = /^gemini-(\d+(?:\.\d+)?)/.exec(model);
  return m ? parseFloat(m[1]) >= 3 : false;
}

const THINKING_LEVELS: Record<GeminiReasoning, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

const LEGACY_THINKING_BUDGETS: Record<GeminiReasoning, number> = {
  minimal: 0,
  low: 256,
  medium: 512,
  high: 1024,
};

/** Synthesize a generateContent config appropriate for the model family. */
export function buildModelConfig(model: string, opts: ModelCallOptions): GenerateContentConfig {
  const base: GenerateContentConfig = {
    systemInstruction: opts.systemInstruction,
    maxOutputTokens: opts.maxOutputTokens,
    responseMimeType: 'application/json',
  };

  if (isGemini3(model)) {
    return {
      ...base,
      thinkingConfig: { thinkingLevel: THINKING_LEVELS[opts.reasoning] },
    };
  }

  return {
    ...base,
    thinkingConfig: {
      thinkingBudget: opts.legacy?.thinkingBudget ?? LEGACY_THINKING_BUDGETS[opts.reasoning],
    },
    ...(opts.legacy?.temperature !== undefined ? { temperature: opts.legacy.temperature } : {}),
    ...(opts.legacy?.topP !== undefined ? { topP: opts.legacy.topP } : {}),
  };
}

type GenerateContentResponse = Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>;

export async function generateGeminiContent(
  params: { models?: string[]; contents: string } & ModelCallOptions,
  options: { requestId?: string; logPrefix?: string } = {}
): Promise<{ response: GenerateContentResponse; model: string }> {
  const gemini = getGemini();
  const models = Array.from(new Set(params.models ?? [GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS]));
  let lastError: unknown;

  for (const model of models) {
    const maxAttempts = model === models[0] ? 2 : 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await gemini.models.generateContent({
          model,
          contents: params.contents,
          config: buildModelConfig(model, params),
        });
        return { response, model };
      } catch (err) {
        lastError = err;
        if (!isTransientGeminiError(err)) throw err;
        if (options.logPrefix) {
          console.warn(`${options.logPrefix} transient Gemini error model=${model} attempt=${attempt}`, summarizeGeminiError(err));
        }
        if (attempt < maxAttempts) await sleep(500 * attempt);
      }
    }
  }

  throw lastError;
}

export function isTransientGeminiError(err: unknown): boolean {
  const status = typeof err === 'object' && err !== null && 'status' in err
    ? Number((err as { status?: unknown }).status)
    : NaN;
  if ([429, 500, 502, 503, 504].includes(status)) return true;

  const message = err instanceof Error ? err.message : String(err);
  return /UNAVAILABLE|high demand|overloaded|rate limit|temporarily/i.test(message);
}

function summarizeGeminiError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
