"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import type { BeatdownRow } from "@/lib/stats/getBeatdownsList";

type SortKey = "date" | "ao" | "headcount" | "pax" | "fng";
type SortDir = "asc" | "desc";

type Props = {
  data: BeatdownRow[];
  /** number of rows per page; defaults to 25. Total rows visible to power users. */
  pageSize?: number;
};

function joinQs(qs: string[]): string {
  if (qs.length === 0) return "—";
  if (qs.length <= 2) return qs.join(", ");
  return `${qs.slice(0, 2).join(", ")} +${qs.length - 2}`;
}

export function BeatdownsTable({ data, pageSize = 25 }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const lower = search.trim().toLowerCase();
    if (!lower) return data;
    return data.filter((r) => {
      return (
        r.aoName.toLowerCase().includes(lower) ||
        (r.beatdownTitle ?? "").toLowerCase().includes(lower) ||
        r.qNames.some((q) => q.toLowerCase().includes(lower))
      );
    });
  }, [data, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortKey) {
        case "ao":
          av = a.aoName.toLowerCase();
          bv = b.aoName.toLowerCase();
          break;
        case "headcount":
          av = a.headcount ?? -1;
          bv = b.headcount ?? -1;
          break;
        case "pax":
          av = a.paxCount;
          bv = b.paxCount;
          break;
        case "fng":
          av = a.fngCount;
          bv = b.fngCount;
          break;
        case "date":
        default:
          av = a.eventDate;
          bv = b.eventDate;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const slice = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "date" || key === "ao" ? "asc" : "desc");
      if (key === "date") setSortDir("desc");
    }
    setPage(0);
  }

  function arrowFor(key: SortKey): string {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  return (
    <ClipFrame padding="p-6" className="min-h-[180px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <MonoTag>// beatdowns · {sorted.length}</MonoTag>
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="search AO, beatdown, Q…"
          className="border border-black/20 px-2 py-1 font-mono text-[11px] w-56"
          aria-label="Search backblasts"
        />
      </div>
      {sorted.length === 0 ? (
        <p className="font-mono text-xs text-muted mt-3">
          // no beatdowns match your filters
        </p>
      ) : (
        <>
          <div className="overflow-x-auto mt-4">
            <table
              className="w-full font-mono text-[11px] border-collapse"
              aria-label="Beatdowns in range"
            >
              <thead>
                <tr className="text-left tracking-[.15em] uppercase text-muted border-b border-line-soft">
                  <th className="pb-2 pr-3 font-normal w-24">
                    <SortHeader
                      label="date"
                      onClick={() => toggleSort("date")}
                      arrow={arrowFor("date")}
                    />
                  </th>
                  <th className="pb-2 pr-3 font-normal w-32">
                    <SortHeader
                      label="AO"
                      onClick={() => toggleSort("ao")}
                      arrow={arrowFor("ao")}
                    />
                  </th>
                  <th className="pb-2 pr-3 font-normal">beatdown</th>
                  <th className="pb-2 pr-3 font-normal w-32">Q</th>
                  <th className="pb-2 pr-3 font-normal text-right w-14">
                    <SortHeader
                      label="HC"
                      onClick={() => toggleSort("headcount")}
                      arrow={arrowFor("headcount")}
                    />
                  </th>
                  <th className="pb-2 pr-3 font-normal text-right w-14">
                    <SortHeader
                      label="PAX"
                      onClick={() => toggleSort("pax")}
                      arrow={arrowFor("pax")}
                    />
                  </th>
                  <th className="pb-2 font-normal text-right w-14">
                    <SortHeader
                      label="FNG"
                      onClick={() => toggleSort("fng")}
                      arrow={arrowFor("fng")}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {slice.map((row) => (
                  <tr
                    key={row.eventId}
                    className="border-b border-line-soft last:border-b-0 hover:bg-black/[.04] group"
                  >
                    <td className="py-2 pr-3 text-muted">{row.eventDate}</td>
                    <td className="py-2 pr-3 truncate text-muted">{row.aoName}</td>
                    <td className="py-2 pr-3">
                      <Link
                        href={`/backblasts/${row.eventId}`}
                        prefetch={false}
                        className="text-ink group-hover:underline underline-offset-4"
                      >
                        {row.beatdownTitle ?? "—"}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 truncate text-muted">{joinQs(row.qNames)}</td>
                    <td className="py-2 pr-3 text-right text-muted tabular-nums">
                      {row.headcount ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-right text-muted tabular-nums">
                      {row.paxCount || "—"}
                    </td>
                    <td className="py-2 text-right text-muted tabular-nums">
                      {row.fngCount || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 mt-4 font-mono text-[11px]">
              <span className="text-muted">
                page {safePage + 1} / {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="px-3 py-1.5 border border-black/20 hover:bg-black/5 disabled:opacity-40"
                >
                  ← prev
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  className="px-3 py-1.5 border border-black/20 hover:bg-black/5 disabled:opacity-40"
                >
                  next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </ClipFrame>
  );
}

function SortHeader({
  label,
  onClick,
  arrow,
}: {
  label: string;
  onClick: () => void;
  arrow: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-muted hover:text-ink tracking-[.15em] uppercase"
    >
      {label}
      <span className="text-[9px]" aria-hidden>
        {arrow}
      </span>
    </button>
  );
}
