import { ClinicalTrialSearchRequest } from "./ClinicalTrialSearchRequest";

export type SavedSearchVisibility = "private" | "shared";

export interface SavedSearchUpsertRequest {
  name: string;
  description?: string | null;
  criteriaJson: ClinicalTrialSearchRequest;
  visibility: SavedSearchVisibility;
}

export interface SavedSearchPermissions {
  isOwner: boolean;
  canView: boolean;
  canRun: boolean;
  canEdit: boolean;
}

export interface SavedSearchRecord {
  id: number;
  ownerUserId: number;
  ownerUsername: string;
  name: string;
  description: string | null;
  criteriaJson: ClinicalTrialSearchRequest;
  visibility: SavedSearchVisibility;
  createdAt: string;
  updatedAt: string;
  lastKnownCount?: number | null;
  lastRunAt?: string | null;
  permissions: SavedSearchPermissions;
}

export interface SavedSearchShareRequest {
  username: string;
  canView: boolean;
  canRun: boolean;
  canEdit: boolean;
}

export interface SavedSearchShareRecord {
  savedSearchId: number;
  userId: number;
  username: string;
  canView: boolean;
  canRun: boolean;
  canEdit: boolean;
  createdAt: string;
}

export interface SavedSearchRunRecord {
  id: number;
  savedSearchId: number;
  runByUserId: number;
  source: string;
  resultCount: number;
  executedAt: string;
  snapshotCount: number;
}