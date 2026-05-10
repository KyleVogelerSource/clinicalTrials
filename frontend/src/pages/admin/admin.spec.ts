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
          { id: 2, username: 'bob', firstName: 'Bob', lastName: 'Builder', createdAt: '2026-04-17T00:00:00.000Z', roles: [] },
        ],
        roles: [
          { id: 1, name: 'super-admin', createdAt: '2026-04-17T00:00:00.000Z', actions: ['user_roles'] },
          { id: 2, name: 'reviewer', createdAt: '2026-04-17T00:00:00.000Z', actions: [] },
        ],
        actions: [
          { id: 1, name: 'user_roles', createdAt: '2026-04-17T00:00:00.000Z' },
          { id: 2, name: 'trial_benchmarking', createdAt: '2026-04-17T00:00:00.000Z' },
        ],
        roleActions: [
          { roleId: 1, roleName: 'super-admin', actionId: 1, actionName: 'user_roles', createdAt: '2026-04-17T00:00:00.000Z' },
        ],
        userRoles: [
          { userId: 1, username: 'alice', roleId: 1, roleName: 'super-admin', createdAt: '2026-04-17T00:00:00.000Z' },
        ],
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
    expect(fixture.nativeElement.textContent).toContain('bob');
    expect(fixture.nativeElement.textContent).toContain('trial_benchmarking');
    expect(fixture.nativeElement.textContent).toContain('super-admin');
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

  it('creates users and roles, clears form fields, and reloads data', () => {
    const component = fixture.componentInstance as any;
    component.userUsername = ' alice ';
    component.userPassword = 'secret';
    component.userFirstName = ' Alice ';
    component.userLastName = ' Tester ';
    component.roleName = ' reviewer ';
    mockAdminService.getSummary.mockClear();

    component.createUser();
    component.createRole();

    expect(mockAdminService.createUser).toHaveBeenCalledWith({
      username: 'alice',
      password: 'secret',
      firstName: 'Alice',
      lastName: 'Tester',
    });
    expect(mockAdminService.createRole).toHaveBeenCalledWith({ name: 'reviewer' });
    expect(component.userUsername).toBe('');
    expect(component.userPassword).toBe('');
    expect(component.userFirstName).toBe('');
    expect(component.userLastName).toBe('');
    expect(component.roleName).toBe('');
    expect(mockAdminService.getSummary).toHaveBeenCalledTimes(2);
  });

  it('validates role-action and user-role assignment selections', () => {
    const component = fixture.componentInstance as any;

    component.selectedRoleId = null;
    component.selectedActionId = 1;
    component.assignRoleToAction();
    expect(component.errorMessage()).toBe('Select both a role and an action.');
    expect(mockAdminService.assignRoleAction).not.toHaveBeenCalled();

    component.selectedUserId = 1;
    component.selectedUserRoleId = null;
    component.assignRoleToUser();
    expect(component.errorMessage()).toBe('Select both a user and a role.');
    expect(mockAdminService.assignUserRole).not.toHaveBeenCalled();
  });

  it('assigns and removes role/action and user/role relations', () => {
    const component = fixture.componentInstance as any;
    mockAdminService.getSummary.mockClear();

    component.selectedRoleId = 1;
    component.selectedActionId = 1;
    component.assignRoleToAction();
    component.selectedUserId = 1;
    component.selectedUserRoleId = 1;
    component.assignRoleToUser();
    component.removeRoleAction({ roleId: 1, roleName: 'admin', actionId: 2, actionName: 'search', createdAt: 'now' });
    component.removeUserRole({ userId: 3, username: 'bob', roleId: 4, roleName: 'reviewer', createdAt: 'now' });

    expect(mockAdminService.assignRoleAction).toHaveBeenCalledWith({ roleId: 1, actionId: 1 });
    expect(mockAdminService.assignUserRole).toHaveBeenCalledWith({ userId: 1, roleId: 1 });
    expect(mockAdminService.deleteRoleAction).toHaveBeenCalledWith(1, 2);
    expect(mockAdminService.deleteUserRole).toHaveBeenCalledWith(3, 4);
    expect(mockAdminService.getSummary).toHaveBeenCalledTimes(4);
  });

  it('submits template forms through ngSubmit and delete buttons', async () => {
    mockAdminService.getSummary.mockClear();
    const inputs = fixture.nativeElement.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
    inputs[0].value = ' carol ';
    inputs[0].dispatchEvent(new Event('input'));
    inputs[1].value = 'secret';
    inputs[1].dispatchEvent(new Event('input'));
    inputs[2].value = ' Carol ';
    inputs[2].dispatchEvent(new Event('input'));
    inputs[3].value = ' Tester ';
    inputs[3].dispatchEvent(new Event('input'));
    inputs[4].value = ' auditor ';
    inputs[4].dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    const forms = fixture.nativeElement.querySelectorAll('form') as NodeListOf<HTMLFormElement>;
    forms[0].dispatchEvent(new Event('submit'));
    forms[1].dispatchEvent(new Event('submit'));
    forms[2].dispatchEvent(new Event('submit'));
    forms[3].dispatchEvent(new Event('submit'));

    const deleteButtons = fixture.nativeElement.querySelectorAll('button.danger-button') as NodeListOf<HTMLButtonElement>;
    deleteButtons[0].click();
    deleteButtons[1].click();

    expect(mockAdminService.createUser).toHaveBeenCalledWith({
      username: 'carol',
      password: 'secret',
      firstName: 'Carol',
      lastName: 'Tester',
    });
    expect(mockAdminService.createRole).toHaveBeenCalledWith({ name: 'auditor' });
    expect(mockAdminService.assignRoleAction).toHaveBeenCalledWith({ roleId: 1, actionId: 1 });
    expect(mockAdminService.assignUserRole).toHaveBeenCalledWith({ userId: 1, roleId: 1 });
    expect(mockAdminService.deleteRoleAction).toHaveBeenCalledWith(1, 1);
    expect(mockAdminService.deleteUserRole).toHaveBeenCalledWith(1, 1);
  });

  it('renders success feedback after successful actions', () => {
    const component = fixture.componentInstance as any;

    component.createRole();
    fixture.detectChanges();

    expect(component.successMessage()).toBe('Role created.');
    expect(fixture.nativeElement.textContent).toContain('Role created.');
  });

  it('surfaces action errors and formats empty lists', () => {
    const component = fixture.componentInstance as any;
    mockAdminService.createUser.mockReturnValueOnce(throwError(() => ({ error: { message: 'Username already taken.' } })));
    mockAdminService.createRole.mockReturnValueOnce(throwError(() => ({ error: { message: 'Role already exists.' } })));
    mockAdminService.assignRoleAction.mockReturnValueOnce(throwError(() => ({ error: { message: 'Role-action exists.' } })));
    mockAdminService.assignUserRole.mockReturnValueOnce(throwError(() => ({ error: { message: 'User-role exists.' } })));
    mockAdminService.deleteRoleAction.mockReturnValueOnce(throwError(() => ({ error: { message: 'Relation missing.' } })));
    mockAdminService.deleteUserRole.mockReturnValueOnce(throwError(() => ({ error: { message: 'User relation missing.' } })));

    component.createUser();
    expect(component.errorMessage()).toBe('Username already taken.');
    component.createRole();
    expect(component.errorMessage()).toBe('Role already exists.');
    component.selectedRoleId = 1;
    component.selectedActionId = 1;
    component.assignRoleToAction();
    expect(component.errorMessage()).toBe('Role-action exists.');
    component.selectedUserId = 1;
    component.selectedUserRoleId = 1;
    component.assignRoleToUser();
    expect(component.errorMessage()).toBe('User-role exists.');
    component.removeRoleAction({ roleId: 1, roleName: 'admin', actionId: 2, actionName: 'search', createdAt: 'now' });
    expect(component.errorMessage()).toBe('Relation missing.');
    component.removeUserRole({ userId: 3, username: 'bob', roleId: 4, roleName: 'reviewer', createdAt: 'now' });
    expect(component.errorMessage()).toBe('User relation missing.');

    expect(component.formatList([])).toBe('None');
    expect(component.formatList(['a', 'b'])).toBe('a, b');
  });
});
