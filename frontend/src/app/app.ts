import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { Logo } from '../primitives/logo/logo';
import { LoginModal } from '../primitives/login-modal/login-modal';
import { DebugStatusResponse, DebugStatusService } from '../services/debug-status.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Logo, LoginModal],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  private readonly debugStatusService = inject(DebugStatusService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly authService = inject(AuthService);

  protected readonly debugEnabled = signal(false);
  protected readonly debugStatus = signal<DebugStatusResponse | null>(null);
  protected readonly debugError = signal<string | null>(null);
  protected readonly showLoginModal = signal(false);
  protected readonly canAccessAdmin = signal(false);

  constructor() {
    const debugFlag = new URLSearchParams(window.location.search).get('debug') === 'true';
    this.debugEnabled.set(debugFlag);

    effect(() => {
      if (!this.authService.isLoggedIn()) {
        this.canAccessAdmin.set(false);
        return;
      }

      this.authService.hasAction('user_roles').subscribe({
        next: (allowed) => this.canAccessAdmin.set(allowed),
        error: () => this.canAccessAdmin.set(false),
      });
    });

    if (!debugFlag) {
      return;
    }

    this.fetchDebugStatus();
    const pollId = window.setInterval(() => this.fetchDebugStatus(), 10000);
    this.destroyRef.onDestroy(() => window.clearInterval(pollId));
  }

  private fetchDebugStatus() {
    this.debugStatusService.getStatus().subscribe({
      next: (status) => {
        this.debugStatus.set(status);
        this.debugError.set(null);
      },
      error: () => {
        this.debugError.set('Unable to reach backend debug status endpoint.');
      }
    });
  }
}
