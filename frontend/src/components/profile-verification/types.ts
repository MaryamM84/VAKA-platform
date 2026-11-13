export type VerificationStatus = "not_submitted" | "pending" | "approved" | "rejected";

export interface IdentityFormData {
  firstName: string;
  lastName: string;
  nationalCode: string;
  /** Persian calendar date in YYYY/MM/DD format. */
  birthDate: string;
  iban: string;
  mobile: string;
}

export interface VerificationDocuments {
  nationalCardFront: File | null;
  nationalCardBack: File | null;
}

export interface ProfileVerificationData {
  identity: IdentityFormData;
  documents: VerificationDocuments;
  status: VerificationStatus;
  rejectionReason?: string;
}

export type VerificationStep = 1 | 2 | 3;
