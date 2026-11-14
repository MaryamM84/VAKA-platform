import { apiRequest } from "@/lib/task-api";

export interface MyProfile {
  user_id: string;
  phone: string;
  full_name: string;
  email: string | null;
  birth_date?: string | null;
  province_id?: string | null;
  city_id?: string | null;
  avatar_key: string | null;
  avatar_type?: string | null;
  avatar_id?: string | null;
  avatar_url?: string | null;
  bio: string | null;
  verification_status: string;
  role_codes?: string[];
  created_at: string;
  updated_at: string;
}

export interface ProfileAvatar {
  avatar_key: string | null;
  avatar_type: string;
  avatar_id: string;
  avatar_url: string;
}

export interface PublicWorkerProfile {
  profile_id: string;
  full_name: string;
  avatar_key: string | null;
  avatar_type: string;
  avatar_id: string;
  avatar_url: string;
  bio: string | null;
  skills: Array<{ skill_id?: string; name?: string; skill_name?: string } | string>;
  province: string | null;
  city: string | null;
  verification_status: string;
  completed_tasks_count: number | string;
  active_tasks_count: number | string;
  average_rating: number | string | null;
  rating_count: number | string;
}

export type UpdateMyProfilePayload = Partial<
  Pick<MyProfile, "full_name" | "email" | "bio" | "birth_date" | "province_id" | "city_id">
>;

export function getMyProfile(): Promise<MyProfile> {
  return apiRequest<MyProfile>("/api/profile/me/");
}

export function updateMyProfile(payload: UpdateMyProfilePayload): Promise<MyProfile> {
  return apiRequest<MyProfile>("/api/profile/me/", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getMyAvatar(): Promise<ProfileAvatar> {
  return apiRequest<ProfileAvatar>("/api/profile/me/avatar/");
}

export function uploadMyAvatar(image: File): Promise<ProfileAvatar> {
  const body = new FormData();
  body.append("image", image);
  return apiRequest<ProfileAvatar>("/api/profile/me/avatar/", { method: "POST", body });
}

export function selectMyAvatar(avatarId: string): Promise<ProfileAvatar> {
  return apiRequest<ProfileAvatar>("/api/profile/me/avatar/", {
    method: "PATCH",
    body: JSON.stringify({ avatar_id: avatarId }),
  });
}

export function deleteMyAvatar(): Promise<void> {
  return apiRequest<void>("/api/profile/me/avatar/", { method: "DELETE" });
}

export function getPublicWorkerProfile(profileId: string): Promise<PublicWorkerProfile> {
  return apiRequest<PublicWorkerProfile>(`/api/profiles/${encodeURIComponent(profileId)}/`);
}

export function notifyProfileUpdated(profile: Partial<MyProfile>) {  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("vaka:profile-updated", { detail: profile }));
  }
}
