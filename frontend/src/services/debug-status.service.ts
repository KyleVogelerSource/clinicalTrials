import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../app/config/api.config';

export interface DatabaseFailureDetails {
  operation: string;
  capturedAt: string;
  name: string;
  message: string;
  code?: string;
  detail?: string;
  hint?: string;
  severity?: string;
  stack?: string;
}

export interface DatabaseDiagnostics {
  connected: boolean;
  checkedAt: string;
  configuration: {
    host: string;
    port: number;
    database: string;
    user: string;
  };
  lastSuccessfulConnectionAt: string | null;
  failure: DatabaseFailureDetails | null;
}

export interface DebugStatusResponse {
  ok: boolean;
  service: string;
  timestamp: string;
  uptimeSeconds: number;
  databaseConnected: boolean;
  databaseDiagnostics?: DatabaseDiagnostics;
  databaseFailureMessage?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class DebugStatusService {
  constructor(private readonly http: HttpClient) {}

  getStatus(): Observable<DebugStatusResponse> {
    return this.http.get<DebugStatusResponse>(apiUrl('/api/debug/status'));
  }
}
