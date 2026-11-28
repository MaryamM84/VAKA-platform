export interface TaskTimerInput {
  durationMinutes: number;
  remainingSeconds: number | null;
  deadline: string | null;
  startedAt: string | null;
  serverTime: string;
}

export function taskRemainingSeconds(input: TaskTimerInput, now = Date.now()): number | null {
  const duration = Number.isInteger(input.durationMinutes) && input.durationMinutes > 0
    ? input.durationMinutes * 60
    : Infinity;
  const server = Date.parse(input.serverTime);
  const reference = Number.isFinite(server) ? server : now;
  const start = input.startedAt ? Date.parse(input.startedAt) : NaN;

  // The workspace API's due_at and remaining_seconds describe the scheduling window.
  if (Number.isFinite(start) && Number.isFinite(duration)) {
    return Math.max(0, duration - Math.max(0, (reference - start) / 1000));
  }

  const end = input.deadline ? Date.parse(input.deadline) : NaN;
  if (Number.isFinite(end)) return Math.max(0, Math.min(duration, (end - reference) / 1000));
  if (typeof input.remainingSeconds === "number" && Number.isFinite(input.remainingSeconds)) {
    return Math.max(0, Math.min(duration, input.remainingSeconds));
  }
  return null;
}

export function taskCountdown(initialSeconds: number, elapsedMilliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(initialSeconds - Math.max(0, elapsedMilliseconds) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60]
    .map(part => String(part).padStart(2, "0")).join(":").replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}
