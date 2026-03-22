import { environment } from '../../environments/environment';

const trimmedApiBaseUrl = environment.apiBaseUrl.replace(/\/+$/, '');

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedApiBaseUrl}${normalizedPath}`;
}
