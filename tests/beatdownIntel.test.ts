import { test } from "node:test";
import { strict as assert } from "node:assert";
import { shapeIntel, THIN_HISTORY_THRESHOLD } from "../src/lib/beatdown/intel";
import type { AoIntel } from "../src/types/beatdown";

const KNOWLEDGE = { id: 37, generated_at: "2026-08-20T07:02:00.000Z", source_event_count: 124 };

const AO_INTEL: AoIntel = {
  top_exercises: ["Merkin", "Squat"],
  common_formats: ["11s on the back hill"],
  voice_samples: ["The gloom delivered."],
};

function recentRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    event_date: `2026-08-${String(i + 1).padStart(2, "0")}`,
    q_name: "Hammer",
    title: `Backblast ${i + 1}`,
  }));
}

test("no AO selected reports region scope", () => {
  const intel = shapeIntel({
    aoDisplayName: null,
    onFile: 124,
    knowledge: KNOWLEDGE,
    aoIntel: null,
    recentExercises: [],
    recent: recentRows(20),
  });
  assert.equal(intel.confidence, "region");
  assert.equal(intel.ao_display_name, null);
});

test("an AO under the threshold reports thin history", () => {
  const intel = shapeIntel({
    aoDisplayName: "CSAUP",
    onFile: THIN_HISTORY_THRESHOLD - 1,
    knowledge: KNOWLEDGE,
    aoIntel: AO_INTEL,
    recentExercises: [],
    recent: recentRows(4),
  });
  assert.equal(intel.confidence, "thin");
});

test("an AO with events on file but no intel block still reports thin", () => {
  const intel = shapeIntel({
    aoDisplayName: "Black Ops",
    onFile: 22,
    knowledge: KNOWLEDGE,
    aoIntel: null,
    recentExercises: [],
    recent: recentRows(10),
  });
  assert.equal(intel.confidence, "thin");
});

test("strong history carries knowledge provenance", () => {
  const intel = shapeIntel({
    aoDisplayName: "The Battlefield",
    onFile: 41,
    knowledge: KNOWLEDGE,
    aoIntel: AO_INTEL,
    recentExercises: [],
    recent: recentRows(10),
  });
  assert.equal(intel.confidence, "strong");
  assert.equal(intel.knowledge_version, 37);
  assert.equal(intel.source_event_count, 124);
  assert.equal(intel.knowledge_generated_at, KNOWLEDGE.generated_at);
});

test("the ledger carries the window each count was measured against", () => {
  const intel = shapeIntel({
    aoDisplayName: "The Battlefield",
    onFile: 41,
    knowledge: KNOWLEDGE,
    aoIntel: AO_INTEL,
    recentExercises: [
      { term: "Merkin", count: 8, lastUsed: "2026-08-15" },
      { term: "Squat", count: 7, lastUsed: null },
    ],
    recent: recentRows(10),
  });
  assert.deepEqual(intel.ledger[0], { term: "Merkin", used: 8, window: 10, last_used: "2026-08-15" });
  assert.deepEqual(intel.ledger[1], { term: "Squat", used: 7, window: 10, last_used: null });
});

test("window counts backblasts actually read, not the archive size", () => {
  const intel = shapeIntel({
    aoDisplayName: "The Battlefield",
    onFile: 41,
    knowledge: KNOWLEDGE,
    aoIntel: AO_INTEL,
    recentExercises: [],
    recent: recentRows(10),
  });
  assert.equal(intel.window, 10);
  assert.equal(intel.on_file, 41);
});

test("a missing knowledge row degrades instead of throwing", () => {
  const intel = shapeIntel({
    aoDisplayName: "The Battlefield",
    onFile: 41,
    knowledge: null,
    aoIntel: null,
    recentExercises: [],
    recent: recentRows(10),
  });
  assert.equal(intel.knowledge_version, null);
  assert.equal(intel.knowledge_generated_at, null);
  assert.equal(intel.source_event_count, null);
  assert.equal(intel.confidence, "thin");
});

test("sources are passed through for the Q to audit", () => {
  const intel = shapeIntel({
    aoDisplayName: "The Battlefield",
    onFile: 41,
    knowledge: KNOWLEDGE,
    aoIntel: AO_INTEL,
    recentExercises: [],
    recent: [{ event_date: "2026-08-15", q_name: "Hammer", title: "11s on the back hill" }],
  });
  assert.deepEqual(intel.sources, [
    { event_date: "2026-08-15", q_name: "Hammer", title: "11s on the back hill" },
  ]);
});

test("an empty archive yields an empty ledger rather than a crash", () => {
  const intel = shapeIntel({
    aoDisplayName: "The Last Stand",
    onFile: 0,
    knowledge: null,
    aoIntel: null,
    recentExercises: [],
    recent: [],
  });
  assert.equal(intel.window, 0);
  assert.equal(intel.on_file, 0);
  assert.deepEqual(intel.ledger, []);
  assert.deepEqual(intel.sources, []);
  assert.equal(intel.confidence, "thin");
});
