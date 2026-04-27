import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { BeatdownEquipment, BeatdownFocus } from '@/types/beatdown';

export interface FamousBeatdown {
  slug: string;
  title: string;
  category: 'famous' | 'ipc';
  length_min: number;
  equipment: BeatdownEquipment[];
  focus: BeatdownFocus;
  description: string;
  body: string;
}

const DIR = path.join(process.cwd(), 'data/content/famous-beatdowns');

let cache: FamousBeatdown[] | null = null;

export function loadFamousBeatdowns(): FamousBeatdown[] {
  if (cache) return cache;

  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.md') && f !== 'README.md');
  const entries: FamousBeatdown[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(DIR, file), 'utf8');
    const { data, content } = matter(raw);
    if (!data.slug || !data.title) continue;
    entries.push({
      slug: String(data.slug),
      title: String(data.title),
      category: data.category === 'ipc' ? 'ipc' : 'famous',
      length_min: Number(data.length_min) || 45,
      equipment: Array.isArray(data.equipment) ? (data.equipment as BeatdownEquipment[]) : ['bodyweight'],
      focus: (data.focus as BeatdownFocus) || 'full',
      description: String(data.description || ''),
      body: content.trim(),
    });
  }

  cache = entries.sort((a, b) => a.title.localeCompare(b.title));
  return cache;
}

export function findFamousBeatdown(slug: string | null): FamousBeatdown | null {
  if (!slug) return null;
  return loadFamousBeatdowns().find(b => b.slug === slug) ?? null;
}
