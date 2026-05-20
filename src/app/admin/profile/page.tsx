"use client";

import { useState, useEffect } from "react";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { ChamferButton } from "@/components/ui/brand/ChamferButton";
import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { Toast } from "../Toast";
import { MEMBER_STATUS_LABELS, type MemberStatus } from "@/lib/constants/memberStatus";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MemberProfile {
  user_id: string;
  status: MemberStatus;
  f3_name: string | null;
  real_name: string | null;
  f3nation_url: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MeResponse {
  state: MemberStatus;
  email: string;
  profile: MemberProfile | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "mt-1 w-full bg-transparent border border-line-soft px-3 py-2 focus:outline-none focus:border-steel text-ink text-sm transition-colors";

const readOnlyClass =
  "mt-1 w-full bg-bone/50 border border-line-soft px-3 py-2 text-muted text-sm cursor-not-allowed";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminProfilePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [saveError, setSaveError] = useState("");

  // Loaded from API
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<MemberStatus | "">("");

  // Editable fields
  const [f3Name, setF3Name] = useState("");
  const [realName, setRealName] = useState("");
  const [f3NationUrl, setF3NationUrl] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/admin/me");
        if (!res.ok) {
          if (!cancelled) setFetchError("Failed to load profile.");
          return;
        }
        const data = (await res.json()) as MeResponse;
        if (!cancelled) {
          setEmail(data.email ?? "");
          setStatus(data.state ?? "");
          if (data.profile) {
            setF3Name(data.profile.f3_name ?? "");
            setRealName(data.profile.real_name ?? "");
            setF3NationUrl(data.profile.f3nation_url ?? "");
          }
        }
      } catch {
        if (!cancelled) setFetchError("Network error — could not load profile.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError("");

    try {
      const res = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          f3_name: f3Name,
          real_name: realName,
          f3nation_url: f3NationUrl,
        }),
      });

      const data = (await res.json()) as { profile?: MemberProfile; error?: string };

      if (!res.ok) {
        const msg = data.error ?? "Save failed.";
        setSaveError(msg);
        return;
      }

      // Reflect any normalisation returned by the server
      if (data.profile) {
        setF3Name(data.profile.f3_name ?? "");
        setRealName(data.profile.real_name ?? "");
        setF3NationUrl(data.profile.f3nation_url ?? "");
      }

      setToastMessage("Profile saved.");
      setToastType("success");
    } catch {
      setSaveError("Network error — changes not saved.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-[640px]">
      <SectionHead
        eyebrow="§ Admin · Profile"
        h2="My Profile"
        kicker="Update your F3 name and public profile details."
        align="left"
      />

      {isLoading ? (
        <div className="text-muted font-mono text-xs">// loading…</div>
      ) : fetchError ? (
        <div className="text-rust font-mono text-xs">{fetchError}</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Account info (read-only) */}
          <ClipFrame padding="p-5">
            <MonoTag variant="steel" className="mb-4 block">
              // Account
            </MonoTag>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-0.5">
                  Email
                </label>
                <div className={readOnlyClass}>{email}</div>
                <p className="mt-1 font-mono text-[11px] text-muted">
                  // Email cannot be changed here
                </p>
              </div>
              {status && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-0.5">
                    Status
                  </label>
                  <div className={readOnlyClass}>
                    {MEMBER_STATUS_LABELS[status]}
                  </div>
                </div>
              )}
            </div>
          </ClipFrame>

          {/* Editable profile fields */}
          <ClipFrame padding="p-5">
            <MonoTag variant="steel" className="mb-4 block">
              // F3 Identity
            </MonoTag>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="profile-f3name"
                  className="block text-xs font-bold uppercase tracking-wider text-muted mb-0.5"
                >
                  F3 Name
                </label>
                <input
                  id="profile-f3name"
                  type="text"
                  value={f3Name}
                  onChange={(e) => setF3Name(e.target.value)}
                  className={inputClass}
                  placeholder="Your F3 handle"
                />
                <p className="mt-1 font-mono text-[11px] text-muted">
                  // The name PAX know you by
                </p>
              </div>

              <div>
                <label
                  htmlFor="profile-realname"
                  className="block text-xs font-bold uppercase tracking-wider text-muted mb-0.5"
                >
                  Real Name
                </label>
                <input
                  id="profile-realname"
                  type="text"
                  value={realName}
                  onChange={(e) => setRealName(e.target.value)}
                  className={inputClass}
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-f3nation"
                  className="block text-xs font-bold uppercase tracking-wider text-muted mb-0.5"
                >
                  F3 Nation URL
                </label>
                <input
                  id="profile-f3nation"
                  type="url"
                  value={f3NationUrl}
                  onChange={(e) => setF3NationUrl(e.target.value)}
                  className={inputClass}
                  placeholder="https://me.f3nation.com/..."
                />
                <p className="mt-1 font-mono text-[11px] text-muted">
                  // Optional — must be an f3nation.com URL if provided
                </p>
              </div>
            </div>
          </ClipFrame>

          {/* Save error (e.g. bad f3nation URL) */}
          {saveError && (
            <div className="px-4 py-3 border border-rust bg-rust/10 text-rust font-mono text-xs tracking-wide">
              {saveError}
            </div>
          )}

          <div className="flex justify-end">
            <ChamferButton
              type="submit"
              variant="steel"
              size="md"
              arrow={false}
              disabled={isSaving}
            >
              {isSaving ? "Saving…" : "Save Profile"}
            </ChamferButton>
          </div>
        </form>
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
