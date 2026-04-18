import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { LoginModal } from './login-modal';

describe('LoginModal', () => {
  let fixture: ComponentFixture<LoginModal>;
  let component: LoginModal;
  let authService: { login: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authService = {
      login: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LoginModal],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('closes when the backdrop is clicked', () => {
    const closeSpy = vi.fn();
    component.closed.subscribe(closeSpy);

    (component as any).onBackdropClick({
      target: {
        classList: {
          contains: (value: string) => value === 'modal-backdrop',
        },
      },
    } as unknown as MouseEvent);

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('does not close when the card content is clicked', () => {
    const closeSpy = vi.fn();
    component.closed.subscribe(closeSpy);

    (component as any).onBackdropClick({
      target: {
        classList: {
          contains: () => false,
        },
      },
    } as unknown as MouseEvent);

    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('submits credentials successfully and emits close', () => {
    const closeSpy = vi.fn();
    component.closed.subscribe(closeSpy);
    authService.login.mockReturnValue(of({}));
    (component as any).username = 'alice';
    (component as any).password = 'secret';

    (component as any).submit();

    expect(authService.login).toHaveBeenCalledWith('alice', 'secret');
    expect((component as any).loading()).toBe(false);
    expect((component as any).errorMessage()).toBeNull();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('shows an invalid credentials message for 401 responses', () => {
    authService.login.mockReturnValue(throwError(() => ({ status: 401 })));
    (component as any).username = 'alice';
    (component as any).password = 'wrong';

    (component as any).submit();
    fixture.detectChanges();

    expect((component as any).loading()).toBe(false);
    expect((component as any).errorMessage()).toBe('Invalid username or password.');
    expect(fixture.nativeElement.textContent).toContain('Invalid username or password.');
  });

  it('shows a generic error for unexpected failures', () => {
    authService.login.mockReturnValue(throwError(() => ({ status: 500 })));

    (component as any).submit();
    fixture.detectChanges();

    expect((component as any).errorMessage()).toBe('Something went wrong. Please try again.');
  });

  it('disables the submit button while loading', () => {
    (component as any).loading.set(true);
    fixture.detectChanges();

    const submitButton = fixture.debugElement.query(By.css('button[type="submit"]')).nativeElement as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
    expect(submitButton.textContent).toContain('Logging In');
  });
});
