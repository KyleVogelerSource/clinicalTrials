import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminSnapshot, AdminService } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('loads the admin summary', async () => {
    const summary: AdminSnapshot = {
      users: [],
      roles: [],
      actions: [],
      roleActions: [],
      userRoles: [],
    };
    const response = firstValueFrom(service.getSummary());

    const request = httpMock.expectOne('/api/admin/summary');
    expect(request.request.method).toBe('GET');
    request.flush(summary);

    await expect(response).resolves.toEqual(summary);
  });

  it('creates users and roles with the provided payloads', async () => {
    const userPayload = { username: 'alice', password: 'secret', firstName: 'Alice', lastName: 'Ng' };
    const rolePayload = { name: 'reviewer' };
    const userResponse = firstValueFrom(service.createUser(userPayload));
    const roleResponse = firstValueFrom(service.createRole(rolePayload));

    const userRequest = httpMock.expectOne('/api/admin/users');
    expect(userRequest.request.method).toBe('POST');
    expect(userRequest.request.body).toEqual(userPayload);
    userRequest.flush({ id: 1 });

    const roleRequest = httpMock.expectOne('/api/admin/roles');
    expect(roleRequest.request.method).toBe('POST');
    expect(roleRequest.request.body).toEqual(rolePayload);
    roleRequest.flush({ id: 2 });

    await expect(userResponse).resolves.toEqual({ id: 1 });
    await expect(roleResponse).resolves.toEqual({ id: 2 });
  });

  it('assigns and removes role actions', async () => {
    const assignResponse = firstValueFrom(service.assignRoleAction({ roleId: 3, actionId: 4 }));
    const assignRequest = httpMock.expectOne('/api/admin/role-actions');
    expect(assignRequest.request.method).toBe('POST');
    expect(assignRequest.request.body).toEqual({ roleId: 3, actionId: 4 });
    assignRequest.flush({ ok: true });

    const deleteResponse = firstValueFrom(service.deleteRoleAction(3, 4));
    const deleteRequest = httpMock.expectOne('/api/admin/role-actions/3/4');
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null);

    await expect(assignResponse).resolves.toEqual({ ok: true });
    await expect(deleteResponse).resolves.toBeNull();
  });

  it('assigns and removes user roles', async () => {
    const assignResponse = firstValueFrom(service.assignUserRole({ userId: 5, roleId: 6 }));
    const assignRequest = httpMock.expectOne('/api/admin/user-roles');
    expect(assignRequest.request.method).toBe('POST');
    expect(assignRequest.request.body).toEqual({ userId: 5, roleId: 6 });
    assignRequest.flush({ ok: true });

    const deleteResponse = firstValueFrom(service.deleteUserRole(5, 6));
    const deleteRequest = httpMock.expectOne('/api/admin/user-roles/5/6');
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null);

    await expect(assignResponse).resolves.toEqual({ ok: true });
    await expect(deleteResponse).resolves.toBeNull();
  });
});
