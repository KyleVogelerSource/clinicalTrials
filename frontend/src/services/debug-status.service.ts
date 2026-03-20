import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DebugStatusResponse {
  ok: boolean;
  service: string;
  timestamp: string;
  uptimeSeconds: number;
  databaseConnected: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DebugStatusService {
  constructor(private readonly http: HttpClient) {}

  getStatus(): Observable<DebugStatusResponse> {
    return this.http.get<DebugStatusResponse>('/api/debug/status');
  }
}
