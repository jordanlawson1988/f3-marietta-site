"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { WorkoutScheduleRow } from "@/types/workout";
import type { Region } from "@/types/region";
import { ChamferButton } from "@/components/ui/brand/ChamferButton";
import { MonoTag } from "@/components/ui/brand/MonoTag";

const WORKOUT_TYPE_SUGGESTIONS = [
  "Bootcamp",
  "Run",
  "Ruck",
  "CSAUP",
  "Convergence",
];

const DAY_NAMES = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

interface WorkoutModalProps {
  workout: WorkoutScheduleRow | null; // null = create mode
  regions: Region[];
  defaultDay?: number;
  onClose: () => void;
  onSaved: () => void;
}

export function WorkoutModal({
  workout,
  regions,
  defaultDay,
  onClose,
  onSaved,
}: WorkoutModalProps) {
  const isEdit = !!workout;

  const [aoName, setAoName] = useState(workout?.ao_name ?? "");
  const [workoutType, setWorkoutType] = useState(workout?.workout_type ?? "Bootcamp");
  const [dayOfWeek, setDayOfWeek] = useState(workout?.day_of_week ?? defaultDay ?? 1);
  const [startTime, setStartTime] = useState(workout?.start_time?.slice(0, 5) ?? "05:30");
  const [endTime, setEndTime] = useState(workout?.end_time?.slice(0, 5) ?? "06:15");
  const [regionId, setRegionId] = useState(workout?.region_id ?? regions[0]?.id ?? "");
  const [locationName, setLocationName] = useState(workout?.location_name ?? "");
  const [address, setAddress] = useState(workout?.address ?? "");
  const [mapLink, setMapLink] = useState(workout?.map_link ?? "");
  const [isActive, setIsActive] = useState(workout?.is_active ?? true);

  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const activeRegions = regions.filter((r) => r.is_active);

  const missingFields = [
    !aoName && "AO Name",
    !regionId && "Region",
    !address && "Address",
  ].filter(Boolean) as string[];

  const handleSave = async () => {
    if (!aoName || !address || !regionId) return;
    setIsSaving(true);
    setError("");

    const body = {
      ao_name: aoName,
      workout_type: workoutType,
      day_of_week: dayOfWeek,
      start_time: startTime + ":00",
      end_time: endTime + ":00",
      region_id: regionId,
      location_name: locationName || null,
      address,
      map_link: mapLink || null,
      is_active: isActive,
    };

    try {
      const url = isEdit
        ? `/api/admin/workouts/${workout.id}`
        : "/api/admin/workouts";

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onSaved();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Error saving workout");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!workout) return;
    if (!window.confirm(`Delete "${workout.ao_name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/admin/workouts/${workout.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok) {
        onSaved();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete");
      }
    } catch {
      setError("Error deleting workout");
    }
  };

  const inputClass =
    "mt-2 w-full bg-transparent border border-bone/25 px-3 py-2 focus:outline-none focus:border-steel text-bone text-sm";

  return (
    <div className="fixed inset-0 bg-ink/80 backdrop-blur-sm z-50">
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-ink text-bone border-l border-steel/30 clip-chamfer overflow-auto p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 pb-4 border-b border-bone/15">
          <h3 className="font-display font-bold uppercase tracking-wide text-lg">
            {isEdit ? "Edit Workout" : "Add Workout"}
          </h3>
          <button onClick={onClose} className="text-muted hover:text-bone transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5">
          {/* AO Name */}
          <div>
            <MonoTag variant="bone">// AO Name <span className="text-rust">*</span></MonoTag>
            <input
              id="ao-name"
              type="text"
              value={aoName}
              onChange={(e) => setAoName(e.target.value)}
              className={inputClass}
              placeholder="e.g. The Foundry"
            />
          </div>

          {/* Workout Type + Day */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <MonoTag variant="bone">// Workout Type</MonoTag>
              <input
                id="workout-type"
                type="text"
                list="workout-types"
                value={workoutType}
                onChange={(e) => setWorkoutType(e.target.value)}
                className={inputClass}
              />
              <datalist id="workout-types">
                {WORKOUT_TYPE_SUGGESTIONS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div>
              <MonoTag variant="bone">// Day of Week</MonoTag>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                className={inputClass}
              >
                {DAY_NAMES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Start/End Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <MonoTag variant="bone">// Start Time</MonoTag>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <MonoTag variant="bone">// End Time</MonoTag>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Region */}
          <div>
            <MonoTag variant="bone">// Region <span className="text-rust">*</span></MonoTag>
            <select
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              className={inputClass}
            >
              {activeRegions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-muted mt-1">
              Manage regions in Admin &gt; Regions
            </div>
          </div>

          {/* Location Name */}
          <div>
            <MonoTag variant="bone">// Location Name</MonoTag>
            <input
              type="text"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className={inputClass}
              placeholder="e.g. Swift-Cantrell Park"
            />
          </div>

          {/* Address */}
          <div>
            <MonoTag variant="bone">// Address <span className="text-rust">*</span></MonoTag>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={inputClass}
              placeholder="e.g. 3140 Old 41 Hwy NW, Kennesaw, GA 30144"
            />
          </div>

          {/* Map Link */}
          <div>
            <MonoTag variant="bone">// Map Link <span className="font-normal normal-case text-muted/60">(optional)</span></MonoTag>
            <input
              type="url"
              value={mapLink}
              onChange={(e) => setMapLink(e.target.value)}
              className={inputClass}
              placeholder="https://maps.google.com/..."
            />
          </div>

          {/* Active Toggle */}
          <label className="flex items-center gap-3 py-2 cursor-pointer">
            <div
              onClick={() => setIsActive(!isActive)}
              className={`w-10 h-[22px] rounded-full relative transition-colors cursor-pointer ${
                isActive ? "bg-steel" : "bg-bone/20"
              }`}
            >
              <div
                className={`w-[18px] h-[18px] bg-bone rounded-full absolute top-[2px] transition-all ${
                  isActive ? "right-[2px]" : "left-[2px]"
                }`}
              />
            </div>
            <span className="text-sm text-bone">Active</span>
            <span className="text-xs text-muted">
              — inactive workouts are hidden from the public page
            </span>
          </label>

          {error && <p className="text-rust text-sm">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-8 pt-6 border-t border-bone/15">
          {isEdit ? (
            <ChamferButton
              type="button"
              variant="ink"
              size="sm"
              arrow={false}
              className="!bg-rust !border-rust hover:!bg-ink hover:!border-ink"
              onClick={handleDelete}
            >
              Delete
            </ChamferButton>
          ) : (
            <div />
          )}
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-3">
              <ChamferButton
                type="button"
                variant="ghost"
                size="sm"
                arrow={false}
                onClick={onClose}
              >
                Cancel
              </ChamferButton>
              <ChamferButton
                type="button"
                variant="steel"
                size="sm"
                arrow={false}
                onClick={handleSave}
                disabled={missingFields.length > 0 || isSaving}
              >
                {isSaving ? "Saving..." : isEdit ? "Save Changes" : "Create"}
              </ChamferButton>
            </div>
            {missingFields.length > 0 && (
              <p className="text-xs text-rust/80">
                Required: {missingFields.join(", ")}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
