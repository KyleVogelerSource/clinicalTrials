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
});
