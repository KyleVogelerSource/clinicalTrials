import { TestBed } from '@angular/core/testing';

import { ClinicalStudy } from './clinical-study';

describe('ClinicalStudy', () => {
  let service: ClinicalStudy;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ClinicalStudy);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
