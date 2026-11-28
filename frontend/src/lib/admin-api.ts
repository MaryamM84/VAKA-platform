import { getAuthRedirectPath } from "./auth-api";
import { apiRequest, apiResponse, readAllPages } from "./task-api";
import type { ApiVerificationStatus, VerificationDocument, VerificationIdentityResponse } from "./verification-api";

export const ADMIN_PATH = "/admin/worker-verifications";
const endpoint = "/api/admin/worker-verifications/";
export interface VerificationApplication {
  executor_profile_id: string;
  applicant: { user_id: string; full_name: string; phone: string; email: string | null };
  verification_status: ApiVerificationStatus;
  application_submitted_at: string | null;
}
export interface VerificationDetail extends VerificationApplication {
  identity: VerificationIdentityResponse;
  documents: VerificationDocument[];
  rejection_reason: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
}
const detailPath = (id: string) => `${endpoint}${encodeURIComponent(id)}/`;
export const listApplications = () => apiRequest<VerificationApplication[]>(endpoint);
export const getApplication = (id: string) => apiRequest<VerificationDetail>(detailPath(id));
export const decideApplication = (id: string, action: "approve" | "reject", reason: string) =>
  apiRequest<VerificationDetail>(`${detailPath(id)}${action}/`, {
    method: "POST", ...(action === "reject" ? { body: JSON.stringify({ reason: reason.trim() }) } : {}),
  });
export async function getDocument(id: string, documentId: string, signal: AbortSignal) {
  const response = await apiResponse(`${detailPath(id)}documents/${encodeURIComponent(documentId)}/download/`, { signal });
  const blob = await response.blob();
  if (!/^image\/(jpeg|png|webp|gif)$/i.test(blob.type)) throw new Error("فرمت تصویر قابل نمایش نیست.");
  return blob;
}

export async function getLoginDestination() {
  try { await listApplications(); return ADMIN_PATH; } catch { return getAuthRedirectPath(); }
}

export const listAllApplications = (signal?: AbortSignal) => readAllPages<VerificationApplication>(`${endpoint}applications/?status=ALL`, signal);
export interface AdminExecutor {
  executor_profile_id: string; full_name: string; phone: string; email: string | null;
  account_status: string; profile_status: string; verification_status: ApiVerificationStatus;
  service_area_city: string; service_area_region: string; approved_at: string | null;
  completed_tasks_count: number; active_tasks_count: number;
}
export const listExecutors = (signal?: AbortSignal) => readAllPages<AdminExecutor>("/api/admin/executors/", signal);

export interface ManagedCategory {
  category_id: string; name: string; description: string | null; parent_category_id: string | null;
  parent_category_name?: string | null; is_active?: boolean;
}
export type CategoryInput = Pick<ManagedCategory,"name"|"description"|"parent_category_id"|"is_active">;
const categoriesPath = "/api/manage/task-categories/";
export const listManagedCategories = (signal?: AbortSignal) => apiRequest<ManagedCategory[]>(categoriesPath,{signal});
export const getManagedCategory = (id:string) => apiRequest<ManagedCategory>(`${categoriesPath}${encodeURIComponent(id)}/`);
export const saveManagedCategory = (input:CategoryInput,id?:string) => apiRequest<ManagedCategory>(id?`${categoriesPath}${encodeURIComponent(id)}/`:categoriesPath,{method:id?"PUT":"POST",body:JSON.stringify(input)});
export const setCategoryActive = (id:string,is_active:boolean) => apiRequest<ManagedCategory>(`${categoriesPath}${encodeURIComponent(id)}/`,{method:"PATCH",body:JSON.stringify({is_active})});
