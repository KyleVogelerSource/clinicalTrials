import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PermissionService } from '../services/permission.service';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { DebugStatusService } from '../services/debug-status.service';
import { DebugMessageService } from '../services/debug-message.service';
import { LoadingService } from '../services/loading.service';

describe('App', () => {
  let loggedIn: ReturnType<typeof signal<boolean>>;
  let canAccessAdmin: ReturnType<typeof signal<boolean>>;
  let runtimeDebugMessage: ReturnType<typeof signal<string | null>>;
  let mockAuthService: any;
  let mockPermissionService: any;
  let mockDebugStatusService: any;
  let mockDebugMessageService: any;
  let router: Router;
  let loadingService: LoadingService;

  beforeEach(async () => {
    window.history.pushState({}, '', '/');
    loggedIn = signal(false);
    canAccessAdmin = signal(false);
    runtimeDebugMessage = signal<string | null>(null);
    mockAuthService = {
      isLoggedIn: loggedIn,
      logout: vi.fn(),
      consumeFlash: vi.fn().mockReturnValue(null),
      currentUser: signal({ username: 'alice', firstName: 'Alice', lastName: 'Tester' }),
    };
    mockPermissionService = {
      watch: vi.fn(() => canAccessAdmin.asReadonly()),
    };
    mockDebugStatusService = {
      getStatus: vi.fn().mockReturnValue(of({
        ok: true,
        service: 'clinicaltrials-backend',
        timestamp: '2026-04-10T00:00:00.000Z',
        uptimeSeconds: 12,
        databaseConnected: true,
      })),
    };
    mockDebugMessageService = {
      message: runtimeDebugMessage.asReadonly(),
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: PermissionService, useValue: mockPermissionService },
        { provide: DebugStatusService, useValue: mockDebugStatusService },
        { provide: DebugMessageService, useValue: mockDebugMessageService },
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    loadingService = TestBed.inject(LoadingService);
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the logo with "CARDINAL"', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-logo')?.textContent).toContain('CARDINAL');
  });

  it('renders the Admin navigation link when permission is granted', () => {
    loggedIn.set(true);
    canAccessAdmin.set(true);

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Admin');
    expect(fixture.nativeElement.textContent).toContain('Saved Searches');
    expect(fixture.nativeElement.textContent).toContain('Hi, Alice');
  });

  it('opens and closes the login modal from the logged-out header', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const loginButton = fixture.nativeElement.querySelector('.btn-login') as HTMLButtonElement;
    loginButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-login-modal')).not.toBeNull();

    fixture.componentInstance['showLoginModal'].set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-login-modal')).toBeNull();
  });

  it('renders and dismisses consumed flash messages, then clears flash after login', () => {
    mockAuthService.consumeFlash.mockReturnValueOnce('Session expired');

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Session expired');
    (fixture.nativeElement.querySelector('.flash-close') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Session expired');

    fixture.componentInstance['flashMessage'].set('Another flash');
    loggedIn.set(true);
    fixture.detectChanges();
    TestBed.flushEffects();

    expect(fixture.componentInstance['flashMessage']()).toBeNull();
  });

  it('renders the global loading overlay while loading', () => {
    const fixture = TestBed.createComponent(App);
    loadingService.show('Loading data');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.loading-overlay')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Loading data');

    loadingService.hide();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-overlay')).toBeNull();
  });

  it('polls and renders backend debug status when debug mode is enabled', () => {
    window.history.pushState({}, '', '/?debug=true');
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    mockDebugStatusService.getStatus.mockReturnValue(of({
      ok: true,
      service: 'clinicaltrials-backend',
      timestamp: '2026-04-10T00:00:00.000Z',
      uptimeSeconds: 21,
      databaseConnected: false,
      databaseFailureMessage: 'Database unavailable',
    }));
    runtimeDebugMessage.set('Frontend warning');

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(mockDebugStatusService.getStatus).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
    expect(fixture.nativeElement.textContent).toContain('Backend: UP');
    expect(fixture.nativeElement.textContent).toContain('DB: DISCONNECTED');
    expect(fixture.nativeElement.textContent).toContain('App: Frontend warning');

    fixture.destroy();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('renders debug endpoint failures', () => {
    window.history.pushState({}, '', '/?debug=true');
    mockDebugStatusService.getStatus.mockReturnValue(throwError(() => new Error('offline')));

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Debug: Unable to reach backend debug status endpoint.');
  });

  it('navigates home on logout', () => {
    loggedIn.set(true);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app['handleLogout']();

    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });
});
