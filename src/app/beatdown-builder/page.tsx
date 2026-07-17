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
  const sql = getSql();
  const aos = (await sql`
    SELECT id, ao_display_name
    FROM ao_channels
    WHERE is_enabled = true
    ORDER BY ao_display_name
  `) as { id: string; ao_display_name: string }[];

  const famous = loadFamousBeatdowns().map((b) => ({
    slug: b.slug,
    title: b.title,
    category: b.category,
    description: b.description,
  }));

  return <BeatdownBuilderClient aos={aos} famousBeatdowns={famous} />;
}
