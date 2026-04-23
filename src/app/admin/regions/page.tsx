"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Toast } from "../Toast";
import type { Region } from "@/types/region";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { ChamferButton } from "@/components/ui/brand/ChamferButton";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { StatusChip } from "@/components/ui/brand/StatusChip";

export default function RegionsAdminPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formIsPrimary, setFormIsPrimary] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchRegions = async () => {
    try {
      const res = await fetch("/api/admin/regions", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setRegions(data.regions);
      }
    } catch {
      setError("Failed to fetch regions");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRegions();
  }, []);

  const openCreateModal = () => {
    setEditingRegion(null);
    setFormName("");
    setFormSlug("");
    setFormSortOrder(regions.length + 1);
    setFormIsPrimary(false);
    setFormIsActive(true);
    setShowModal(true);
  };

  const openEditModal = (region: Region) => {
    setEditingRegion(region);
    setFormName(region.name);
    setFormSlug(region.slug);
    setFormSortOrder(region.sort_order);
    setFormIsPrimary(region.is_primary);
    setFormIsActive(region.is_active);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName) return;
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const url = editingRegion
        ? `/api/admin/regions/${editingRegion.id}`
        : "/api/admin/regions";

      const method = editingRegion ? "PUT" : "POST";

      const body = editingRegion
        ? { name: formName, sort_order: formSortOrder, is_primary: formIsPrimary, is_active: formIsActive }
        : { name: formName, slug: formSlug || undefined, sort_order: formSortOrder, is_primary: formIsPrimary, is_active: formIsActive };

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setMessage(editingRegion ? "Region updated." : "Region created.");
        setShowModal(false);
        fetchRegions();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Error saving region");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (region: Region) => {
    if (!window.confirm(`Delete region "${region.name}"? This cannot be undone.`)) return;

    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/admin/regions/${region.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok) {
        setMessage("Region deleted.");
        setShowModal(false);
        fetchRegions();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete");
      }
    } catch {
      setError("Error deleting region");
    }
  };

  // Auto-generate slug from name (only for new regions)
  const handleNameChange = (name: string) => {
    setFormName(name);
    if (!editingRegion) {
      setFormSlug(
        name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
      );
    }
  };

  const inputClass =
    "mt-2 w-full bg-transparent border border-bone/25 px-3 py-2 focus:outline-none focus:border-steel text-bone text-sm";

  return (
    <div className="p-6">
      {/* Page Header */}
      <SectionHead eyebrow="§ Admin · Regions" h2="Region Manager" align="left" />

      {/* Toolbar */}
      <div className="flex items-center justify-end mb-4">
        <ChamferButton variant="ink" size="md" arrow={false} onClick={openCreateModal}>
          New Region
        </ChamferButton>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-muted">Loading...</div>
      ) : (
        <div className="border border-line-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-soft text-left">
                <th className="px-4 py-3">
                  <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">Name</span>
                </th>
                <th className="px-4 py-3">
                  <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">Slug</span>
                </th>
                <th className="px-4 py-3 text-center">
                  <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">Order</span>
                </th>
                <th className="px-4 py-3 text-center">
                  <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">Primary</span>
                </th>
                <th className="px-4 py-3 text-center">
                  <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">Status</span>
                </th>
                <th className="px-4 py-3 text-right">
                  <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {regions.map((region) => (
                <tr
                  key={region.id}
                  className="relative group border-b border-line-soft last:border-0 hover:bg-ink/30 transition-colors"
                >
                  {/* Left accent */}
                  <td className="px-4 py-3 font-medium text-bone relative">
                    <span
                      aria-hidden
                      className="absolute left-0 top-0 bottom-0 w-[3px] bg-steel scale-y-0 origin-top group-hover:scale-y-100 transition-transform duration-300"
                    />
                    {region.name}
                  </td>
                  <td className="px-4 py-3 text-muted font-mono text-xs">{region.slug}</td>
                  <td className="px-4 py-3 text-muted text-center">{region.sort_order}</td>
                  <td className="px-4 py-3 text-center">
                    {region.is_primary ? (
                      <StatusChip variant="active">Primary</StatusChip>
                    ) : (
                      <span className="text-muted/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusChip variant={region.is_active ? "active" : "archived"}>
                      {region.is_active ? "Active" : "Archived"}
                    </StatusChip>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChamferButton
                      variant="ghost"
                      size="sm"
                      arrow={false}
                      onClick={() => openEditModal(region)}
                    >
                      Edit
                    </ChamferButton>
                  </td>
                </tr>
              ))}
              {regions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    No regions yet. Add one to get started.
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
                {editingRegion ? "Edit Region" : "Add Region"}
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
              {/* Name */}
              <div>
                <MonoTag variant="bone">// Name</MonoTag>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Marietta"
                />
              </div>

              {/* Slug */}
              <div>
                <MonoTag variant="bone">
                  // Slug{" "}
                  {editingRegion && (
                    <span className="font-normal normal-case text-muted/60">(immutable)</span>
                  )}
                </MonoTag>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => !editingRegion && setFormSlug(e.target.value)}
                  disabled={!!editingRegion}
                  className={cn(
                    inputClass,
                    "font-mono",
                    editingRegion ? "text-muted cursor-not-allowed opacity-60" : ""
                  )}
                />
              </div>

              {/* Sort Order */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <MonoTag variant="bone">// Sort Order</MonoTag>
                  <input
                    type="number"
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setFormIsPrimary(!formIsPrimary)}
                    className={`w-10 h-[22px] rounded-full relative transition-colors cursor-pointer ${
                      formIsPrimary ? "bg-steel" : "bg-bone/20"
                    }`}
                  >
                    <div
                      className={`w-[18px] h-[18px] bg-bone rounded-full absolute top-[2px] transition-all ${
                        formIsPrimary ? "right-[2px]" : "left-[2px]"
                      }`}
                    />
                  </div>
                  <span className="text-sm text-bone">Primary region</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setFormIsActive(!formIsActive)}
                    className={`w-10 h-[22px] rounded-full relative transition-colors cursor-pointer ${
                      formIsActive ? "bg-steel" : "bg-bone/20"
                    }`}
                  >
                    <div
                      className={`w-[18px] h-[18px] bg-bone rounded-full absolute top-[2px] transition-all ${
                        formIsActive ? "right-[2px]" : "left-[2px]"
                      }`}
                    />
                  </div>
                  <span className="text-sm text-bone">Active</span>
                  <span className="text-xs text-muted">— inactive regions are hidden from schedules</span>
                </label>
              </div>

              {error && <p className="text-rust text-sm">{error}</p>}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-bone/15">
              {editingRegion ? (
                <ChamferButton
                  type="button"
                  variant="ink"
                  size="sm"
                  arrow={false}
                  className="!bg-rust !border-rust hover:!bg-ink hover:!border-ink"
                  onClick={() => handleDelete(editingRegion)}
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
                  disabled={!formName || isSaving}
                >
                  {isSaving ? "Saving..." : editingRegion ? "Save Changes" : "Create"}
                </ChamferButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
