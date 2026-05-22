import { test } from "node:test";
import assert from "node:assert";
import { parseBeatdownTitle } from "../src/lib/stats/parseAttendance";

// Real prod format: "Backblast! <NAME> DATE: <date> AO: ..."
test("extracts the name between 'Backblast!' and 'DATE:' (no space before colon)", () => {
  assert.equal(
    parseBeatdownTitle(
      "Backblast! Run Cheatham Hill at The Battlefield DATE: 2026-05-18 AO: Blackops Q: @U0A4U71RN4F"
    ),
    "Run Cheatham Hill at The Battlefield"
  );
});

test("handles 'DATE :' with a space before the colon", () => {
  assert.equal(
    parseBeatdownTitle(
      "Backblast! The Battlefield - Tuesday DATE : 2026-05-19 AO : The Battlefield"
    ),
    "The Battlefield - Tuesday"
  );
});

test("returns null when there is no 'Backblast!' prefix", () => {
  assert.equal(parseBeatdownTitle("Some random text DATE: 2026-01-01"), null);
});

test("returns null when there is no DATE marker", () => {
  assert.equal(parseBeatdownTitle("Backblast! A workout with no date marker"), null);
});

test("returns null for empty content or an empty title", () => {
  assert.equal(parseBeatdownTitle(""), null);
  assert.equal(parseBeatdownTitle("Backblast!   DATE: 2026-01-01"), null);
});
