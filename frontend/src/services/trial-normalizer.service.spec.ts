import { describe, expect, it } from 'vitest';
import { TrialNormalizer } from './trial-normalizer.service';

describe('TrialNormalizer', () => {
  const service = new TrialNormalizer();

  it('normalizes populated ClinicalTrials.gov studies for benchmark payloads', () => {
    const result = service.normalizeForBenchmark({
      protocolSection: {
        identificationModule: {
          nctId: 'NCT000001',
          briefTitle: 'Diabetes trial',
        },
        statusModule: {
          overallStatus: 'RECRUITING',
          startDateStruct: { date: '2026-01-01' },
          completionDateStruct: { date: '2027-01-01' },
        },
        designModule: {
          phases: ['Phase 2', 'Phase 3'],
          studyType: 'INTERVENTIONAL',
          enrollmentInfo: { count: 120, type: 'ACTUAL' },
        },
        eligibilityModule: {
          sex: 'FEMALE',
          minimumAge: '18 Years',
          maximumAge: '65 Years',
        },
        sponsorCollaboratorsModule: {
          leadSponsor: { name: 'Acme Research' },
        },
        conditionsModule: {
          conditions: ['Diabetes'],
        },
        armsInterventionsModule: {
          interventions: [{ name: 'Metformin' }, { name: 'Placebo' }],
        },
      },
    } as any);

    expect(result).toEqual({
      nctId: 'NCT000001',
      briefTitle: 'Diabetes trial',
      phase: 'PHASE_2',
      studyType: 'INTERVENTIONAL',
      overallStatus: 'RECRUITING',
      enrollmentCount: 120,
      enrollmentType: 'ACTUAL',
      startDate: '2026-01-01',
      completionDate: '2027-01-01',
      conditions: ['Diabetes'],
      interventions: ['Metformin', 'Placebo'],
      sex: 'FEMALE',
      minimumAge: '18 Years',
      maximumAge: '65 Years',
      sponsor: 'Acme Research',
    });
  });

  it('applies fallback values for sparse studies and phase variants', () => {
    expect(service.normalizeForBenchmark({
      protocolSection: {
        identificationModule: { nctId: 'NCT000002', briefTitle: 'Sparse trial' },
      },
    } as any)).toEqual({
      nctId: 'NCT000002',
      briefTitle: 'Sparse trial',
      phase: 'NA',
      studyType: 'UNKNOWN',
      overallStatus: 'UNKNOWN',
      enrollmentCount: 0,
      enrollmentType: 'ESTIMATED',
      startDate: null,
      completionDate: null,
      conditions: [],
      interventions: [],
      sex: 'ALL',
      minimumAge: null,
      maximumAge: null,
      sponsor: null,
    });

    expect(service.normalizeForBenchmark({
      protocolSection: {
        identificationModule: { nctId: 'NCT000003', briefTitle: 'Early phase trial' },
        designModule: { phases: ['early phase 1'] },
      },
    } as any).phase).toBe('EARLY_PHASE_1');

    expect(service.normalizeForBenchmark({
      protocolSection: {
        identificationModule: { nctId: 'NCT000004', briefTitle: 'Custom phase trial' },
        designModule: { phases: ['expanded access'] },
      },
    } as any).phase).toBe('EXPANDED_ACCESS');
  });
});
