import type { Metadata } from 'next';
import { getSql } from '@/lib/db';
import { loadFamousBeatdowns } from '@/lib/beatdown/loadFamousBeatdowns';
import BeatdownBuilderClient from './BeatdownBuilderClient';

export const metadata: Metadata = {
  title: 'AI Beatdown Builder · F3 Marietta',
  description:
    'Generate F3-format beatdowns grounded in F3 Marietta backblasts and the Exicon. Customize, save, and share.',
};

// The AO dropdown is the page's only dynamic data and changes rarely.
// ISR + on-demand revalidation from the admin AO routes keeps it fresh
// without waking Neon on every visit (this page was force-dynamic before).
export const revalidate = 3600;

export default async function BeatdownBuilderPage() {
  let aos: { id: string; ao_display_name: string }[] = [];
  try {
    const sql = getSql();
    aos = (await sql`
      SELECT id, ao_display_name
      FROM ao_channels
      WHERE is_enabled = true
      ORDER BY ao_display_name
    `) as { id: string; ao_display_name: string }[];
  } catch (error) {
    // Graceful-degradation contract shared by page data loaders: render
    // with an empty AO list (generic beatdowns still work) instead of
    // failing prerender — e.g. CI builds without DATABASE_URL.
    console.error('[beatdown-builder] AO list failed:', error);
  }

  const famous = loadFamousBeatdowns().map((b) => ({
    slug: b.slug,
    title: b.title,
    category: b.category,
    description: b.description,
  }));

  return <BeatdownBuilderClient aos={aos} famousBeatdowns={famous} />;
}
