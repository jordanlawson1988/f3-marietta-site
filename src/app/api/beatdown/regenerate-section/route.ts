import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { buildBeatdownContext, loadStaticContext } from '@/lib/beatdown/buildContext';
import { BEATDOWN_SYSTEM_INSTRUCTION } from '@/lib/beatdown/prompts/system';
import { buildRegeneratePrompt } from '@/lib/beatdown/prompts/regenerate';
import { stripCodeFences } from '@/lib/beatdown/parseResponse';
import { GEMINI_MODEL, generateGeminiContent, isTransientGeminiError } from '@/lib/ai/gemini';
import { LOCAL_BEATDOWN_MODEL, buildLocalSectionFallback } from '@/lib/beatdown/localFallback';
import type { BeatdownDraft, BeatdownInputs, BeatdownSections } from '@/types/beatdown';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const rateLimited = checkRateLimit(request, { maxRequests: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const requestId = randomUUID().slice(0, 8);
  const t0 = Date.now();

  let body: { inputs: BeatdownInputs; current: BeatdownDraft; section: 'warmup' | 'thang' | 'cot' };
  try {
    body = await request.json();
  } catch {
    console.warn(`[beatdown:regen:${requestId}] validation invalid_json`);
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body?.inputs || !body?.current || !['warmup', 'thang', 'cot'].includes(body.section)) {
    console.warn(`[beatdown:regen:${requestId}] validation bad_request`);
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  console.log(`[beatdown:regen:${requestId}] start ao=${body.inputs.ao_id ?? 'none'} section=${body.section}`);

  if (!process.env.GOOGLE_AI_API_KEY) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  try {
    const ctx = await buildBeatdownContext(body.inputs);
    const staticCtx = loadStaticContext(body.inputs);
    const prompt = buildRegeneratePrompt(
      {
        inputs: body.inputs,
        aoContext: staticCtx.aoContext,
        knowledgeContent: ctx.knowledgeContent,
        recentAtAo: ctx.recentAtAo,
        exiconSubset: staticCtx.exiconSubset,
        famousBdLibrary: staticCtx.famousBdLibrary,
        selectedFamousBd: staticCtx.selectedFamousBd,
      },
      body.current,
      body.section
    );

    const { response: resp, model } = await generateGeminiContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: BEATDOWN_SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingBudget: 256 },
        maxOutputTokens: 1200,
        temperature: 0.8,
        topP: 0.9,
        responseMimeType: 'application/json',
      },
    }, {
      logPrefix: `[beatdown:regen:${requestId}]`,
    });

    const text = resp.text || '';
    const sectionData = JSON.parse(stripCodeFences(text)) as BeatdownSections[typeof body.section];
    const generation_ms = Date.now() - t0;
    console.log(`[beatdown:regen:${requestId}] ok ${generation_ms}ms model=${model}`);
    return NextResponse.json({ section: body.section, data: sectionData, generation_ms, model });
  } catch (err) {
    console.error(`[beatdown:regen:${requestId}] error`, err);
    if (isTransientGeminiError(err)) {
      const generation_ms = Date.now() - t0;
      const data = buildLocalSectionFallback(body.inputs, body.section);
      console.warn(`[beatdown:regen:${requestId}] using local fallback ${generation_ms}ms`);
      return NextResponse.json({
        section: body.section,
        data,
        generation_ms,
        model: LOCAL_BEATDOWN_MODEL,
        fallback_reason: 'ai_model_busy',
      });
    }
    return NextResponse.json({ error: 'generation_error' }, { status: 500 });
  }
}
