import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/lib/task-timer.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
vm.runInNewContext(code, { exports });
const { taskRemainingSeconds, taskCountdown } = exports;
const initial = { durationMinutes: 120, remainingSeconds: 7200, deadline: "2026-11-28T12:00:00Z", startedAt: "2026-11-28T10:00:00Z", serverTime: "2026-11-28T10:00:00Z" };

test("starts at the agreed API duration for 1, 25, 120 and 300 minute tasks", () => {
  for (const durationMinutes of [1, 25, 120, 300]) {
    const seconds = taskRemainingSeconds({ ...initial, durationMinutes, deadline: null, remainingSeconds: 99999 });
    assert.equal(seconds, durationMinutes * 60);
  }
  assert.equal(taskCountdown(taskRemainingSeconds(initial), 0), "۰۲:۰۰:۰۰");
  assert.equal(taskCountdown(taskRemainingSeconds(initial), 1000), "۰۱:۵۹:۵۹");
});

test("uses elapsed server time instead of restarting or using the browser clock", () => {
  const refreshed = { ...initial, remainingSeconds: 18000, serverTime: "2026-11-28T10:15:00Z" };
  assert.equal(taskRemainingSeconds(refreshed, Date.parse("2040-01-01")), 6300);
  assert.equal(taskRemainingSeconds({ ...refreshed, remainingSeconds: 6000 }), 6300);
  assert.equal(taskRemainingSeconds({ ...refreshed, remainingSeconds: null }), 6300);
});

test("counts down the agreed duration even after the scheduling window has closed", () => {
  assert.equal(taskRemainingSeconds({
    ...initial,
    durationMinutes: 25,
    remainingSeconds: 0,
    deadline: "2026-11-28T10:00:00Z",
    serverTime: "2026-11-28T10:00:10.500Z",
  }), 1489.5);
  assert.equal(taskCountdown(1489.5, 1000), "۰۰:۲۴:۴۹");
  assert.equal(taskRemainingSeconds({ ...initial, serverTime: "2026-11-28T12:01:00Z" }), 0);
  assert.equal(taskCountdown(60, 61000), "۰۰:۰۰:۰۰");
});

test("falls back to the API deadline or remaining seconds for older tasks without a start timestamp", () => {
  assert.equal(taskRemainingSeconds({ ...initial, startedAt: null, deadline: "2026-11-28T10:30:00Z" }), 1800);
  assert.equal(taskRemainingSeconds({ ...initial, startedAt: null, deadline: null, remainingSeconds: 90 }), 90);
  assert.equal(taskRemainingSeconds({ ...initial, startedAt: null, deadline: null, remainingSeconds: 99999 }), 7200);
  for (const durationMinutes of [0, -1, NaN, 1.5]) {
    assert.equal(taskRemainingSeconds({ ...initial, durationMinutes, deadline: null, remainingSeconds: null }), null);
  }
  assert.equal(taskRemainingSeconds({ ...initial, remainingSeconds: null, deadline: null, startedAt: null }), null);
});
