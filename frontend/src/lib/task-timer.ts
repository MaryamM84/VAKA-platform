export interface TaskTimerInput {
  durationMinutes: number;
  remainingSeconds: number | null;
  deadline: string | null;
  startedAt: string | null;
  serverTime: string;
}

// The accepted duration and server timestamps must bound an inconsistent remaining_seconds.
export function taskRemainingSeconds(input: TaskTimerInput, now = Date.now()): number | null {
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1) return null;
  const duration = Math.min(300, input.durationMinutes) * 60;
  const server = Date.parse(input.serverTime);
  const reference = Number.isFinite(server) ? server : now;
  const start = input.startedAt ? Date.parse(input.startedAt) : NaN;
  const end = input.deadline ? Date.parse(input.deadline) : NaN;
  const candidates: number[] = [];
  if (typeof input.remainingSeconds === "number" && Number.isFinite(input.remainingSeconds)) {
    candidates.push(input.remainingSeconds);
  }
  if (Number.isFinite(start)) candidates.push(duration - Math.max(0, (reference - start) / 1000));
  if (Number.isFinite(end)) candidates.push((end - reference) / 1000);
  if (!candidates.length) return null;
  return Math.max(0, Math.floor(Math.min(duration, ...candidates)));
}

export function taskCountdown(initialSeconds: number, elapsedMilliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(initialSeconds - Math.max(0, elapsedMilliseconds) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60]
    .map(part => String(part).padStart(2, "0")).join(":").replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}
