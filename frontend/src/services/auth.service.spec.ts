import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let localStorageMock: Storage;
  let sessionStorageMock: Storage;

  function createStorage(): Storage {
    const data = new Map<string, string>();
    return {
      getItem: vi.fn((key: string) => data.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        data.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        data.delete(key);
      }),
      clear: vi.fn(() => {
        data.clear();
      }),
      key: vi.fn((index: number) => Array.from(data.keys())[index] ?? null),
      get length() {
        return data.size;
      },
    } as Storage;
  }

  beforeEach(() => {
    localStorageMock = createStorage();
    sessionStorageMock = createStorage();
    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal('sessionStorage', sessionStorageMock);

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock?.verify();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('restores an existing session from localStorage', () => {
    localStorageMock.setItem('auth_token', 'stored-token');
    localStorageMock.setItem('auth_user', JSON.stringify({
      username: 'alice',
      firstName: 'Alice',
      lastName: 'Ng',
    }));

    const restored = TestBed.runInInjectionContext(() => new AuthService());

    expect(restored.isLoggedIn()).toBe(true);
    expect(restored.getToken()).toBe('stored-token');
    expect(restored.currentUser()).toEqual({
      username: 'alice',
      firstName: 'Alice',
      lastName: 'Ng',
    });
  });

  it('logs in and stores the user session', async () => {
    const loginPromise = firstValueFrom(service.login('alice', 'secret'));

    const request = httpMock.expectOne('/api/auth/login');
    expect(request.request.method).toBe('POST');
    request.flush({
      token: 'jwt-token',
      username: 'alice',
      firstName: 'Alice',
      lastName: 'Ng',
    });

    await expect(loginPromise).resolves.toEqual({
      token: 'jwt-token',
      username: 'alice',
      firstName: 'Alice',
      lastName: 'Ng',
    });
    expect(service.isLoggedIn()).toBe(true);
    expect(service.getToken()).toBe('jwt-token');
    expect(localStorageMock.getItem('auth_token')).toBe('jwt-token');
  });

  it('registers and stores the user session', async () => {
    const registerPromise = firstValueFrom(
      service.register('new-user', 'secret', 'New', 'User')
    );

    const request = httpMock.expectOne('/api/auth/register');
    expect(request.request.method).toBe('POST');
    request.flush({
      token: 'new-token',
      username: 'new-user',
      firstName: 'New',
      lastName: 'User',
    });

    await expect(registerPromise).resolves.toEqual({
      token: 'new-token',
      username: 'new-user',
      firstName: 'New',
      lastName: 'User',
    });
    expect(service.currentUser()?.username).toBe('new-user');
  });

  it('logs out and clears stored session state', () => {
    localStorageMock.setItem('auth_token', 'stored-token');
    localStorageMock.setItem('auth_user', JSON.stringify({
      username: 'alice',
      firstName: 'Alice',
      lastName: 'Ng',
    }));
    const restored = TestBed.runInInjectionContext(() => new AuthService());

    restored.logout();

    expect(restored.isLoggedIn()).toBe(false);
    expect(restored.currentUser()).toBeNull();
    expect(localStorageMock.getItem('auth_token')).toBeNull();
    expect(localStorageMock.getItem('auth_user')).toBeNull();
  });

  it('maps hasAction responses to a boolean', async () => {
    const actionPromise = firstValueFrom(service.hasAction('search_criteria_export'));

    const request = httpMock.expectOne(
      '/api/auth/has-action/search_criteria_export'
    );
    expect(request.request.method).toBe('GET');
    request.flush({ action: 'search_criteria_export', allowed: true });

    await expect(actionPromise).resolves.toBe(true);
  });

  it('consumes and clears flash messages', () => {
    sessionStorageMock.setItem('auth_flash', 'Session expired');

    expect(service.consumeFlash()).toBe('Session expired');
    expect(service.consumeFlash()).toBeNull();
  });

  it('returns null for invalid stored user JSON', () => {
    localStorageMock.setItem('auth_token', 'stored-token');
    localStorageMock.setItem('auth_user', '{not-json');

    const restored = TestBed.runInInjectionContext(() => new AuthService());

    expect(restored.isLoggedIn()).toBe(true);
    expect(restored.currentUser()).toBeNull();
  });

  it('logoutExpired clears the session, stores a flash message, and redirects home', () => {
    const logoutSpy = vi.spyOn(service, 'logout');

    service.logoutExpired();

    expect(logoutSpy).toHaveBeenCalled();
    expect(sessionStorageMock.getItem('auth_flash')).toBe('Your session has expired. Please log in again.');
  });
});
