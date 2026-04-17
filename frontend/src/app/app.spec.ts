import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PermissionService } from '../services/permission.service';
import { signal } from '@angular/core';
import { vi } from 'vitest';

describe('App', () => {
  let loggedIn: ReturnType<typeof signal<boolean>>;
  let canAccessAdmin: ReturnType<typeof signal<boolean>>;
  let mockAuthService: any;
  let mockPermissionService: any;
  let router: Router;

  beforeEach(async () => {
    loggedIn = signal(false);
    canAccessAdmin = signal(false);
    mockAuthService = {
      isLoggedIn: loggedIn,
      logout: vi.fn(),
      consumeFlash: vi.fn().mockReturnValue(null),
      currentUser: signal({ username: 'alice', firstName: 'Alice', lastName: 'Tester' }),
    };
    mockPermissionService = {
      watch: vi.fn(() => canAccessAdmin.asReadonly()),
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: PermissionService, useValue: mockPermissionService },
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
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
