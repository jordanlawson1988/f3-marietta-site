import type { Metadata } from 'next';
import { getSql } from '@/lib/db';
import LedgerClient from './LedgerClient';

export const metadata: Metadata = {
  title: 'The Ledger · Beatdown Builder',
  description:
    'What the F3 Marietta Beatdown Builder has read from the backblast archive — per-AO coverage, recent repeats, and knowledge freshness.',
};

// Same posture as the builder page: the AO list and archive counts change
// rarely, and timed regenerations wake the Neon endpoint.
export const revalidate = 3600;

export interface AoCoverage {
  id: string;
  ao_display_name: string;
  backblasts: number;
}

export default async function LedgerPage() {
  let aos: AoCoverage[] = [];

  try {
    const sql = getSql();
    // One grouped count for the whole region rather than a query per AO.
    const rows = (await sql`
      SELECT c.id, c.ao_display_name, count(e.id)::int AS backblasts
      FROM ao_channels c
      LEFT JOIN f3_events e
        ON e.ao_display_name = c.ao_display_name
       AND e.event_kind = 'backblast'
       AND e.is_deleted = false
      WHERE c.is_enabled = true
      GROUP BY c.id, c.ao_display_name
      ORDER BY count(e.id) DESC, c.ao_display_name
    `) as AoCoverage[];
    aos = rows;
  } catch (error) {
    // Graceful degradation, same contract as the builder page: render the
    // shell rather than failing prerender when the database is unreachable.
    console.error('[beatdown:ledger] AO coverage failed:', error);
  }

  return <LedgerClient aos={aos} />;
}
