"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useTransition } from "react";
import Link from "next/link";

interface BackblastFiltersProps {
  aoList: string[];
  aoFilter: string;
  searchQuery: string;
}

export function BackblastFilters({ aoList, aoFilter, searchQuery }: BackblastFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buildUrl(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());

    // Always reset to page 1 on filter change
    params.delete("page");

    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    const qs = params.toString();
    return `/backblasts${qs ? `?${qs}` : ""}`;
  }

  function handleSearchChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      startTransition(() => {
        router.push(buildUrl({ q: value }));
      });
    }, 300);
  }

  function handleAOChange(value: string) {
    startTransition(() => {
      router.push(buildUrl({ ao: value }));
    });
  }

  const hasFilters = aoFilter || searchQuery;

  return (
    <div className="flex gap-3 flex-wrap items-center">
      <select
        defaultValue={aoFilter}
        onChange={(e) => handleAOChange(e.target.value)}
        className="bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-primary min-w-[140px]"
      >
        <option value="">All AOs</option>
        {aoList.map((ao) => (
          <option key={ao} value={ao}>
            {ao}
          </option>
        ))}
      </select>

      <div className="relative">
        <input
          type="text"
          placeholder="Search Q, AO, or content..."
          defaultValue={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary w-[260px]"
        />
        {isPending && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {hasFilters && (
        <Link
          href="/backblasts"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
        >
          Clear filters
        </Link>
      )}
    </div>
  );
}
