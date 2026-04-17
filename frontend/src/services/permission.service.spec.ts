import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { PermissionService } from './permission.service';
import { AuthService } from './auth.service';

describe('PermissionService', () => {
  let service: PermissionService;
  let loggedIn: ReturnType<typeof signal<boolean>>;
  let mockAuthService: {
    isLoggedIn: ReturnType<typeof signal<boolean>>;
    hasAction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    loggedIn = signal(false);
    mockAuthService = {
      isLoggedIn: loggedIn,
      hasAction: vi.fn().mockReturnValue(of(true)),
    };

    TestBed.configureTestingModule({
      providers: [
        PermissionService,
        { provide: AuthService, useValue: mockAuthService },
      ],
    });

    service = TestBed.inject(PermissionService);
  });

  it('returns false while logged out', () => {
    const allowed = service.watch('search_criteria_import');
    TestBed.flushEffects();

    expect(allowed()).toBe(false);
    expect(mockAuthService.hasAction).not.toHaveBeenCalled();
  });

  it('queries auth service when logged in and updates the signal', () => {
    loggedIn.set(true);

    const allowed = service.watch('search_criteria_import');
    TestBed.flushEffects();

    expect(mockAuthService.hasAction).toHaveBeenCalledWith('search_criteria_import');
    expect(allowed()).toBe(true);
  });

  it('reuses the same cached signal for the same action', () => {
    loggedIn.set(true);

    const first = service.watch('search_criteria_export');
    const second = service.watch('search_criteria_export');
    TestBed.flushEffects();

    expect(first).toBe(second);
    expect(mockAuthService.hasAction).toHaveBeenCalledTimes(1);
  });

  it('resets permission to false after logout', () => {
    loggedIn.set(true);
    const allowed = service.watch('search_criteria_export');
    TestBed.flushEffects();
    expect(allowed()).toBe(true);

    loggedIn.set(false);
    TestBed.flushEffects();

    expect(allowed()).toBe(false);
  });

  it('falls back to false when permission lookup fails', () => {
    loggedIn.set(true);
    mockAuthService.hasAction.mockReturnValue(throwError(() => new Error('boom')));

    const allowed = service.watch('search_criteria_export');
    TestBed.flushEffects();

    expect(allowed()).toBe(false);
  });

  it('reflects asynchronous permission updates', () => {
    loggedIn.set(true);
    const subject = new BehaviorSubject(false);
    mockAuthService.hasAction.mockReturnValue(subject.asObservable());

    const allowed = service.watch('trial_benchmarking');
    TestBed.flushEffects();
    expect(allowed()).toBe(false);

    subject.next(true);
    TestBed.flushEffects();

    expect(allowed()).toBe(true);
  });
});
