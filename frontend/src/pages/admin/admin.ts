import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import {
  AdminActionSummary,
  AdminRoleActionSummary,
  AdminRoleSummary,
  AdminService,
  AdminUserSummary,
} from '../../services/admin.service';

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

  protected readonly loading = signal(true);
  protected readonly authorized = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly users = signal<AdminUserSummary[]>([]);
  protected readonly roles = signal<AdminRoleSummary[]>([]);
  protected readonly actions = signal<AdminActionSummary[]>([]);
  protected readonly roleActions = signal<AdminRoleActionSummary[]>([]);

  protected userUsername = '';
  protected userPassword = '';
  protected userFirstName = '';
  protected userLastName = '';
  protected roleName = '';
  protected selectedRoleId: number | null = null;
  protected selectedActionId: number | null = null;

  constructor() {
    if (!this.authService.isLoggedIn()) {
      this.loading.set(false);
      this.authorized.set(false);
      return;
    }

    this.authService.hasAction('user_roles').subscribe({
      next: (allowed) => {
        this.authorized.set(allowed);
        if (!allowed) {
          this.loading.set(false);
          return;
        }

        this.loadAdminData();
      },
      error: () => {
        this.authorized.set(false);
        this.loading.set(false);
      },
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
        if (this.selectedRoleId === null && snapshot.roles.length > 0) {
          this.selectedRoleId = snapshot.roles[0].id;
        }
        if (this.selectedActionId === null && snapshot.actions.length > 0) {
          this.selectedActionId = snapshot.actions[0].id;
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
