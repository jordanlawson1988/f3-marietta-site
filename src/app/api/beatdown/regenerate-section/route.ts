import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { buildBeatdownContext, loadStaticContext } from '@/lib/beatdown/buildContext';
import { BEATDOWN_SYSTEM_INSTRUCTION } from '@/lib/beatdown/prompts/system';
import { buildRegeneratePrompt } from '@/lib/beatdown/prompts/regenerate';
import type { BeatdownDraft, BeatdownInputs, BeatdownSections } from '@/types/beatdown';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = 'gemini-2.5-flash';

let _gemini: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!_gemini) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is not set');
    _gemini = new GoogleGenAI({ apiKey });
  }
  return _gemini;
}

export async function POST(request: NextRequest) {
  const rateLimited = checkRateLimit(request, { maxRequests: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  let body: { inputs: BeatdownInputs; current: BeatdownDraft; section: 'warmup' | 'thang' | 'cot' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body?.inputs || !body?.current || !['warmup', 'thang', 'cot'].includes(body.section)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  if (!process.env.GOOGLE_AI_API_KEY) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  try {
    const ctx = await buildBeatdownContext(body.inputs);
    const staticCtx = loadStaticContext(body.inputs);
    const prompt = buildRegeneratePrompt(
      {
        inputs: body.inputs,
        knowledgeContent: ctx.knowledgeContent,
        recentAtAo: ctx.recentAtAo,
        exiconSubset: staticCtx.exiconSubset,
        famousBdLibrary: staticCtx.famousBdLibrary,
        selectedFamousBd: staticCtx.selectedFamousBd,
      },
      body.current,
      body.section
    );

    const gemini = getGemini();
    const resp = await gemini.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction: BEATDOWN_SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 1200,
        temperature: 0.8,
        topP: 0.9,
        responseMimeType: 'application/json',
      },
    });

    const text = resp.text || '';
    const sectionData = JSON.parse(stripFences(text)) as BeatdownSections[typeof body.section];
    return NextResponse.json({ section: body.section, data: sectionData });
  } catch (err) {
    console.error('[beatdown:regen]', err);
    return NextResponse.json({ error: 'generation_error' }, { status: 500 });
  }
}

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
}
