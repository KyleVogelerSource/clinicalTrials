import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { PermissionService } from '../../services/permission.service';
import {
  AdminActionSummary,
  AdminRoleActionSummary,
  AdminRoleSummary,
  AdminService,
  AdminUserRoleSummary,
  AdminUserSummary,
} from '../../services/admin.service';
import { ACTION_NAMES } from '@shared/auth/action-names';

@Component({
  selector: 'app-admin',
  imports: [FormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Admin {
  private readonly authService = inject(AuthService);
  private readonly adminService = inject(AdminService);
  private readonly permissionService = inject(PermissionService);
  private readonly canManageRoles = this.permissionService.watch(ACTION_NAMES.userRoles);
  private adminDataRequested = false;

  protected readonly loading = signal(true);
  protected readonly authorized = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly users = signal<AdminUserSummary[]>([]);
  protected readonly roles = signal<AdminRoleSummary[]>([]);
  protected readonly actions = signal<AdminActionSummary[]>([]);
  protected readonly roleActions = signal<AdminRoleActionSummary[]>([]);
  protected readonly userRoles = signal<AdminUserRoleSummary[]>([]);

  protected userUsername = '';
  protected userPassword = '';
  protected userFirstName = '';
  protected userLastName = '';
  protected roleName = '';
  protected selectedRoleId: number | null = null;
  protected selectedActionId: number | null = null;
  protected selectedUserId: number | null = null;
  protected selectedUserRoleId: number | null = null;

  constructor() {
    effect(() => {
      if (!this.authService.isLoggedIn()) {
        this.authorized.set(false);
        this.loading.set(false);
        this.adminDataRequested = false;
        return;
      }

      const allowed = this.canManageRoles();
      this.authorized.set(allowed);
      if (!allowed) {
        this.loading.set(false);
        this.adminDataRequested = false;
        return;
      }

      if (this.adminDataRequested) {
        return;
      }

      this.adminDataRequested = true;
      this.loading.set(true);
      this.loadAdminData();
    });
  }

  protected createUser(): void {
    this.clearMessages();
    this.adminService
      .createUser({
        username: this.userUsername.trim(),
        password: this.userPassword,
        firstName: this.userFirstName.trim(),
        lastName: this.userLastName.trim(),
      })
      .subscribe({
        next: () => {
          this.userUsername = '';
          this.userPassword = '';
          this.userFirstName = '';
          this.userLastName = '';
          this.successMessage.set('User created.');
          this.loadAdminData();
        },
        error: (err: { status?: number; error?: { message?: string } }) => {
          this.errorMessage.set(err.error?.message ?? 'Unable to create user.');
        },
      });
  }

  protected createRole(): void {
    this.clearMessages();
    this.adminService.createRole({ name: this.roleName.trim() }).subscribe({
      next: () => {
        this.roleName = '';
        this.successMessage.set('Role created.');
        this.loadAdminData();
      },
      error: (err: { error?: { message?: string } }) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to create role.');
      },
    });
  }

  protected assignRoleToAction(): void {
    if (this.selectedRoleId === null || this.selectedActionId === null) {
      this.errorMessage.set('Select both a role and an action.');
      return;
    }

    this.clearMessages();
    this.adminService.assignRoleAction({ roleId: this.selectedRoleId, actionId: this.selectedActionId }).subscribe({
      next: () => {
        this.successMessage.set('Role assigned to action.');
        this.loadAdminData();
      },
      error: (err: { error?: { message?: string } }) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to assign role to action.');
      },
    });
  }

  protected assignRoleToUser(): void {
    if (this.selectedUserId === null || this.selectedUserRoleId === null) {
      this.errorMessage.set('Select both a user and a role.');
      return;
    }

    this.clearMessages();
    this.adminService.assignUserRole({ userId: this.selectedUserId, roleId: this.selectedUserRoleId }).subscribe({
      next: () => {
        this.successMessage.set('Role assigned to user.');
        this.loadAdminData();
      },
      error: (err: { error?: { message?: string } }) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to assign role to user.');
      },
    });
  }

  protected removeRoleAction(assignment: AdminRoleActionSummary): void {
    this.clearMessages();
    this.adminService.deleteRoleAction(assignment.roleId, assignment.actionId).subscribe({
      next: () => {
        this.successMessage.set('Role-action relation deleted.');
        this.loadAdminData();
      },
      error: (err: { error?: { message?: string } }) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to delete role-action relation.');
      },
    });
  }

  protected removeUserRole(assignment: AdminUserRoleSummary): void {
    this.clearMessages();
    this.adminService.deleteUserRole(assignment.userId, assignment.roleId).subscribe({
      next: () => {
        this.successMessage.set('User-role relation deleted.');
        this.loadAdminData();
      },
      error: (err: { error?: { message?: string } }) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to delete user-role relation.');
      },
    });
  }

  protected formatList(values: string[]): string {
    return values.length > 0 ? values.join(', ') : 'None';
  }

  private loadAdminData(): void {
    this.adminService.getSummary().subscribe({
      next: (snapshot) => {
        this.users.set(snapshot.users);
        this.roles.set(snapshot.roles);
        this.actions.set(snapshot.actions);
        this.roleActions.set(snapshot.roleActions);
        this.userRoles.set(snapshot.userRoles);
        if (this.selectedRoleId === null && snapshot.roles.length > 0) {
          this.selectedRoleId = snapshot.roles[0].id;
        }
        if (this.selectedActionId === null && snapshot.actions.length > 0) {
          this.selectedActionId = snapshot.actions[0].id;
        }
        if (this.selectedUserId === null && snapshot.users.length > 0) {
          this.selectedUserId = snapshot.users[0].id;
        }
        if (this.selectedUserRoleId === null && snapshot.roles.length > 0) {
          this.selectedUserRoleId = snapshot.roles[0].id;
        }
        this.loading.set(false);
      },
      error: (err: { error?: { message?: string } }) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to load admin data.');
        this.loading.set(false);
      },
    });
  }

  private clearMessages(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }
}
