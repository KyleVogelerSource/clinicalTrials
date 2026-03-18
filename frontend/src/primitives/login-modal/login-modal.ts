import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

type ModalMode = 'login' | 'register';

@Component({
  selector: 'app-login-modal',
  imports: [FormsModule],
  templateUrl: './login-modal.html',
  styleUrl: './login-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginModal {
  @Output() closed = new EventEmitter<void>();

  private readonly authService = inject(AuthService);

  protected readonly mode = signal<ModalMode>('login');
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected username = '';
  protected password = '';
  protected firstName = '';
  protected lastName = '';

  protected setMode(m: ModalMode): void {
    this.mode.set(m);
    this.errorMessage.set(null);
  }

  protected onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closed.emit();
    }
  }

  protected submit(): void {
    this.errorMessage.set(null);
    this.loading.set(true);

    const obs =
      this.mode() === 'login'
        ? this.authService.login(this.username, this.password)
        : this.authService.register(this.username, this.password, this.firstName, this.lastName);

    obs.subscribe({
      next: () => {
        this.loading.set(false);
        this.closed.emit();
      },
      error: (err: { status?: number }) => {
        this.loading.set(false);
        if (err.status === 401) {
          this.errorMessage.set('Invalid username or password.');
        } else if (err.status === 409) {
          this.errorMessage.set('Username already taken. Please choose another.');
        } else if (err.status === 400) {
          this.errorMessage.set('Please fill in all required fields.');
        } else {
          this.errorMessage.set('Something went wrong. Please try again.');
        }
      },
    });
  }
}
