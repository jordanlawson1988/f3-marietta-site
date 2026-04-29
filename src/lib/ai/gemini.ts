import { GoogleGenAI } from '@google/genai';

export const GEMINI_MODEL = 'gemini-2.5-flash';
export const GEMINI_FALLBACK_MODELS = ['gemini-2.5-flash-lite'];

let _gemini: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
  if (!_gemini) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is not set');
    _gemini = new GoogleGenAI({ apiKey });
  }
  return _gemini;
}

type GenerateContentParams = Parameters<GoogleGenAI['models']['generateContent']>[0];
type GenerateContentResponse = Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>;

export async function generateGeminiContent(
  params: GenerateContentParams,
  options: { requestId?: string; logPrefix?: string } = {}
): Promise<{ response: GenerateContentResponse; model: string }> {
  const gemini = getGemini();
  const models = Array.from(new Set([
    params.model || GEMINI_MODEL,
    ...GEMINI_FALLBACK_MODELS,
  ]));
  let lastError: unknown;

  for (const model of models) {
    const maxAttempts = model === params.model ? 2 : 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await gemini.models.generateContent({ ...params, model });
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
