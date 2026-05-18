import { SectionHead } from "@/components/ui/brand/SectionHead";
import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { getSql } from "@/lib/db";
import { AliasForm, DeleteButton } from "./AliasForm";

export const dynamic = "force-dynamic";

type AliasRow = {
  slack_id: string;
  display_name: string;
  notes: string | null;
  created_at: string;
};

async function loadAliases(): Promise<AliasRow[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT slack_id, display_name, notes, created_at
    FROM pax_alias_map
    ORDER BY display_name
  `;
  return rows as AliasRow[];
}

export default async function AdminAliasesPage() {
  const rows = await loadAliases();
  return (
    <section className="max-w-[960px] mx-auto px-7 py-16">
      <SectionHead
        eyebrow="§ Admin · Aliases"
        h2="PAX Alias Map"
        kicker={
          <>
            Map Slack IDs that aren&rsquo;t in <code>slack_users</code> to
            display names. Read by{" "}
            <code>resolvePaxIdentity</code> after slack_users lookup fails.
          </>
        }
        align="left"
      />

      <div className="mt-10 mb-8">
        <AliasForm />
      </div>

      <ClipFrame padding="p-6">
        <MonoTag>// existing aliases · {rows.length} row{rows.length === 1 ? "" : "s"}</MonoTag>
        {rows.length === 0 ? (
          <p className="font-mono text-xs text-muted mt-3">// none yet</p>
        ) : (
          <ul className="font-mono text-xs mt-4 space-y-2">
            {rows.map((r) => (
              <li key={r.slack_id} className="flex items-baseline gap-3 border-b border-black/10 pb-2">
                <span className="text-muted">{r.slack_id}</span>
                <span className="flex-1 text-foreground">{r.display_name}</span>
                {r.notes && <span className="text-muted">// {r.notes}</span>}
                <DeleteButton slackId={r.slack_id} />
              </li>
            ))}
          </ul>
        )}
      </ClipFrame>
    </section>
  );
}
