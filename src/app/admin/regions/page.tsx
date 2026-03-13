"use client";

import { useState, useEffect } from "react";
import { useAdminAuth } from "../AdminAuthContext";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { Toast } from "../Toast";
import type { Region } from "@/types/region";

export default function RegionsAdminPage() {
  const { token } = useAdminAuth();
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
    if (!token) return;
    try {
      const res = await fetch("/api/admin/regions", {
        headers: { "x-admin-token": token },
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
  }, [token]);

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
    if (!token || !formName) return;
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
          "x-admin-token": token,
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
    if (!token) return;
    if (!window.confirm(`Delete region "${region.name}"? This cannot be undone.`)) return;

    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/admin/regions/${region.id}`, {
        method: "DELETE",
        headers: { "x-admin-token": token },
      });

      if (res.ok) {
        setMessage("Region deleted.");
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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Regions</h1>
        <div className="flex items-center gap-3">
          <Button onClick={openCreateModal} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Region
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="bg-[#112240] rounded-lg border border-[#23334A] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#23334A] text-left">
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Slug</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Order</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Primary</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Active</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((region) => (
                <tr
                  key={region.id}
                  className="border-b border-[#23334A] last:border-0 hover:bg-[#1a2d45] transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-white">{region.name}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{region.slug}</td>
                  <td className="px-4 py-3 text-gray-400 text-center">{region.sort_order}</td>
                  <td className="px-4 py-3 text-center">
                    {region.is_primary ? (
                      <Check className="h-4 w-4 text-green-400 inline" />
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {region.is_active ? (
                      <Check className="h-4 w-4 text-green-400 inline" />
                    ) : (
                      <X className="h-4 w-4 text-red-400 inline" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(region)}
                        className="p-1.5 rounded hover:bg-[#23334A] text-gray-400 hover:text-white transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(region)}
                        className="p-1.5 rounded hover:bg-[#23334A] text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {regions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#112240] p-6 rounded-lg border border-[#23334A] w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">
                {editingRegion ? "Edit Region" : "Add Region"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] focus:border-[#4A76A8] focus:outline-none text-white text-sm"
                  placeholder="e.g. Marietta"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Slug {editingRegion && <span className="text-gray-600 normal-case">(immutable)</span>}
                </label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => !editingRegion && setFormSlug(e.target.value)}
                  disabled={!!editingRegion}
                  className={cn(
                    "w-full px-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] focus:border-[#4A76A8] focus:outline-none text-sm font-mono",
                    editingRegion ? "text-gray-500 cursor-not-allowed" : "text-white"
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] focus:border-[#4A76A8] focus:outline-none text-white text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsPrimary}
                    onChange={(e) => setFormIsPrimary(e.target.checked)}
                    className="accent-[#4A76A8]"
                  />
                  <span className="text-sm text-gray-300">Primary region</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="accent-[#4A76A8]"
                  />
                  <span className="text-sm text-gray-300">Active</span>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSave}
                  disabled={!formName || isSaving}
                >
                  {isSaving ? "Saving..." : editingRegion ? "Save Changes" : "Create"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
