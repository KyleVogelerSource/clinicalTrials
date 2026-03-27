import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { apiUrl } from '../app/config/api.config';

export interface AuthUser {
  username: string;
  firstName: string;
  lastName: string;
}

interface AuthResponse {
  token: string;
  username: string;
  firstName: string;
  lastName: string;
}

interface HasActionResponse {
  action: string;
  allowed: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storage = this.resolveStorage();

  private readonly _token = signal<string | null>(this.storage?.getItem('auth_token') ?? null);
  private readonly _user = signal<AuthUser | null>(this.restoreUser());

  readonly isLoggedIn = computed(() => !!this._token());
  readonly currentUser = this._user.asReadonly();

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(apiUrl('/api/auth/login'), { username, password }).pipe(
      tap(res => this.saveSession(res))
    );
  }

  register(
    username: string,
    password: string,
    firstName: string,
    lastName: string
  ): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(apiUrl('/api/auth/register'), { username, password, firstName, lastName })
      .pipe(tap(res => this.saveSession(res)));
  }

  logout(): void {
    this.storage?.removeItem('auth_token');
    this.storage?.removeItem('auth_user');
    this._token.set(null);
    this._user.set(null);
  }

  getToken(): string | null {
    return this._token();
  }

  hasAction(action: string): Observable<boolean> {
    return this.http
      .get<HasActionResponse>(apiUrl(`/api/auth/has-action/${encodeURIComponent(action)}`))
      .pipe(map((res) => res.allowed));
  }

  private saveSession(res: AuthResponse): void {
    this.storage?.setItem('auth_token', res.token);
    const user: AuthUser = {
      username: res.username,
      firstName: res.firstName,
      lastName: res.lastName,
    };
    this.storage?.setItem('auth_user', JSON.stringify(user));
    this._token.set(res.token);
    this._user.set(user);
  }

  private restoreUser(): AuthUser | null {
    const stored = this.storage?.getItem('auth_user');
    if (!stored) return null;
    try {
      return JSON.parse(stored) as AuthUser;
    } catch {
      return null;
    }
  }

  private resolveStorage(): Storage | null {
    const candidate = globalThis.localStorage as Partial<Storage> | undefined;

    if (
      !candidate ||
      typeof candidate.getItem !== 'function' ||
      typeof candidate.setItem !== 'function' ||
      typeof candidate.removeItem !== 'function'
    ) {
      return null;
    }

    return candidate as Storage;
  }
}
