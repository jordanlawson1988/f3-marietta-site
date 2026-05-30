"use client";

import { useState, useEffect, useCallback } from "react";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { ChamferButton } from "@/components/ui/brand/ChamferButton";
import { Toast } from "../Toast";
import {
  MEMBER_STATUSES,
  MEMBER_STATUS_LABELS,
  type MemberStatus,
} from "@/lib/constants/memberStatus";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamMember {
  user_id: string;
  status: MemberStatus;
  f3_name: string | null;
  real_name: string | null;
  f3nation_url: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  email: string;
  name: string | null;
  account_created: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

// Action label per current status
const ACTION_LABEL: Record<MemberStatus, string> = {
  pending: "Approve",
  admin: "Revoke",
  revoked: "Re-instate",
};

// Target status after the action
const ACTION_TARGET: Record<MemberStatus, MemberStatus> = {
  pending: "admin",
  admin: "revoked",
  revoked: "admin",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminTeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [actionError, setActionError] = useState("");
  // Track which userId is in-flight
  const [pendingId, setPendingId] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    setFetchError("");
    try {
      const res = await fetch("/api/admin/team");
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setFetchError(data.error ?? "Failed to load team.");
        return;
      }
      const data = (await res.json()) as { members: TeamMember[] };
      setMembers(data.members);
    } catch {
      setFetchError("Network error — could not load team.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const handleAction = async (member: TeamMember) => {
    const targetStatus = ACTION_TARGET[member.status];
    setPendingId(member.user_id);
    setActionError("");

    try {
      const res = await fetch(`/api/admin/team/${member.user_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        const msg = data.error ?? "Action failed.";
        if (res.status === 409) {
          // Last-admin guard — surface clearly
          setActionError(msg);
        } else {
          setToastMessage(msg);
          setToastType("error");
        }
        return;
      }

      setToastMessage(
        `${member.email} — status updated to ${MEMBER_STATUS_LABELS[targetStatus]}.`
      );
      setToastType("success");
      await fetchTeam();
    } catch {
      setToastMessage("Network error — action failed.");
      setToastType("error");
    } finally {
      setPendingId(null);
    }
  };

  // Group members by status in the prescribed display order
  const groups: Record<MemberStatus, TeamMember[]> = {
    pending: [],
    admin: [],
    revoked: [],
  };
  for (const m of members) {
    if (m.status in groups) {
      groups[m.status].push(m);
    }
  }

  return (
    <div className="p-6">
      <SectionHead
        eyebrow="§ Admin · Team"
        h2="Team Members"
        kicker="Manage admin access for F3 Marietta ops members."
        align="left"
      />

      {/* Last-admin guard banner */}
      {actionError && (
        <div className="mb-6 px-5 py-3 border border-rust bg-rust/10 text-rust font-mono text-xs tracking-wide">
          {actionError}
          <button
            onClick={() => setActionError("")}
            className="ml-4 underline hover:no-underline opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="text-muted font-mono text-xs">// loading…</div>
      ) : fetchError ? (
        <div className="text-rust font-mono text-xs">{fetchError}</div>
      ) : (
        <div className="space-y-10">
          {MEMBER_STATUSES.map((status) => {
            const group = groups[status];
            return (
              <section key={status}>
                {/* Section heading */}
                <div className="flex items-center gap-4 mb-3 pb-2 border-b border-line-soft">
                  <MonoTag variant="steel">
                    // {MEMBER_STATUS_LABELS[status]}
                  </MonoTag>
                  <MonoTag variant="muted">{group.length}</MonoTag>
                </div>

                {group.length === 0 ? (
                  <p className="font-mono text-xs text-muted px-1">// None</p>
                ) : (
                  <div className="border border-line-soft overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="border-b border-line-soft text-left bg-bone/30">
                          <th className="px-4 py-2">
                            <MonoTag>Email</MonoTag>
                          </th>
                          <th className="px-4 py-2">
                            <MonoTag>F3 Name</MonoTag>
                          </th>
                          <th className="px-4 py-2">
                            <MonoTag>Account Name</MonoTag>
                          </th>
                          <th className="px-4 py-2">
                            <MonoTag>Joined</MonoTag>
                          </th>
                          <th className="px-4 py-2 text-right">
                            <MonoTag>Action</MonoTag>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.map((member) => (
                          <tr
                            key={member.user_id}
                            className="relative group border-b border-line-soft last:border-0 hover:bg-ink/5 transition-colors"
                          >
                            <td className="px-4 py-3 text-ink relative">
                              <span
                                aria-hidden
                                className="absolute left-0 top-0 bottom-0 w-[3px] bg-steel scale-y-0 origin-top group-hover:scale-y-100 transition-transform duration-300"
                              />
                              <span className="text-sm">{member.email}</span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted">
                              {member.f3_name ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted">
                              {member.name ?? "—"}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted">
                              {formatDate(member.account_created)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <ChamferButton
                                variant={
                                  status === "pending"
                                    ? "steel"
                                    : status === "admin"
                                    ? "ghost"
                                    : "ink"
                                }
                                size="sm"
                                arrow={false}
                                onClick={() => handleAction(member)}
                                disabled={pendingId === member.user_id}
                              >
                                {pendingId === member.user_id
                                  ? "Saving…"
                                  : ACTION_LABEL[status]}
                              </ChamferButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onDismiss={() => setToastMessage("")}
        />
      )}
    </div>
  );
}
