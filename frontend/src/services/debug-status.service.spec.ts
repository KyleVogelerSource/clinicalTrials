import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DebugStatusResponse, DebugStatusService } from './debug-status.service';

describe('DebugStatusService', () => {
  let service: DebugStatusService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(DebugStatusService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('loads backend debug status', async () => {
    const responseBody: DebugStatusResponse = {
      ok: true,
      service: 'clinicaltrials-backend',
      timestamp: '2026-04-10T00:00:00.000Z',
      uptimeSeconds: 12,
      databaseConnected: false,
      databaseFailureMessage: 'Database unavailable',
      databaseDiagnostics: {
        connected: false,
        checkedAt: '2026-04-10T00:00:00.000Z',
        configuration: {
          host: 'localhost',
          port: 5432,
          database: 'clinicaltrials',
          user: 'app',
        },
        lastSuccessfulConnectionAt: null,
        failure: {
          operation: 'connect',
          capturedAt: '2026-04-10T00:00:00.000Z',
          name: 'Error',
          message: 'timeout',
        },
      },
    };

    const response = firstValueFrom(service.getStatus());

    const request = httpMock.expectOne('/api/debug/status');
    expect(request.request.method).toBe('GET');
    request.flush(responseBody);

    await expect(response).resolves.toEqual(responseBody);
  });
});
