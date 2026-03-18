import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _token = signal<string | null>(localStorage.getItem('auth_token'));
  private readonly _user = signal<AuthUser | null>(this.restoreUser());

  readonly isLoggedIn = computed(() => !!this._token());
  readonly currentUser = this._user.asReadonly();

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', { username, password }).pipe(
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
      .post<AuthResponse>('/api/auth/register', { username, password, firstName, lastName })
      .pipe(tap(res => this.saveSession(res)));
  }

  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    this._token.set(null);
    this._user.set(null);
  }

  getToken(): string | null {
    return this._token();
  }

  private saveSession(res: AuthResponse): void {
    localStorage.setItem('auth_token', res.token);
    const user: AuthUser = {
      username: res.username,
      firstName: res.firstName,
      lastName: res.lastName,
    };
    localStorage.setItem('auth_user', JSON.stringify(user));
    this._token.set(res.token);
    this._user.set(user);
  }

  private restoreUser(): AuthUser | null {
    const stored = localStorage.getItem('auth_user');
    if (!stored) return null;
    try {
      return JSON.parse(stored) as AuthUser;
    } catch {
      return null;
    }
  }
}
