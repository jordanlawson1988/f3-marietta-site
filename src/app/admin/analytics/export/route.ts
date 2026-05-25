import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { validateAdminToken } from "@/lib/admin/auth";
import { parseTimeRange, defaultTimeRange } from "@/lib/stats/timeRange";
import { getOverviewStats } from "@/lib/stats/getOverviewStats";
import { getPaxStats } from "@/lib/stats/getPaxStats";
import { getAttendanceFact } from "@/lib/stats/getAttendanceFact";
import { parseAttendance } from "@/lib/stats/parseAttendance";

export const dynamic = "force-dynamic";

type Scope = "overview" | "ao" | "pax" | "raw";

function escape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) lines.push(row.map(escape).join(","));
  return lines.join("\n");
}

function filename(scope: Scope, slugOrRange: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `f3-analytics-${scope}-${slugOrRange}-${today}.csv`;
}

function csvResponse(body: string, name: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}

export async function GET(request: Request) {
  const authError = await validateAdminToken(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const scope = (url.searchParams.get("scope") ?? "overview") as Scope;
  const range =
    parseTimeRange({
      range: url.searchParams.get("range") ?? "current-month",
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    }) ?? defaultTimeRange();
  const aoSlug = url.searchParams.get("ao") || undefined;
  const paxSlug = url.searchParams.get("pax") || undefined;

  if (scope === "overview") {
    const stats = await getOverviewStats(range, null, Number.MAX_SAFE_INTEGER);
    const rows = stats.byAo.map((r) => [r.ao, r.aoSlug, r.count]);
    return csvResponse(
      toCsv(["ao_name", "ao_slug", "post_count"], rows),
      filename("overview", range.slug),
    );
  }

  if (scope === "ao") {
    if (!aoSlug) {
      return NextResponse.json({ error: "Missing ao slug" }, { status: 400 });
    }
    const sql = getSql();
    const from = range.from.toISOString().slice(0, 10);
    const to = range.to.toISOString().slice(0, 10);
    const events = (await sql`
      SELECT e.event_date::text AS event_date, e.ao_display_name AS ao_name, e.content_text
      FROM f3_events e
      JOIN ao_channels c ON c.slack_channel_id = e.slack_channel_id
      WHERE e.event_kind = 'backblast'
        AND e.is_deleted = false
        AND c.is_enabled = true
        AND e.event_date IS NOT NULL
        AND e.event_date >= ${from} AND e.event_date <= ${to}
        AND e.ao_display_name IS NOT NULL
        AND lower(regexp_replace(e.ao_display_name, '[^a-zA-Z0-9]+', '-', 'g')) = ${aoSlug}
      ORDER BY e.event_date DESC
    `) as Array<{ event_date: string; ao_name: string; content_text: string | null }>;
    const rows = events.map((e) => {
      const p = parseAttendance(e.content_text ?? "");
      return [e.event_date, e.ao_name, p.headcount ?? "", p.fngTokens.size, p.pax.size];
    });
    return csvResponse(
      toCsv(["event_date", "ao_name", "headcount", "fng_count", "pax_count"], rows),
      filename("ao", aoSlug),
    );
  }

  if (scope === "pax") {
    if (!paxSlug) {
      return NextResponse.json({ error: "Missing pax slug" }, { status: 400 });
    }
    const stats = await getPaxStats(range, paxSlug);
    if (!stats) return NextResponse.json({ error: "PAX not found" }, { status: 404 });
    const rows = stats.qdWorkouts.map((w) => [
      w.eventDate,
      w.aoName,
      "yes",
      w.headcount ?? "",
    ]);
    return csvResponse(
      toCsv(["event_date", "ao_name", "was_q", "headcount"], rows),
      filename("pax", paxSlug),
    );
  }

  if (scope === "raw") {
    const year = new Date().getUTCFullYear();
    const fact = await getAttendanceFact({
      from: new Date(`${year}-01-01T00:00:00Z`),
      to: new Date(),
    });
    const rows = fact.map((f) => [
      f.eventDate,
      f.aoName,
      f.aoSlug,
      f.paxToken,
      f.isQ ? "yes" : "no",
      f.headcount ?? "",
      f.fngCount,
    ]);
    return csvResponse(
      toCsv(
        ["event_date", "ao_name", "ao_slug", "pax_token", "is_q", "headcount", "fng_count"],
        rows,
      ),
      filename("raw", "ytd"),
    );
  }

  return NextResponse.json({ error: "Unknown scope" }, { status: 400 });
}
