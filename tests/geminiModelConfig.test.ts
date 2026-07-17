import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buildModelConfig, isGemini3 } from "../src/lib/ai/gemini";

test("isGemini3 classifies model families", () => {
  assert.equal(isGemini3("gemini-3.1-pro-preview"), true);
  assert.equal(isGemini3("gemini-3.5-flash"), true);
  assert.equal(isGemini3("gemini-3-flash-preview"), true);
  assert.equal(isGemini3("gemini-2.5-flash"), false);
  assert.equal(isGemini3("gemini-2.5-flash-lite"), false);
});

test("Gemini 3.x config uses thinkingLevel and never sends legacy knobs", () => {
  const config = buildModelConfig("gemini-3.1-pro-preview", {
    systemInstruction: "sys",
    reasoning: "low",
    maxOutputTokens: 3072,
    legacy: { temperature: 0.7, topP: 0.9, thinkingBudget: 256 },
  });
  assert.equal(config.systemInstruction, "sys");
  assert.equal(config.maxOutputTokens, 3072);
  assert.equal(config.responseMimeType, "application/json");
  assert.equal(config.thinkingConfig?.thinkingLevel, "LOW");
  // Gemini 3 rejects thinkingBudget in the same request as thinkingLevel (400),
  // and Google recommends leaving temperature at the 1.0 default.
  assert.equal(config.thinkingConfig?.thinkingBudget, undefined);
  assert.equal(config.temperature, undefined);
  assert.equal(config.topP, undefined);
});

test("Gemini 3.x maps reasoning levels to ThinkingLevel values", () => {
  const levels: Record<string, string> = { minimal: "MINIMAL", low: "LOW", medium: "MEDIUM", high: "HIGH" };
  for (const [reasoning, expected] of Object.entries(levels)) {
    const config = buildModelConfig("gemini-3.5-flash", {
      systemInstruction: "s",
      reasoning: reasoning as "minimal" | "low" | "medium" | "high",
      maxOutputTokens: 100,
    });
    assert.equal(config.thinkingConfig?.thinkingLevel, expected, `reasoning=${reasoning}`);
  }
});

test("legacy (2.5) config keeps thinkingBudget + temperature and never sends thinkingLevel", () => {
  const config = buildModelConfig("gemini-2.5-flash", {
    systemInstruction: "sys",
    reasoning: "low",
    maxOutputTokens: 2400,
    legacy: { temperature: 0.7, topP: 0.9 },
  });
  assert.equal(config.thinkingConfig?.thinkingLevel, undefined);
  assert.equal(config.thinkingConfig?.thinkingBudget, 256);
  assert.equal(config.temperature, 0.7);
  assert.equal(config.topP, 0.9);
  assert.equal(config.responseMimeType, "application/json");
});

test("legacy reasoning maps to sensible thinkingBudget defaults, overridable", () => {
  const minimal = buildModelConfig("gemini-2.5-flash", { systemInstruction: "s", reasoning: "minimal", maxOutputTokens: 10 });
  assert.equal(minimal.thinkingConfig?.thinkingBudget, 0);
  const high = buildModelConfig("gemini-2.5-flash", { systemInstruction: "s", reasoning: "high", maxOutputTokens: 10 });
  assert.equal(high.thinkingConfig?.thinkingBudget, 1024);
  const override = buildModelConfig("gemini-2.5-flash", {
    systemInstruction: "s",
    reasoning: "high",
    maxOutputTokens: 10,
    legacy: { thinkingBudget: 512 },
  });
  assert.equal(override.thinkingConfig?.thinkingBudget, 512);
});
