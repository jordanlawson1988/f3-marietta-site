// Distinct dot/wedge colors for the top 4 AOs by post count. AOs ranked
// 5+ are aggregated into a single "Other" wedge in PostsByAoChart, so the
// chip row uses AO_OTHER_COLOR for the same ranks — keeps the chip-vs-pie
// visual link honest. Naive (rank % length) wrapping would give rank 0 and
// rank 5 the same color, which is confusing when both render side by side.
export const AO_TOP_COLORS = ["#d4a93c", "#0a0a0a", "#7e6b3a", "#b8a160"] as const;
export const AO_OTHER_COLOR = "#d4d0c2";

export function getAoColor(rank: number): string {
  return rank < AO_TOP_COLORS.length ? AO_TOP_COLORS[rank] : AO_OTHER_COLOR;
}
