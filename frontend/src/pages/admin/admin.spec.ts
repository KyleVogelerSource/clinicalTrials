import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { Admin } from './admin';
import { AuthService } from '../../services/auth.service';
import { PermissionService } from '../../services/permission.service';
import { AdminService } from '../../services/admin.service';
import { vi } from 'vitest';

describe('Admin', () => {
  let fixture: ComponentFixture<Admin>;
  let loggedIn: WritableSignal<boolean>;
  let userRolesPermission: WritableSignal<boolean>;
  let mockAuthService: any;
  let mockPermissionService: any;
  let mockAdminService: any;

  beforeEach(async () => {
    loggedIn = signal(true);
    userRolesPermission = signal(true);

    mockAuthService = {
      isLoggedIn: loggedIn,
    };
    mockPermissionService = {
      watch: vi.fn(() => userRolesPermission.asReadonly()),
    };
    mockAdminService = {
      getSummary: vi.fn().mockReturnValue(of({
        users: [
          { id: 1, username: 'alice', firstName: 'Alice', lastName: 'Tester', createdAt: '2026-04-17T00:00:00.000Z', roles: ['super-admin'] },
        ],
        roles: [
          { id: 1, name: 'super-admin', createdAt: '2026-04-17T00:00:00.000Z', actions: ['user_roles'] },
        ],
        actions: [
          { id: 1, name: 'user_roles', createdAt: '2026-04-17T00:00:00.000Z' },
        ],
        roleActions: [],
        userRoles: [],
      })),
      createUser: vi.fn().mockReturnValue(of({})),
      createRole: vi.fn().mockReturnValue(of({})),
      assignRoleAction: vi.fn().mockReturnValue(of({})),
      assignUserRole: vi.fn().mockReturnValue(of({})),
      deleteRoleAction: vi.fn().mockReturnValue(of(void 0)),
      deleteUserRole: vi.fn().mockReturnValue(of(void 0)),
    };

    await TestBed.configureTestingModule({
      imports: [Admin],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: PermissionService, useValue: mockPermissionService },
        { provide: AdminService, useValue: mockAdminService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Admin);
    fixture.detectChanges();
  });

  it('loads admin data when the user has permission', () => {
    expect(mockPermissionService.watch).toHaveBeenCalledWith('user_roles');
    expect(mockAdminService.getSummary).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Manage users, roles, and role-to-action assignments.');
    expect(fixture.nativeElement.textContent).toContain('alice');
  });

  it('shows unauthorized state when the user lacks permission', () => {
    userRolesPermission.set(false);
    mockAdminService.getSummary.mockClear();

    fixture = TestBed.createComponent(Admin);
    fixture.detectChanges();

    expect(mockAdminService.getSummary).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('unauthorized action');
  });

  it('shows unauthorized state when the user is logged out', () => {
    loggedIn.set(false);
    mockAdminService.getSummary.mockClear();

    fixture = TestBed.createComponent(Admin);
    fixture.detectChanges();

    expect(mockAdminService.getSummary).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('unauthorized action');
  });

  it('shows an error when the admin summary fails to load', () => {
    mockAdminService.getSummary.mockReturnValue(throwError(() => ({
      error: { message: 'Unable to load admin data.' },
    })));

    fixture = TestBed.createComponent(Admin);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Unable to load admin data.');
  });
});
