import { Injectable, Injector, Signal, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly authService = inject(AuthService);
  private readonly injector = inject(Injector);
  private readonly cache = new Map<string, Signal<boolean>>();

  watch(action: string): Signal<boolean> {
    const existing = this.cache.get(action);
    if (existing) {
      return existing;
    }

    const allowed = signal(false);

    effect(
      (onCleanup) => {
        if (!this.authService.isLoggedIn()) {
          allowed.set(false);
          return;
        }

        const subscription = this.authService.hasAction(action).subscribe({
          next: (value) => allowed.set(value),
          error: () => allowed.set(false),
        });

        onCleanup(() => subscription.unsubscribe());
      },
      { injector: this.injector }
    );

    const readonly = allowed.asReadonly();
    this.cache.set(action, readonly);
    return readonly;
  }
}
