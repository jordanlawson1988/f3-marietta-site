"use client";

import { useState } from "react";
import { useAdminAuth } from "../AdminAuthContext";
import { Button } from "@/components/ui/Button";
import { X } from "lucide-react";
import type { WorkoutScheduleRow } from "@/types/workout";
import type { Region } from "@/types/region";

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
  const { token } = useAdminAuth();
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

  const handleSave = async () => {
    if (!token || !aoName || !address || !regionId) return;
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
          "x-admin-token": token,
        },
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
    if (!token || !workout) return;
    if (!window.confirm(`Delete "${workout.ao_name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/admin/workouts/${workout.id}`, {
        method: "DELETE",
        headers: { "x-admin-token": token },
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
    "w-full px-3 py-2 rounded bg-[#0A1A2F] border border-[#23334A] focus:border-[#4A76A8] focus:outline-none text-white text-sm";
  const labelClass =
    "block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#112240] rounded-lg border border-[#23334A] w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-[#23334A] sticky top-0 bg-[#112240]">
          <h3 className="text-lg font-bold">
            {isEdit ? "Edit Workout" : "Add Workout"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* AO Name */}
          <div>
            <label className={labelClass}>AO Name</label>
            <input
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
              <label className={labelClass}>Workout Type</label>
              <input
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
              <label className={labelClass}>Day of Week</label>
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
              <label className={labelClass}>Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>End Time</label>
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
            <label className={labelClass}>Region</label>
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
            <div className="text-xs text-[#4a5e73] mt-1">
              Manage regions in Admin &gt; Regions
            </div>
          </div>

          {/* Location Name */}
          <div>
            <label className={labelClass}>Location Name</label>
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
            <label className={labelClass}>Address</label>
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
            <label className={labelClass}>
              Map Link <span className="font-normal normal-case text-gray-600">(optional)</span>
            </label>
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
                isActive ? "bg-[#4A76A8]" : "bg-[#23334A]"
              }`}
            >
              <div
                className={`w-[18px] h-[18px] bg-white rounded-full absolute top-[2px] transition-all ${
                  isActive ? "right-[2px]" : "left-[2px]"
                }`}
              />
            </div>
            <span className="text-sm text-gray-300">Active</span>
            <span className="text-xs text-[#4a5e73]">
              — inactive workouts are hidden from the public page
            </span>
          </label>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t border-[#23334A]">
          {isEdit ? (
            <button
              onClick={handleDelete}
              className="px-4 py-2 rounded border border-red-800 text-red-400 text-sm hover:bg-red-900/20 transition-colors"
            >
              Delete
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!aoName || !address || !regionId || isSaving}
            >
              {isSaving ? "Saving..." : isEdit ? "Save Changes" : "Create"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
