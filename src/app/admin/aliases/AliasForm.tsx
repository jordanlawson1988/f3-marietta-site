"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";

export function AliasForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [slackId, setSlackId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/aliases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slack_id: slackId, display_name: displayName, notes: notes || null }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to save");
      return;
    }
    setSlackId("");
    setDisplayName("");
    setNotes("");
    startTransition(() => router.refresh());
  }

  return (
    <ClipFrame padding="p-6">
      <MonoTag>// add alias</MonoTag>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-4 font-mono text-xs">
        <input
          aria-label="Slack ID"
          placeholder="U01ABCDEF"
          value={slackId}
          onChange={(e) => setSlackId(e.target.value)}
          className="md:col-span-3 border border-black/20 px-3 py-2"
          required
        />
        <input
          aria-label="Display name"
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="md:col-span-4 border border-black/20 px-3 py-2"
          required
        />
        <input
          aria-label="Notes (optional)"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="md:col-span-3 border border-black/20 px-3 py-2"
        />
        <button
          type="submit"
          disabled={pending}
          className="md:col-span-2 bg-foreground text-background px-4 py-2 disabled:opacity-50"
        >
          {pending ? "saving…" : "add"}
        </button>
      </form>
      {error && <p className="text-red-600 mt-2 font-mono text-xs">// {error}</p>}
    </ClipFrame>
  );
}

export function DeleteButton({ slackId }: { slackId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function handleDelete() {
    if (!confirm(`Delete alias for ${slackId}?`)) return;
    const res = await fetch(`/api/admin/aliases/${slackId}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Failed to delete");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className="text-red-600 hover:underline disabled:opacity-50"
    >
      {pending ? "…" : "delete"}
    </button>
  );
}
