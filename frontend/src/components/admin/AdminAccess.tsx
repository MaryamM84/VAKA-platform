"use client";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { listApplications } from "@/lib/admin-api";
import { ApiRequestError } from "@/lib/task-api";
import type { AuthResponse } from "@/lib/auth-api";

type Access = "checking" | "allowed" | "denied" | "guest" | "error";
function snapshot() {
  try { return localStorage.getItem("vaka.auth") ?? sessionStorage.getItem("vaka.auth") ?? ""; }
  catch { return ""; }
}
function subscribe(fn: () => void) {
  window.addEventListener("storage", fn); window.addEventListener("vaka:auth-changed", fn);
  return () => { window.removeEventListener("storage", fn); window.removeEventListener("vaka:auth-changed", fn); };
}
const Context = createContext<{ access: Access; user: AuthResponse["user"] | null; retry: () => void }>({ access: "checking", user: null, retry: () => {} });
export const useAdminAccess = () => useContext(Context);
export function AdminAccessProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  let auth: AuthResponse | null = null;
  try { if (raw) auth = JSON.parse(raw); } catch { /* Invalid session */ }
  const key = auth?.access ? `${auth.user?.user_id}:${auth.refresh}` : "";
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; attempt: number; access: Access }>();
  useEffect(() => {
    if (!key) return;
    let active = true;
    listApplications().then(() => { if (active) setResult({ key, attempt, access: "allowed" }); })
      .catch((error: unknown) => { if (active) setResult({ key, attempt, access: error instanceof ApiRequestError && [401, 403].includes(error.status) ? "denied" : "error" }); });
    return () => { active = false; };
  }, [key, attempt]);
  const access = !key ? "guest" : result?.key === key && result.attempt === attempt ? result.access : "checking";
  return <Context.Provider value={{ access, user: auth?.user ?? null, retry: () => setAttempt(n => n + 1) }}>{children}</Context.Provider>;
}
