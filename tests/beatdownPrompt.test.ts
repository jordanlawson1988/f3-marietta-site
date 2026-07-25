import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buildUserPrompt, type UserPromptArgs } from "../src/lib/beatdown/prompts/user";
import { BEATDOWN_SYSTEM_INSTRUCTION } from "../src/lib/beatdown/prompts/system";
import type { BeatdownInputs } from "../src/types/beatdown";

const INPUTS: BeatdownInputs = {
  ao_id: "ao-1",
  ao_display_name: "The Battlefield",
  focus: "full",
  theme: null,
  equipment: ["bodyweight"],
  famous_bd: null,
  q_notes: "",
  length_min: 60,
};

function baseArgs(overrides: Partial<UserPromptArgs> = {}): UserPromptArgs {
  return {
    inputs: INPUTS,
    aoContext: null,
    knowledgeContent: "Region knowledge doc",
    recentAtAo: [],
    exiconSubset: [],
    famousBdLibrary: [],
    selectedFamousBd: null,
    aoIntel: null,
    recentExercises: [],
    ...overrides,
  };
}

test("AO intel block renders top exercises, formats, and voice samples", () => {
  const prompt = buildUserPrompt(
    baseArgs({
      aoIntel: {
        top_exercises: ["Merkins", "Bonnie Blairs"],
        common_formats: ["Dora", "Stations"],
        voice_samples: ["The gloom delivered."],
      },
    })
  );
  assert.match(prompt, /\[PINNED — AO Intel: The Battlefield/);
  assert.match(prompt, /Merkins/);
  assert.match(prompt, /Dora/);
  assert.match(prompt, /The gloom delivered\./);
});

test("AO intel block is omitted when no intel exists", () => {
  const prompt = buildUserPrompt(baseArgs());
  assert.doesNotMatch(prompt, /AO Intel/);
});

test("avoid-repeat block lists recently used exercises with counts and dates", () => {
  const prompt = buildUserPrompt(
    baseArgs({
      recentExercises: [
        { term: "Merkin", count: 4, lastUsed: "2026-07-14" },
        { term: "11s", count: 2, lastUsed: "2026-07-07" },
      ],
    })
  );
  assert.match(prompt, /Recently used at The Battlefield/);
  assert.match(prompt, /AVOID over-repeating/i);
  assert.match(prompt, /Merkin \(4 of the last/);
  assert.match(prompt, /last on 2026-07-14/);
});

test("avoid-repeat block uses region-wide label when no AO is selected", () => {
  const prompt = buildUserPrompt(
    baseArgs({
      inputs: { ...INPUTS, ao_id: null, ao_display_name: null },
      recentExercises: [{ term: "Burpee", count: 3, lastUsed: "2026-07-10" }],
    })
  );
  assert.match(prompt, /Recently used across F3 Marietta/);
});

test("system instruction scales to requested duration instead of hardcoding 45", () => {
  assert.doesNotMatch(BEATDOWN_SYSTEM_INSTRUCTION, /Total beatdown is 45 minutes/);
  assert.match(BEATDOWN_SYSTEM_INSTRUCTION, /requested length/i);
  assert.match(BEATDOWN_SYSTEM_INSTRUCTION, /history/i);
});

test("existing prompt blocks are preserved", () => {
  const prompt = buildUserPrompt(baseArgs());
  assert.match(prompt, /\[PINNED — F3 Marietta Knowledge\]/);
  assert.match(prompt, /\[Q INPUTS\]/);
  assert.match(prompt, /Length: 60 minutes/);
});
