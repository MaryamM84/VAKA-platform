import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import gregorian from "react-date-object/calendars/gregorian";
import { ApiRequestError, apiRequest } from "./task-api";
import { toEnglishDigits } from "@/components/profile-verification/utils/number-utils";
import type { IdentityFormData, VerificationStatus } from "@/components/profile-verification/types";

export interface VerificationIdentityPayload {
  first_name: string;
  last_name: string;
  national_code: string;
  birth_date: string;
  iban: string;
  mobile: string;
}

export interface VerificationIdentityResponse extends VerificationIdentityPayload {
  updated_at: string;
}

export type VerificationDocumentType = "NATIONAL_CARD_FRONT" | "NATIONAL_CARD_BACK";

export interface VerificationDocument {
  document_id: string;
  document_type: VerificationDocumentType;
  original_file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
}

export type ApiVerificationStatus =
  | "NOT_SUBMITTED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export interface VerificationStatusResponse {
  verification_status: ApiVerificationStatus;
  application_submitted_at: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  documents: VerificationDocument[];
  identity_saved: boolean;
  national_code_masked: string | null;
  iban_masked: string | null;
}

export interface UploadedVerificationDocument {
  document_id: string;
  document_type: VerificationDocumentType;
  original_file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
}

export function toVerificationIdentityPayload(data: IdentityFormData): VerificationIdentityPayload {
  const persianDate = new DateObject({
    date: toEnglishDigits(data.birthDate),
    format: "YYYY/MM/DD",
    calendar: persian,
  });
  const gregorianDate = persianDate.convert(gregorian).format("YYYY-MM-DD");

  return {
    first_name: data.firstName.trim(),
    last_name: data.lastName.trim(),
    national_code: toEnglishDigits(data.nationalCode).replace(/\D/g, ""),
    birth_date: gregorianDate,
    iban: toEnglishDigits(data.iban).replace(/\s/g, "").toUpperCase(),
    mobile: toEnglishDigits(data.mobile).replace(/\D/g, ""),
  };
}

export function fromVerificationIdentityResponse(
  data: VerificationIdentityResponse
): IdentityFormData {
  const birthDate = new DateObject({
    date: data.birth_date,
    format: "YYYY-MM-DD",
    calendar: gregorian,
  }).convert(persian).format("YYYY/MM/DD");

  return {
    firstName: data.first_name ?? "",
    lastName: data.last_name ?? "",
    nationalCode: data.national_code ?? "",
    birthDate,
    iban: data.iban ?? "",
    mobile: data.mobile ?? "",
  };
}

export function mapVerificationStatus(status: ApiVerificationStatus): VerificationStatus {
  switch (status) {
    case "PENDING": return "pending";
    case "APPROVED": return "approved";
    case "REJECTED": return "rejected";
    default: return "not_submitted";
  }
}

export function getVerificationStatus(): Promise<VerificationStatusResponse> {
  return apiRequest<VerificationStatusResponse>("/api/profile/me/verification/", { method: "GET" });
}

export async function getVerificationIdentity(): Promise<VerificationIdentityResponse | null> {
  try {
    return await apiRequest<VerificationIdentityResponse>(
      "/api/profile/me/verification/identity/",
      { method: "GET" }
    );
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return null;
    throw error;
  }
}

export function saveVerificationIdentity(data: IdentityFormData): Promise<VerificationIdentityResponse> {
  return apiRequest<VerificationIdentityResponse>(
    "/api/profile/me/verification/identity/",
    {
      method: "PUT",
      body: JSON.stringify(toVerificationIdentityPayload(data)),
    }
  );
}

export function uploadVerificationDocument(
  documentType: VerificationDocumentType,
  file: File
): Promise<UploadedVerificationDocument> {
  const formData = new FormData();
  formData.append("document_type", documentType);
  formData.append("file", file);

  return apiRequest<UploadedVerificationDocument>(
    "/api/profile/me/verification/documents/",
    { method: "POST", body: formData }
  );
}

export function deleteVerificationDocument(documentId: string): Promise<void> {
  return apiRequest<void>(
    `/api/profile/me/verification/documents/${encodeURIComponent(documentId)}/`,
    { method: "DELETE" }
  );
}

export function submitVerification(): Promise<VerificationStatusResponse> {
  return apiRequest<VerificationStatusResponse>(
    "/api/profile/me/verification/submit/",
    { method: "POST", body: JSON.stringify({}) }
  );
}
