"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useTransition } from "react";

export function BackblastSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentSearch = searchParams.get("search") ?? "";

  function handleChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("page");
      if (value.trim()) {
        params.set("search", value.trim());
      } else {
        params.delete("search");
      }
      const qs = params.toString();
      startTransition(() => {
        router.push(`/backblasts${qs ? `?${qs}` : ""}`);
      });
    }, 350);
  }

  return (
    <div className="relative">
      <svg
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        placeholder="Search Q, AO, or content..."
        defaultValue={currentSearch}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full pl-9 pr-10 py-3 border border-line-soft bg-transparent font-mono text-[13px] tracking-[.05em] uppercase focus:outline-none focus:border-ink"
      />
      {isPending && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 border-2 border-ink border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
