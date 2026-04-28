import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { randomUUID } from 'crypto';
import { getSql } from '@/lib/db';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { buildBeatdownContext, loadStaticContext } from '@/lib/beatdown/buildContext';
import { BEATDOWN_SYSTEM_INSTRUCTION } from '@/lib/beatdown/prompts/system';
import { buildUserPrompt } from '@/lib/beatdown/prompts/user';
import { parseResponse } from '@/lib/beatdown/parseResponse';
import type { BeatdownInputs, BeatdownEquipment, BeatdownFocus, BeatdownTheme } from '@/types/beatdown';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = 'gemini-2.5-flash';
const VALID_FOCUS: BeatdownFocus[] = ['full', 'legs', 'core', 'upper', 'cardio'];
const VALID_EQUIPMENT: BeatdownEquipment[] = ['bodyweight', 'coupon', 'sandbag', 'kettlebell', 'sled'];
const VALID_THEME = ['fng-friendly', 'holiday', 'q-school', 'birthday-q', 'ruck', 'honor'] as const;

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

  const inputs = await validateInputs(body);
  if ('error' in inputs) return NextResponse.json(inputs, { status: 400 });

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
    knowledgeContent: ctx.knowledgeContent,
    recentAtAo: ctx.recentAtAo,
    exiconSubset: staticCtx.exiconSubset,
    famousBdLibrary: staticCtx.famousBdLibrary,
    selectedFamousBd: staticCtx.selectedFamousBd,
  });

  try {
    const gemini = getGemini();
    const resp = await gemini.models.generateContent({
      model: MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: BEATDOWN_SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 2400,
        temperature: 0.7,
        topP: 0.9,
        responseMimeType: 'application/json',
      },
    });

    const text = resp.text || '';
    const draft = parseResponse(text);
    const generation_ms = Date.now() - t0;

    return NextResponse.json({
      title: draft.title,
      sections: draft.sections,
      generation_ms,
      model: MODEL,
      knowledge_version: ctx.knowledgeVersion,
    });
  } catch (err) {
    console.error(`[beatdown:${requestId}] generate error`, err);
    return NextResponse.json(
      { error: 'generation_error', message: 'Generation failed. Please try again.' },
      { status: 500 }
    );
  }
}

async function validateInputs(raw: unknown): Promise<BeatdownInputs | { error: string; field?: string }> {
  if (!raw || typeof raw !== 'object') return { error: 'bad_request' };
  const r = raw as Record<string, unknown>;

  const ao_id = typeof r.ao_id === 'string' ? r.ao_id : '';
  if (!ao_id) return { error: 'missing_ao_id', field: 'ao_id' };

  const sql = getSql();
  const aoRows = await sql`SELECT id, ao_display_name FROM ao_channels WHERE id = ${ao_id} AND is_enabled = true LIMIT 1` as { id: string; ao_display_name: string }[];
  if (aoRows.length === 0) return { error: 'invalid_ao', field: 'ao_id' };
  const ao_display_name = aoRows[0].ao_display_name;

  const focus = r.focus as BeatdownFocus;
  if (!VALID_FOCUS.includes(focus)) return { error: 'invalid_focus', field: 'focus' };

  let theme: BeatdownTheme = null;
  if (typeof r.theme === 'string' && r.theme.length > 0) {
    if (!(VALID_THEME as readonly string[]).includes(r.theme)) return { error: 'invalid_theme', field: 'theme' };
    theme = r.theme as BeatdownTheme;
  }

  const equipment = Array.isArray(r.equipment) ? r.equipment.filter((e): e is BeatdownEquipment => VALID_EQUIPMENT.includes(e as BeatdownEquipment)) : [];
  if (equipment.length === 0) equipment.push('bodyweight');

  const famous_bd = typeof r.famous_bd === 'string' && r.famous_bd ? r.famous_bd : null;

  let q_notes = typeof r.q_notes === 'string' ? r.q_notes : '';
  if (q_notes.length > 200) q_notes = q_notes.slice(0, 200);

  return { ao_id, ao_display_name, focus, theme, equipment, famous_bd, q_notes };
}
