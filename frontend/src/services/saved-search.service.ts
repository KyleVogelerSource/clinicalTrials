import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../app/config/api.config';
import { ClinicalTrialSearchRequest } from '../../../shared/src/dto/ClinicalTrialSearchRequest';

export type SavedSearchVisibility = 'private' | 'shared';

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

@Injectable({ providedIn: 'root' })
export class SavedSearchService {
  constructor(private http: HttpClient) {}

  create(request: SavedSearchUpsertRequest): Observable<SavedSearchRecord> {
    return this.http.post<SavedSearchRecord>(apiUrl('/api/saved-searches'), request);
  }

  listMine(): Observable<SavedSearchRecord[]> {
    return this.http.get<SavedSearchRecord[]>(apiUrl('/api/saved-searches'));
  }

  listSharedWithMe(): Observable<SavedSearchRecord[]> {
    return this.http.get<SavedSearchRecord[]>(apiUrl('/api/saved-searches/shared-with-me'));
  }

  getById(id: number): Observable<SavedSearchRecord> {
    return this.http.get<SavedSearchRecord>(apiUrl(`/api/saved-searches/${id}`));
  }

  update(id: number, request: SavedSearchUpsertRequest): Observable<SavedSearchRecord> {
    return this.http.put<SavedSearchRecord>(apiUrl(`/api/saved-searches/${id}`), request);
  }

  share(id: number, request: SavedSearchShareRequest): Observable<SavedSearchShareRecord> {
    return this.http.post<SavedSearchShareRecord>(apiUrl(`/api/saved-searches/${id}/share`), request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(apiUrl(`/api/saved-searches/${id}`));
  }
}
