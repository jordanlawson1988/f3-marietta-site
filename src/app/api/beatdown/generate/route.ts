import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSql } from '@/lib/db';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { buildBeatdownContext, loadStaticContext } from '@/lib/beatdown/buildContext';
import { BEATDOWN_SYSTEM_INSTRUCTION } from '@/lib/beatdown/prompts/system';
import { buildUserPrompt } from '@/lib/beatdown/prompts/user';
import { parseResponse } from '@/lib/beatdown/parseResponse';
import { GEMINI_MODEL, generateGeminiContent, isTransientGeminiError } from '@/lib/ai/gemini';
import { LOCAL_BEATDOWN_MODEL, buildLocalBeatdownFallback } from '@/lib/beatdown/localFallback';
import {
  DEFAULT_LENGTH_MIN,
  MIN_LENGTH_MIN,
  MAX_LENGTH_MIN,
  type BeatdownInputs,
  type BeatdownEquipment,
  type BeatdownFocus,
  type BeatdownTheme,
} from '@/types/beatdown';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_FOCUS: BeatdownFocus[] = ['full', 'legs', 'core', 'upper', 'cardio'];
const VALID_EQUIPMENT: BeatdownEquipment[] = ['bodyweight', 'coupon', 'sandbag', 'kettlebell', 'sled'];
const VALID_THEME = ['fng-friendly', 'holiday', 'q-school', 'birthday-q', 'ruck', 'honor'] as const;

export async function POST(request: NextRequest) {
  const requestId = randomUUID().slice(0, 8);
  const t0 = Date.now();

  const rateLimited = checkRateLimit(request, { maxRequests: 10, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const inputs = await validateInputs(body, requestId);
  if ('error' in inputs) {
    if (inputs.error === 'lookup_failed') {
      return NextResponse.json(
        { error: 'lookup_failed', message: 'Beatdown Builder is temporarily unavailable.' },
        { status: 503 }
      );
    }
    console.warn(`[beatdown:${requestId}] validation`, inputs.error, inputs.field);
    return NextResponse.json(inputs, { status: 400 });
  }

  console.log(`[beatdown:${requestId}] start ao=${inputs.ao_id ?? 'none'} focus=${inputs.focus} length=${inputs.length_min}`);

  if (!process.env.GOOGLE_AI_API_KEY) {
    console.error(`[beatdown:${requestId}] GOOGLE_AI_API_KEY missing`);
    return NextResponse.json(
      { error: 'service_unavailable', message: 'Beatdown Builder is temporarily unavailable.' },
      { status: 503 }
    );
  }

  const ctx = await buildBeatdownContext(inputs);
  const staticCtx = loadStaticContext(inputs);

  const userPrompt = buildUserPrompt({
    inputs,
    aoContext: staticCtx.aoContext,
    knowledgeContent: ctx.knowledgeContent,
    recentAtAo: ctx.recentAtAo,
    exiconSubset: staticCtx.exiconSubset,
    famousBdLibrary: staticCtx.famousBdLibrary,
    selectedFamousBd: staticCtx.selectedFamousBd,
  });

  try {
    const { response: resp, model } = await generateGeminiContent({
      model: GEMINI_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: BEATDOWN_SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingBudget: 256 },
        maxOutputTokens: 2400,
        temperature: 0.7,
        topP: 0.9,
        responseMimeType: 'application/json',
      },
    }, {
      logPrefix: `[beatdown:${requestId}]`,
    });

    const text = resp.text || '';
    const draft = parseResponse(text);
    const generation_ms = Date.now() - t0;

    console.log(`[beatdown:${requestId}] ok ${generation_ms}ms`);
    return NextResponse.json({
      title: draft.title,
      sections: draft.sections,
      generation_ms,
      model,
      knowledge_version: ctx.knowledgeVersion,
    });
  } catch (err) {
    console.error(`[beatdown:${requestId}] generate error`, err);
    if (isTransientGeminiError(err)) {
      const draft = buildLocalBeatdownFallback(inputs);
      const generation_ms = Date.now() - t0;
      console.warn(`[beatdown:${requestId}] using local fallback ${generation_ms}ms`);
      return NextResponse.json({
        title: draft.title,
        sections: draft.sections,
        generation_ms,
        model: LOCAL_BEATDOWN_MODEL,
        knowledge_version: ctx.knowledgeVersion,
        fallback_reason: 'ai_model_busy',
      });
    }
    return NextResponse.json(
      { error: 'generation_error', message: 'Generation failed. Please try again.' },
      { status: 500 }
    );
  }
}

async function validateInputs(raw: unknown, requestId: string): Promise<BeatdownInputs | { error: string; field?: string }> {
  if (!raw || typeof raw !== 'object') return { error: 'bad_request' };
  const r = raw as Record<string, unknown>;

  const rawAoId = typeof r.ao_id === 'string' ? r.ao_id : '';
  let ao_id: string | null = null;
  let ao_display_name: string | null = null;
  if (rawAoId) {
    let aoRows: { id: string; ao_display_name: string }[];
    try {
      const sql = getSql();
      aoRows = await sql`SELECT id, ao_display_name FROM ao_channels WHERE id = ${rawAoId} AND is_enabled = true LIMIT 1` as { id: string; ao_display_name: string }[];
    } catch (err) {
      console.error(`[beatdown:${requestId}] db lookup failed`, err);
      return { error: 'lookup_failed', field: 'ao_id' };
    }
    if (aoRows.length === 0) return { error: 'invalid_ao', field: 'ao_id' };
    ao_id = aoRows[0].id;
    ao_display_name = aoRows[0].ao_display_name;
  }

  if (typeof r.focus !== 'string' || !VALID_FOCUS.includes(r.focus as BeatdownFocus)) {
    return { error: 'invalid_focus', field: 'focus' };
  }
  const focus = r.focus as BeatdownFocus;

  let theme: BeatdownTheme = null;
  if (typeof r.theme === 'string' && r.theme.length > 0) {
    if (!(VALID_THEME as readonly string[]).includes(r.theme)) return { error: 'invalid_theme', field: 'theme' };
    theme = r.theme as BeatdownTheme;
  }

  const equipment = Array.isArray(r.equipment) ? r.equipment.filter((e): e is BeatdownEquipment => VALID_EQUIPMENT.includes(e as BeatdownEquipment)) : [];
  if (equipment.length === 0) equipment.push('bodyweight');

  const famous_bd = typeof r.famous_bd === 'string' && r.famous_bd ? r.famous_bd : null;

  let q_notes = typeof r.q_notes === 'string' ? r.q_notes : '';
  if (q_notes.length > 1000) q_notes = q_notes.slice(0, 1000);

  let length_min = DEFAULT_LENGTH_MIN;
  if (typeof r.length_min === 'number' && Number.isFinite(r.length_min)) {
    length_min = Math.min(MAX_LENGTH_MIN, Math.max(MIN_LENGTH_MIN, Math.round(r.length_min)));
  }

  return { ao_id, ao_display_name, focus, theme, equipment, famous_bd, q_notes, length_min };
}
