"use client";

import { useState } from "react";
import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";

type Recipient = {
  paxLabel: string;
  paxSlug: string;
  slackUserId: string;
  posts: number;
  aos: number;
  qd: number;
  url: string;
};

type PreviewResponse = {
  mode: "dry-run";
  window: { from: string; to: string; monthLabel: string };
  sample: {
    paxLabel: string;
    slackUserId: string;
    url: string;
    messagePreview: string;
  } | null;
  liveFlagSet: boolean;
  recipients: Recipient[];
  recipientCount: number;
};

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; data: PreviewResponse }
  | { kind: "error"; message: string };

export function MonthlyRecapPreview() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [expanded, setExpanded] = useState(false);

  async function runPreview() {
    setState({ kind: "loading" });
    setExpanded(false);
    try {
      const res = await fetch("/api/admin/monthly-pax-recap/preview", {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.text();
        setState({
          kind: "error",
          message: `Preview failed (${res.status}): ${body || "no body"}`,
        });
        return;
      }
      const data: PreviewResponse = await res.json();
      setState({ kind: "loaded", data });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <ClipFrame padding="p-6" className="min-h-[160px]">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <MonoTag>// monthly pax recap</MonoTag>
          <h3 className="font-display font-bold uppercase text-[18px] tracking-[-.005em] leading-tight mt-2 text-ink">
            Preview the next 1st-of-month Slack send
          </h3>
          <p className="font-mono text-[11px] text-muted mt-1 leading-relaxed">
            Runs the same logic the cron will run on the 1st — but never
            sends. Use it to sanity-check the recipient list and the
            message copy before flipping the live flag.
          </p>
        </div>
        <button
          type="button"
          onClick={runPreview}
          disabled={state.kind === "loading"}
          className="inline-flex items-center gap-2 bg-ink text-bone font-mono text-[11px] tracking-[.15em] uppercase px-4 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {state.kind === "loading" ? "Loading…" : "Preview recap"}
        </button>
      </div>

      {state.kind === "error" && (
        <p
          role="alert"
          className="mt-4 font-mono text-[11px] text-rose-700 leading-relaxed"
        >
          // {state.message}
        </p>
      )}

      {state.kind === "loaded" && (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat
              label="window"
              value={state.data.window.monthLabel}
              caption={`${state.data.window.from} → ${state.data.window.to}`}
            />
            <Stat label="recipients" value={String(state.data.recipientCount)} />
            <Stat
              label="mode"
              value="dry-run"
              caption="never sends"
            />
            <Stat
              label="prod live flag"
              value={state.data.liveFlagSet ? "armed" : "off"}
              caption={
                state.data.liveFlagSet
                  ? "MONTHLY_RECAP_LIVE=true"
                  : "set env to enable"
              }
            />
          </div>

          {state.data.sample && (
            <div>
              <MonoTag>// sample message — {state.data.sample.paxLabel}</MonoTag>
              <pre className="mt-2 p-4 bg-black/[.04] font-mono text-[11px] whitespace-pre-wrap leading-relaxed text-ink">
                {state.data.sample.messagePreview}
              </pre>
            </div>
          )}

          {state.data.recipients.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setExpanded((x) => !x)}
                className="font-mono text-[11px] tracking-[.15em] uppercase text-muted hover:text-ink underline underline-offset-4"
              >
                {expanded ? "hide" : "show"} all {state.data.recipientCount}{" "}
                recipients
              </button>
              {expanded && (
                <div className="overflow-x-auto mt-3">
                  <table
                    className="w-full font-mono text-[11px] border-collapse"
                    aria-label="Monthly recap recipients"
                  >
                    <thead>
                      <tr className="text-left tracking-[.15em] uppercase text-muted border-b border-line-soft">
                        <th className="pb-2 pr-3 font-normal w-8">#</th>
                        <th className="pb-2 pr-3 font-normal">PAX</th>
                        <th className="pb-2 pr-3 font-normal text-right">posts</th>
                        <th className="pb-2 pr-3 font-normal text-right">AOs</th>
                        <th className="pb-2 pr-3 font-normal text-right">Q'd</th>
                        <th className="pb-2 font-normal">link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.data.recipients.map((r, i) => (
                        <tr
                          key={r.slackUserId}
                          className="border-b border-line-soft last:border-b-0 hover:bg-black/[.03]"
                        >
                          <td className="py-1.5 pr-3 text-muted">{i + 1}</td>
                          <td className="py-1.5 pr-3 text-ink">
                            {r.paxLabel}
                            <span className="text-muted ml-2 text-[10px]">
                              {r.slackUserId}
                            </span>
                          </td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">
                            {r.posts}
                          </td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">
                            {r.aos}
                          </td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">
                            {r.qd}
                          </td>
                          <td className="py-1.5">
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-steel hover:text-ink underline underline-offset-4 break-all"
                            >
                              {r.url}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </ClipFrame>
  );
}

function Stat({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="border border-line-soft p-3">
      <MonoTag>// {label}</MonoTag>
      <p className="font-display font-bold text-[18px] leading-tight mt-1 text-ink">
        {value}
      </p>
      {caption && (
        <p className="font-mono text-[10px] text-muted mt-1">{caption}</p>
      )}
    </div>
  );
}
