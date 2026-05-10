import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TrialResultsRequest } from '@shared/dto/TrialResultsRequest';
import { TrialResultsResponse } from '@shared/dto/TrialResultsResponse';
import { ResultsApiService } from './results-api.service';

describe('ResultsApiService', () => {
  let service: ResultsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ResultsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('posts the benchmark request together with selected trials', async () => {
    const requestBody: TrialResultsRequest = {
      condition: 'Diabetes',
      phase: 'PHASE2',
      allocationType: 'RANDOMIZED',
      interventionModel: 'PARALLEL',
      blindingType: 'DOUBLE',
      minAge: 18,
      maxAge: 65,
      sex: 'ALL',
      selectedTrialIds: ['NCT000001'],
      inclusionCriteria: [{ description: 'Adults with diabetes' }],
      exclusionCriteria: [],
    };
    const trials = [{ nctId: 'NCT000001', briefTitle: 'Reference trial' }];
    const responseBody: TrialResultsResponse = {
      timestamp: new Date('2026-04-10T00:00:00.000Z'),
      overallScore: 88,
      overallSummary: 'Typical design',
      totalTrialsFound: 1,
      queryCondition: 'Diabetes',
      estimatedDurationDays: 120,
      participantTarget: 100,
      recruitmentByImpact: [],
      timelineBuckets: [],
      terminationReasons: [],
      generatedAt: '2026-04-10T00:00:00.000Z',
    };

    const response = firstValueFrom(service.getResults(requestBody, trials));

    const request = httpMock.expectOne('/api/clinical-trials/benchmark');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      ...requestBody,
      trials,
    });
    request.flush(responseBody);

    await expect(response).resolves.toEqual(responseBody);
  });
});
