import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ClinicalStudyService } from './clinical-study.service';

describe('ClinicalStudyService', () => {
  let service: ClinicalStudyService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
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
});
