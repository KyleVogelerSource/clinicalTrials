import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ClinicalStudyService } from './clinical-study.service';
import { HttpClient } from '@angular/common/http';
import { of, firstValueFrom } from 'rxjs';

describe('ClinicalStudyService', () => {
  let service: ClinicalStudyService;
  let mockHttpClient: any;

  beforeEach(() => {
    mockHttpClient = {
      post: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: HttpClient, useValue: mockHttpClient },
      ],
    });
    service = TestBed.inject(ClinicalStudyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return suggestions for valid input', () => {
    const results = service.getSuggestedKeywords('Abdominal');
    expect(results.length).toBeGreaterThan(0);
    expect(results).toContain('Abdominal Neoplasms');
  });

  it('should return suggestions based on synonyms', () => {
    // "Birth Defects" is a synonym for "Congenital Abnormalities"
    const results = service.getSuggestedKeywords('Birth Defects');
    expect(results).toContain('Congenital Abnormalities');
  });

  it('should return empty array for empty input', () => {
    const results = service.getSuggestedKeywords('');
    expect(results).toEqual([]);
  });

  it('should return max 10 results', () => {
    const results = service.getSuggestedKeywords('a');
    expect(results.length).toBeLessThanOrEqual(10);
  });

  it('should fetch multiple pages of studies and accumulate them', async () => {
    const response1 = {
      studies: [{ protocolSection: { identificationModule: { nctId: 'NCT1', briefTitle: 'Trial 1' } } }],
      nextPageToken: 'token1',
      totalCount: 2,
    };
    const response2 = {
      studies: [{ protocolSection: { identificationModule: { nctId: 'NCT2', briefTitle: 'Trial 2' } } }],
      nextPageToken: undefined,
      totalCount: 2,
    };

    mockHttpClient.post.mockReturnValueOnce(of(response1));
    mockHttpClient.post.mockReturnValueOnce(of(response2));

    const result = await firstValueFrom(service.searchStudies({}));

    expect(result.studies.length).toBe(2);
    expect(result.studies[0].protocolSection.identificationModule.nctId).toBe('NCT1');
    expect(result.studies[1].protocolSection.identificationModule.nctId).toBe('NCT2');
    expect(mockHttpClient.post).toHaveBeenCalledTimes(2);
    // Verify the second call used the pageToken
    expect(mockHttpClient.post).toHaveBeenNthCalledWith(2, expect.any(String), expect.objectContaining({
      pageToken: 'token1'
    }));
  });

  it('should stop fetching after MAX_SEARCH_PAGES', async () => {
    // MAX_SEARCH_PAGES is 5
    const mockResponse = (id: number) => ({
      studies: [{ protocolSection: { identificationModule: { nctId: `NCT${id}`, briefTitle: `Trial ${id}` } } }],
      nextPageToken: `token${id}`,
      totalCount: 10,
    });

    for (let i = 1; i <= 6; i++) {
      mockHttpClient.post.mockReturnValueOnce(of(mockResponse(i)));
    }

    const result = await firstValueFrom(service.searchStudies({}));

    expect(result.studies.length).toBe(5);
    expect(mockHttpClient.post).toHaveBeenCalledTimes(5);
  });
});
