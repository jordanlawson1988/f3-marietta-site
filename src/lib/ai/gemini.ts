import { GoogleGenAI } from '@google/genai';

export const GEMINI_MODEL = 'gemini-2.5-flash';

let _gemini: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
  if (!_gemini) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is not set');
    _gemini = new GoogleGenAI({ apiKey });
  }
  return _gemini;
}
