import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function loadClient(request) {
  const source = fs.readFileSync(new URL("../src/lib/assigned-tasks.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    if (name === "./task-api") return { apiRequest: request };
    throw new Error(`Unexpected import: ${name}`);
  }, URL, process: { env: { NEXT_PUBLIC_API_BASE_URL: "https://api.example" } } });
  return exports;
}

const card = { task_id: "id", title: "Task", description: "Description", category_name: "Category", status: "ASSIGNED", agreed_wage_amount: 120, currency_code: "IRR", proposed_duration_minutes: 60, started_at: null, due_at: null, remaining_seconds: null, server_time: "2026-01-01T00:00:00Z", progress_percent: 0, escrow_verified: true, can_start: true, can_report_progress: false, can_view_private_details: false };

test("loads paginated assigned tasks and maps the API fields", async () => {
  const calls = [];
  const client = loadClient(async url => {
    calls.push(url);
    return calls.length === 1 ? { results: [card], next: "https://api.example/api/executor/tasks/?page=2" } : { results: [{ ...card, task_id: "second", status: "IN_PROGRESS" }, { ...card, status: "COMPLETED" }], next: null };
  });
  const tasks = await client.getAssignedTasks();
  assert.deepEqual(calls, ["/api/executor/tasks/", "/api/executor/tasks/?page=2"]);
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].wage, 120);
  assert.equal(tasks[0].escrow_status, "FUNDED");
  assert.equal(tasks[1].status, "IN_PROGRESS");
});

test("maps detail and keeps private data separate until explicitly requested", async () => {
  const client = loadClient(async () => ({ ...card, delivery_criteria: "criteria", employer: { user_id: "user", full_name: "Employer", avatar_url: null, completed_tasks_count: 2, average_rating: 4 }, locations: [{ city: "city", region: "region" }] }));
  const task = await client.getAssignedTask("id");
  assert.equal(task.employer_phone, null);
  assert.equal(task.employer_name, "Employer");
  const enriched = client.addPrivateDetails(task, { task_id: "id", employer_phone: "123", locations: [{ city: "city", region: "region", latitude: 35, longitude: 51, exact_address: null }] });
  assert.equal(enriched.employer_phone, "123");
  assert.throws(() => client.addPrivateDetails(task, { task_id: "other", locations: [] }));
});

test("resolves the employer's preset and uploaded avatar without using the worker profile", async () => {
  const details = { ...card, delivery_criteria: "", employer: { user_id: "employer", full_name: "Employer", avatar_type: "preset", avatar_id: "avatar_2", avatar_url: null, completed_tasks_count: 0, average_rating: null }, locations: [] };
  const client = loadClient(async () => details);
  assert.equal((await client.getAssignedTask("id")).employer_avatar_url, "/images/avatars/avatar-02-hijab.png");
  details.employer = { ...details.employer, avatar_type: "upload", avatar_url: "/media/avatars/employer.png" };
  assert.equal((await client.getAssignedTask("id")).employer_avatar_url, "https://api.example/media/avatars/employer.png");
});

test("keeps financial amounts and structured delivery requirements from the server", async () => {
  const client = loadClient(async () => ({ ...card, assigned_at: "2026-11-27T07:00:00Z", secured_amount: 150, net_worker_amount: 0,
    delivery_criteria: "طراحی در فیگما: تحویل فایل اصلی\n• نسخه فارسی\n\nدیزاین سیستم: تحویل کتابخانه رنگ",
    employer: { full_name: "Employer", avatar_url: null }, locations: [] }));
  const task = await client.getAssignedTask("id");
  assert.equal(task.secured_amount, 150);
  assert.equal(task.net_worker_amount, 0);
  assert.equal(task.assigned_at, "2026-11-27T07:00:00Z");
  assert.equal(task.requirements.length, 3);
  assert.equal(task.requirements[0].title, "طراحی در فیگما");
  assert.equal(task.requirements[0].description, "تحویل فایل اصلی");
  assert.equal(task.requirements[1].title, "نسخه فارسی");
});

test("uses documented start and progress request contracts", async () => {
  const calls = [];
  const client = loadClient(async (...args) => { calls.push(args); return {}; });
  await client.startTask("id");
  await client.reportProgress("id", 50, "  work done  ", true);
  assert.equal(calls[0][0], "/api/tasks/id/start/");
  assert.equal(calls[0][1].body, undefined);
  assert.equal(calls[1][0], "/api/executor/tasks/id/progress-reports/");
  assert.deepEqual(JSON.parse(calls[1][1].body), { progress_percent: 50, description: "work done", on_schedule: true });
  assert.throws(() => client.reportProgress("id", 33, "text", true));
  assert.throws(() => client.reportProgress("id", 50, "x".repeat(4001), true));
});

test("requests private details only via the dedicated endpoint and propagates server errors", async () => {
  const paths = [];
  const client = loadClient(async url => {
    paths.push(url);
    if (url.endsWith("start/")) throw new Error("escrow hold not verified");
    return { task_id: "id", employer_phone: "123", locations: [] };
  });
  await client.getPrivateDetails("id");
  await assert.rejects(client.startTask("id"), /escrow hold not verified/);
  assert.deepEqual(paths, ["/api/executor/tasks/id/private-details/", "/api/tasks/id/start/"]);
});

test("rejects unsafe or cyclic pagination paths", async () => {
  const unsafe = loadClient(async () => ({ results: [], next: "https://example.com/api/other/" }));
  await assert.rejects(unsafe.getAssignedTasks());
  const cyclic = loadClient(async () => ({ results: [], next: "?page=1" }));
  await assert.rejects(cyclic.getAssignedTasks());
});
