"use client";

import { useState, useEffect } from "react";
import { WorkoutGrid } from "./WorkoutGrid";
import { WorkoutModal } from "./WorkoutModal";
import type { WorkoutScheduleRow } from "@/types/workout";
import { Toast } from "../Toast";
import type { Region } from "@/types/region";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { ChamferButton } from "@/components/ui/brand/ChamferButton";
import { Button } from "@/components/ui/Button";

export default function WorkoutsAdminPage() {
  const [workouts, setWorkouts] = useState<WorkoutScheduleRow[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [regionFilter, setRegionFilter] = useState<string | null>(null);

  // Modal
  const [modalWorkout, setModalWorkout] = useState<WorkoutScheduleRow | null>(null);
  const [modalDefaultDay, setModalDefaultDay] = useState<number | undefined>();
  const [showModal, setShowModal] = useState(false);

  // Bulk
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [bulkRegionId, setBulkRegionId] = useState<string>("");
  const [showBulkRegionPicker, setShowBulkRegionPicker] = useState(false);

  const fetchData = async () => {
    try {
      const [wRes, rRes] = await Promise.all([
        fetch("/api/admin/workouts", {
          credentials: "include",
        }),
        fetch("/api/admin/regions", {
          credentials: "include",
        }),
      ]);

      if (wRes.ok && rRes.ok) {
        const wData = await wRes.json();
        const rData = await rRes.json();
        setWorkouts(wData.workouts);
        setRegions(rData.regions);
      }
    } catch {
      setError("Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSelectWorkout = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreateModal = (day?: number) => {
    setModalWorkout(null);
    setModalDefaultDay(day);
    setShowModal(true);
  };

  const openEditModal = (workout: WorkoutScheduleRow) => {
    setModalWorkout(workout);
    setModalDefaultDay(undefined);
    setShowModal(true);
  };

  const handleBulkAction = async (action: string) => {
    if (selectedIds.size === 0) return;
    setError("");
    setMessage("");
    setShowBulkMenu(false);

    if (action === "change_region") {
      setShowBulkRegionPicker(true);
      return;
    }

    if (action === "delete") {
      if (!window.confirm(`Delete ${selectedIds.size} workout(s)? This cannot be undone.`)) return;
    }

    try {
      const res = await fetch("/api/admin/workouts/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          ids: Array.from(selectedIds),
          confirm: action === "delete" ? true : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage(`${data.affected} workout(s) updated.`);
        setSelectedIds(new Set());
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Bulk action failed");
      }
    } catch {
      setError("Error performing bulk action");
    }
  };

  const handleBulkChangeRegion = async () => {
    if (!bulkRegionId) return;
    setError("");
    setMessage("");
    setShowBulkRegionPicker(false);

    try {
      const res = await fetch("/api/admin/workouts/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "change_region",
          ids: Array.from(selectedIds),
          region_id: bulkRegionId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage(`${data.affected} workout(s) updated.`);
        setSelectedIds(new Set());
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Bulk action failed");
      }
    } catch {
      setError("Error performing bulk action");
    }
  };

  const activeRegions = regions.filter((r) => r.is_active);

  if (isLoading) {
    return <div className="p-6 text-muted">Loading...</div>;
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <SectionHead eyebrow="§ Admin · Workouts" h2="Schedule Manager" align="left" />

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8899aa]">Filter:</span>
          <button
            onClick={() => setRegionFilter(null)}
            className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
              !regionFilter
                ? "bg-[#4A76A8] text-white"
                : "bg-[#23334a] text-gray-400 hover:text-white"
            }`}
          >
            All
          </button>
          {activeRegions.map((r) => (
            <button
              key={r.id}
              onClick={() =>
                setRegionFilter(regionFilter === r.id ? null : r.id)
              }
              className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                regionFilter === r.id
                  ? "bg-[#4A76A8] text-white"
                  : "bg-[#23334a] text-gray-400 hover:text-white"
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowBulkMenu(!showBulkMenu)}
                className="bg-[#23334a] text-gray-300 border border-[#3a5e88] px-3 py-1.5 rounded text-xs hover:text-white transition-colors"
              >
                Bulk Actions ({selectedIds.size}) ▾
              </button>
              {showBulkMenu && (
                <div className="absolute right-0 top-full mt-1 bg-[#112240] border border-[#23334A] rounded shadow-xl z-10 min-w-[160px]">
                  <button
                    onClick={() => handleBulkAction("deactivate")}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#23334A] transition-colors"
                  >
                    Deactivate
                  </button>
                  <button
                    onClick={() => handleBulkAction("change_region")}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#23334A] transition-colors"
                  >
                    Change Region
                  </button>
                  <button
                    onClick={() => handleBulkAction("delete")}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-[#23334A] transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}

          <ChamferButton variant="ink" size="md" arrow={false} onClick={() => openCreateModal()}>
            New Workout
          </ChamferButton>
        </div>
      </div>

      {/* Grid */}
      <WorkoutGrid
        workouts={workouts}
        regions={regions}
        selectedIds={selectedIds}
        regionFilter={regionFilter}
        onSelectWorkout={handleSelectWorkout}
        onClickWorkout={openEditModal}
        onAddToDay={(day) => openCreateModal(day)}
      />

      {/* Toast notifications */}
      {message && <Toast message={message} type="success" onDismiss={() => setMessage("")} />}
      {error && <Toast message={error} type="error" onDismiss={() => setError("")} duration={5000} />}

      {/* Workout Modal */}
      {showModal && (
        <WorkoutModal
          workout={modalWorkout}
          regions={regions}
          defaultDay={modalDefaultDay}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setMessage(modalWorkout ? "Workout updated." : "Workout created.");
            fetchData();
          }}
        />
      )}

      {/* Bulk Region Picker Modal */}
      {showBulkRegionPicker && (
        <div className="fixed inset-0 bg-ink/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-ink text-bone border border-steel/30 clip-chamfer p-8 w-full max-w-sm shadow-2xl">
            <h3 className="font-display font-bold uppercase tracking-wide text-lg mb-4">Change Region</h3>
            <p className="text-sm text-muted mb-3">
              Move {selectedIds.size} workout(s) to:
            </p>
            <select
              value={bulkRegionId}
              onChange={(e) => setBulkRegionId(e.target.value)}
              className="mt-2 w-full bg-transparent border border-bone/25 px-3 py-2 focus:outline-none focus:border-steel text-bone text-sm mb-4"
            >
              <option value="">Select a region...</option>
              {activeRegions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowBulkRegionPicker(false)}
              >
                Cancel
              </Button>
              <ChamferButton
                variant="steel"
                size="sm"
                arrow={false}
                className="flex-1 justify-center"
                onClick={handleBulkChangeRegion}
                disabled={!bulkRegionId}
              >
                Move
              </ChamferButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
