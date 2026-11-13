import { apiRequest } from "@/lib/task-api";

export interface MyProfile {
  user_id: string;
  phone: string;
  full_name: string;
  email: string | null;
  avatar_key: string | null;
  bio: string | null;
  verification_status: string;
  role_codes?: string[];
  created_at: string;
  updated_at: string;
}

export type UpdateMyProfilePayload = Partial<
  Pick<MyProfile, "full_name" | "email" | "bio">
>;

export function getMyProfile(): Promise<MyProfile> {
  return apiRequest<MyProfile>("/api/profile/me/", {
    method: "GET",
  });
}

export function updateMyProfile(
  payload: UpdateMyProfilePayload
): Promise<MyProfile> {
  return apiRequest<MyProfile>("/api/profile/me/", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
