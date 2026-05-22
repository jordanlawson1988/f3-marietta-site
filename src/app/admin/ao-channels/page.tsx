"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Toast } from "../Toast";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { ChamferButton } from "@/components/ui/brand/ChamferButton";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { StatusChip } from "@/components/ui/brand/StatusChip";

type AoChannel = {
  id: string;
  slack_channel_id: string;
  slack_channel_name: string | null;
  ao_display_name: string;
  is_enabled: boolean;
  created_at: string;
};

export default function AoChannelsAdminPage() {
  const [channels, setChannels] = useState<AoChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<AoChannel | null>(null);
  const [formChannelId, setFormChannelId] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formChannelName, setFormChannelName] = useState("");
  const [formIsEnabled, setFormIsEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ processed: number; errors: number; channels: number; notInChannel: string[] } | null>(null);

  const fetchChannels = async () => {
    try {
      const res = await fetch("/api/admin/ao-channels", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels);
      } else {
        setError("Failed to fetch AO channels");
      }
    } catch {
      setError("Failed to fetch AO channels");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const openCreateModal = () => {
    setEditingChannel(null);
    setFormChannelId("");
    setFormDisplayName("");
    setFormChannelName("");
    setFormIsEnabled(true);
    setShowModal(true);
  };

  const openEditModal = (channel: AoChannel) => {
    setEditingChannel(channel);
    setFormChannelId(channel.slack_channel_id);
    setFormDisplayName(channel.ao_display_name);
    setFormChannelName(channel.slack_channel_name ?? "");
    setFormIsEnabled(channel.is_enabled);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formDisplayName) return;
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const url = editingChannel
        ? `/api/admin/ao-channels/${editingChannel.id}`
        : "/api/admin/ao-channels";
      const method = editingChannel ? "PUT" : "POST";

      const body = editingChannel
        ? {
            ao_display_name: formDisplayName,
            slack_channel_name: formChannelName || null,
            is_enabled: formIsEnabled,
          }
        : {
            slack_channel_id: formChannelId,
            ao_display_name: formDisplayName,
            slack_channel_name: formChannelName || null,
            is_enabled: formIsEnabled,
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        const baseMsg = editingChannel ? "Channel updated." : "Channel registered.";
        const parts = [baseMsg];
        if (data.warning) parts.push(`Warning: ${data.warning}`);
        if (data.botStatus?.warning) parts.push(data.botStatus.warning);
        else if (data.botStatus?.backfilled > 0) parts.push(`Bot joined — backfilled ${data.botStatus.backfilled} post(s).`);
        else if (data.botStatus?.inChannel) parts.push("Bot is in the channel.");
        setMessage(parts.join(" "));
        setShowModal(false);
        fetchChannels();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Error saving channel");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (channel: AoChannel) => {
    if (
      !window.confirm(
        `Delete "${channel.ao_display_name}"?\n\nEvents already in f3_events keep their ao_display_name. Consider disabling instead of deleting.`
      )
    )
      return;

    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/admin/ao-channels/${channel.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok) {
        setMessage("Channel deleted.");
        setShowModal(false);
        fetchChannels();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete");
      }
    } catch {
      setError("Error deleting channel");
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/ao-channels/sync", {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setSyncResult({ processed: data.processed, errors: data.errors, channels: data.channels, notInChannel: data.notInChannel ?? [] });
        fetchChannels();
      } else {
        const data = await res.json();
        setError(data.error || "Sync failed");
      }
    } catch {
      setError("Sync error");
    } finally {
      setIsSyncing(false);
    }
  };

  const inputClass =
    "mt-2 w-full bg-transparent border border-bone/25 px-3 py-2 focus:outline-none focus:border-steel text-bone text-sm";

  return (
    <div className="p-6">
      {/* Page Header */}
      <SectionHead eyebrow="§ Admin · AO Channels" h2="AO Channel Manager" align="left" />

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <ChamferButton
            variant="ghost"
            size="md"
            arrow={false}
            onClick={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? "Syncing..." : "Sync from Slack"}
          </ChamferButton>
          {syncResult && (
            <span className="font-mono text-xs text-muted">
              // {syncResult.processed} processed · {syncResult.errors} errors · {syncResult.channels} channels
              {syncResult.notInChannel.length > 0 && (
                <span className="text-rust"> · ⚠ bot not in: {syncResult.notInChannel.join(", ")}</span>
              )}
            </span>
          )}
        </div>
        <ChamferButton variant="ink" size="md" arrow={false} onClick={openCreateModal}>
          New Channel
        </ChamferButton>
      </div>

      {/* Sync explainer */}
      <p className="font-mono text-[11px] text-muted mb-6">
        // Sync pulls last-100 messages per enabled channel and upserts any backblasts/preblasts missed by the webhook.
      </p>

      {/* Table */}
      {isLoading ? (
        <div className="text-muted">Loading...</div>
      ) : (
        <div className="border border-line-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-soft text-left">
                <th className="px-4 py-3">
                  <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">
                    Display Name
                  </span>
                </th>
                <th className="px-4 py-3">
                  <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">
                    Channel Name
                  </span>
                </th>
                <th className="px-4 py-3">
                  <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">
                    Channel ID
                  </span>
                </th>
                <th className="px-4 py-3 text-center">
                  <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">
                    Status
                  </span>
                </th>
                <th className="px-4 py-3">
                  <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">
                    Created
                  </span>
                </th>
                <th className="px-4 py-3 text-right">
                  <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">
                    Actions
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {channels.map((channel) => (
                <tr
                  key={channel.id}
                  className="relative group border-b border-line-soft last:border-0 hover:bg-ink/30 transition-colors"
                >
                  {/* Left accent */}
                  <td className="px-4 py-3 font-medium text-ink relative">
                    <span
                      aria-hidden
                      className="absolute left-0 top-0 bottom-0 w-[3px] bg-steel scale-y-0 origin-top group-hover:scale-y-100 transition-transform duration-300"
                    />
                    {channel.ao_display_name}
                  </td>
                  <td className="px-4 py-3 text-muted text-sm">
                    {channel.slack_channel_name ?? <span className="text-muted/40">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {channel.slack_channel_id}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusChip variant={channel.is_enabled ? "active" : "archived"}>
                      {channel.is_enabled ? "Enabled" : "Disabled"}
                    </StatusChip>
                  </td>
                  <td className="px-4 py-3 text-muted text-xs font-mono">
                    {new Date(channel.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChamferButton
                      variant="ghost"
                      size="sm"
                      arrow={false}
                      onClick={() => openEditModal(channel)}
                    >
                      Edit
                    </ChamferButton>
                  </td>
                </tr>
              ))}
              {channels.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    No AO channels yet. Add one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Toast notifications */}
      {message && <Toast message={message} type="success" onDismiss={() => setMessage("")} />}
      {error && <Toast message={error} type="error" onDismiss={() => setError("")} duration={5000} />}

      {/* Edit / Create Drawer */}
      {showModal && (
        <div className="fixed inset-0 bg-ink/80 backdrop-blur-sm z-50">
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-ink text-bone border-l border-steel/30 clip-chamfer overflow-auto p-8">
            {/* Header */}
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-bone/15">
              <h3 className="font-display font-bold uppercase tracking-wide text-lg">
                {editingChannel ? "Edit AO Channel" : "Add AO Channel"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted hover:text-bone transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-5">
              {/* Channel ID — immutable on edit */}
              <div>
                <MonoTag variant="bone">
                  // Slack Channel ID{" "}
                  {editingChannel && (
                    <span className="font-normal normal-case text-muted/60">(immutable)</span>
                  )}
                </MonoTag>
                <input
                  type="text"
                  value={formChannelId}
                  onChange={(e) => !editingChannel && setFormChannelId(e.target.value)}
                  disabled={!!editingChannel}
                  className={`${inputClass} font-mono${editingChannel ? " text-muted cursor-not-allowed opacity-60" : ""}`}
                  placeholder="e.g. C0A4LQHJUDD"
                />
              </div>

              {/* Display Name */}
              <div>
                <MonoTag variant="bone">// Display Name</MonoTag>
                <input
                  type="text"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Kenmo"
                />
              </div>

              {/* Channel Name */}
              <div>
                <MonoTag variant="bone">// Slack Channel Name <span className="font-normal normal-case text-muted/60">(optional)</span></MonoTag>
                <input
                  type="text"
                  value={formChannelName}
                  onChange={(e) => setFormChannelName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. #ao_kenmo"
                />
              </div>

              {/* Enabled toggle */}
              <div className="flex flex-col gap-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setFormIsEnabled(!formIsEnabled)}
                    className={`w-10 h-[22px] rounded-full relative transition-colors cursor-pointer ${
                      formIsEnabled ? "bg-steel" : "bg-bone/20"
                    }`}
                  >
                    <div
                      className={`w-[18px] h-[18px] bg-bone rounded-full absolute top-[2px] transition-all ${
                        formIsEnabled ? "right-[2px]" : "left-[2px]"
                      }`}
                    />
                  </div>
                  <span className="text-sm text-bone">Enabled</span>
                  <span className="text-xs text-muted">
                    — disabled channels stop ingestion without losing their mapping
                  </span>
                </label>
              </div>

              {/* Bot invite reminder */}
              <p className="text-xs text-muted border-l-2 border-steel/40 pl-3 py-1">
                The bot auto-joins public channels on save and backfills recent posts. Private or
                archived channels still need a manual <span className="font-mono">/invite @f3_marietta_backblast</span>.
              </p>

              {error && <p className="text-rust text-sm">{error}</p>}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-bone/15">
              {editingChannel ? (
                <ChamferButton
                  type="button"
                  variant="ink"
                  size="sm"
                  arrow={false}
                  className="!bg-rust !border-rust hover:!bg-ink hover:!border-ink"
                  onClick={() => handleDelete(editingChannel)}
                >
                  Delete
                </ChamferButton>
              ) : (
                <div />
              )}
              <div className="flex gap-3">
                <ChamferButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  arrow={false}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </ChamferButton>
                <ChamferButton
                  type="button"
                  variant="steel"
                  size="sm"
                  arrow={false}
                  onClick={handleSave}
                  disabled={!formDisplayName || (!editingChannel && !formChannelId) || isSaving}
                >
                  {isSaving ? "Saving..." : editingChannel ? "Save Changes" : "Register"}
                </ChamferButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
