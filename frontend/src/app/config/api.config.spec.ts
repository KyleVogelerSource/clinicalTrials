import { describe, expect, it } from 'vitest';
import { apiUrl } from './api.config';

describe('apiUrl', () => {
  it('normalizes paths with a leading slash', () => {
    expect(apiUrl('/api/health')).toBe('/api/health');
  });

  it('normalizes paths without a leading slash', () => {
    expect(apiUrl('api/auth/login')).toBe('/api/auth/login');
  });
});
