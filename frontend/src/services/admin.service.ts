import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../app/config/api.config';

export interface AdminUserSummary {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  roles: string[];
}

export interface AdminRoleSummary {
  id: number;
  name: string;
  createdAt: string;
  actions: string[];
}

export interface AdminActionSummary {
  id: number;
  name: string;
  createdAt: string;
}

export interface AdminRoleActionSummary {
  roleId: number;
  roleName: string;
  actionId: number;
  actionName: string;
  createdAt: string;
}

export interface AdminSnapshot {
  users: AdminUserSummary[];
  roles: AdminRoleSummary[];
  actions: AdminActionSummary[];
  roleActions: AdminRoleActionSummary[];
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  getSummary(): Observable<AdminSnapshot> {
    return this.http.get<AdminSnapshot>(apiUrl('/api/admin/summary'));
  }

  createUser(payload: { username: string; password: string; firstName: string; lastName: string }) {
    return this.http.post(apiUrl('/api/admin/users'), payload);
  }

  createRole(payload: { name: string }) {
    return this.http.post(apiUrl('/api/admin/roles'), payload);
  }

  assignRoleAction(payload: { roleId: number; actionId: number }) {
    return this.http.post(apiUrl('/api/admin/role-actions'), payload);
  }
}