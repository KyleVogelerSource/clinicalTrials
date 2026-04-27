import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClinicalStudyService } from './clinical-study.service';
import { ResultsApiService } from './results-api.service';
import { TrialWorkflowService } from './trial-workflow-service';

describe('TrialWorkflowService', () => {
  let service: TrialWorkflowService;
  let clinicalStudyService: {
    searchStudies: ReturnType<typeof vi.fn>;
  };
  let resultsApiService: {
    getResults: ReturnType<typeof vi.fn>;
  };

  const designModel = {
    condition: 'Type 2 Diabetes',
    phase: 'Phase 2',
    allocationType: 'Randomized',
    interventionModel: 'Parallel Assignment',
    blindingType: 'Double',
    minAge: 18,
    maxAge: 65,
    sex: 'All',
    required: ['Obesity'],
    ineligible: ['Pregnancy'],
    startDateFrom: null,
    startDateTo: null,
    userPatients: null,
    userSites: null,
    userInclusions: null,
    userExclusions: null,
    userOutcomes: null,
    userArms: null,
    inclusionCriteria: [],
    exclusionCriteria: [],
  };

  const study = {
    protocolSection: {
      identificationModule: { nctId: 'NCT100', briefTitle: 'Diabetes Trial' },
      conditionsModule: { conditions: ['Type 2 Diabetes'] },
      designModule: {
        enrollmentInfo: { count: 200 },
        phases: ['PHASE2'],
        designInfo: { maskingInfo: { whoMasked: ['Participant', 'Investigator'] } },
      },
      contactsLocationsModule: {
        locations: [
          {
            facility: 'Boston Medical Center',
            city: 'Boston',
            country: 'USA',
            geoPoint: { lat: 42.36, lon: -71.05 },
          },
        ],
      },
      sponsorCollaboratorsModule: {
        leadSponsor: { name: 'NIH' },
        collaborators: [{ name: 'Partner A' }, { name: 'Partner B' }],
      },
      statusModule: {
        overallStatus: 'Completed',
        startDateStruct: { date: '2024-01-01' },
        completionDateStruct: { date: '2024-04-10' },
        primaryCompletionDateStruct: { date: '2024-04-10' },
      },
      descriptionModule: { briefSummary: 'Summary' },
      eligibilityModule: {
        eligibilityCriteria: 'Adults with Type 2 Diabetes',
        minimumAge: '18 Years',
        maximumAge: '65 Years',
      },
      outcomesModule: {
        primaryOutcomes: [{ measure: 'A1C' }],
        secondaryOutcomes: [{ measure: 'Weight' }],
      },
      armsInterventionsModule: {
        interventions: [{ name: 'Drug A' }, { name: 'Lifestyle' }],
      },
    },
  } as any;

  beforeEach(() => {
    clinicalStudyService = {
      searchStudies: vi.fn(),
    };
    resultsApiService = {
      getResults: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        TrialWorkflowService,
        { provide: ClinicalStudyService, useValue: clinicalStudyService },
        { provide: ResultsApiService, useValue: resultsApiService },
      ],
    });

    service = TestBed.inject(TrialWorkflowService);
  });

  it('does nothing when searchTrials is called without inputs', () => {
    service.searchTrials();

    expect(clinicalStudyService.searchStudies).not.toHaveBeenCalled();
  });

  it('maps designer inputs into a search request and stores found trials', () => {
    clinicalStudyService.searchStudies.mockReturnValue(of({
      totalCount: 1,
      studies: [study],
    }));
    service.selectedTrialIds.set(['legacy']);
    service.setInputs(designModel);

    service.searchTrials();

    expect(clinicalStudyService.searchStudies).toHaveBeenCalledWith(expect.objectContaining({
      condition: 'Type 2 Diabetes',
      phase: 'PHASE2',
      interventionModel: 'PARALLEL',
      sex: 'All',
      pageSize: 100,
    }));
    expect(service.foundTrials()).toEqual([
      expect.objectContaining({
        nctId: 'NCT100',
        briefTitle: 'Diabetes Trial',
        location: 'Boston, USA',
        sponsor: 'NIH',
      }),
    ]);
    expect(service.selectedTrialIds()).toEqual([]);
  });

  it('processes selected trials into local metrics and requests AI results', () => {
    clinicalStudyService.searchStudies.mockReturnValue(of({
      totalCount: 1,
      studies: [study],
    }));
    resultsApiService.getResults.mockReturnValue(of({
      overallScore: 77,
      totalTrialsFound: 1,
      queryCondition: 'Type 2 Diabetes',
      terminationReasons: [],
      avgRecruitmentDays: 100,
      participantTarget: 200,
      recruitmentByImpact: [],
      timelineBuckets: [],
      generatedAt: '2026-04-17T00:00:00.000Z',
    }));
    service.setInputs(designModel);
    service.searchTrials();
    service.selectedTrialIds.set(['NCT100']);

    service.processResults();

    expect(resultsApiService.getResults).toHaveBeenCalledWith(
      expect.objectContaining({
        condition: 'Type 2 Diabetes',
        phase: 'Phase 2',
        allocationType: 'Randomized',
        interventionModel: 'Parallel Assignment',
        selectedTrialIds: ['NCT100'],
      }),
      expect.any(Array)
    );
    expect(service.results().terminationReasons).toEqual([{ reason: 'Completed', count: 1 }]);
    expect(service.results().siteLocations).toEqual([{ latitude: 42.36, longitude: -71.05, label: "Boston Medical Center", subLabel: "Boston, USA" }]);
    expect(service.results().metricRows[0]).toEqual(expect.objectContaining({
      id: 'NCT100',
      totalEnrollment: 200,
      siteCount: 1,
      interventionCount: 2,
      collaboratorCount: 2,
      maskingIntensity: 2,
      conditionCount: 1,
    }));
    expect(service.results().trialResults?.overallScore).toBe(77);
  });

  it('returns undefined from createResultsRequest when no input exists', () => {
    expect(service.createResultsRequest()).toBeUndefined();
  });

  it('creates a result request from the current workflow state', () => {
    service.setInputs(designModel);
    service.selectedTrialIds.set(['NCT100', 'NCT200']);

    expect(service.createResultsRequest()).toEqual({
      condition: 'Type 2 Diabetes',
      phase: 'Phase 2',
      allocationType: 'Randomized',
      interventionModel: 'Parallel Assignment',
      blindingType: 'Double',
      minAge: 18,
      maxAge: 65,
      sex: 'All',
      requiredConditions: ['Obesity'],
      ineligibleConditions: ['Pregnancy'],
      selectedTrialIds: ['NCT100', 'NCT200'],
      inclusionCriteria: [],
      exclusionCriteria: [],
    });
  });

  it('resets workflow state back to defaults', () => {
    service.setInputs(designModel);
    service.foundTrials.set([{ nctId: 'NCT100' } as any]);
    service.filterWords.set(['diabetes']);
    service.fromDate.set('2024-01-01');
    service.toDate.set('2024-12-31');
    service.setImportNotice('Imported criteria.json');
    service.selectedTrialIds.set(['NCT100']);

    service.reset();

    expect(service.inputParams()).toBeNull();
    expect(service.foundTrials()).toEqual([]);
    expect(service.filterWords()).toEqual([]);
    expect(service.fromDate()).toBe('');
    expect(service.toDate()).toBe('');
    expect(service.importNotice()).toBeNull();
    expect(service.selectedTrialIds()).toEqual([]);
    expect(service.results().metricRows).toEqual([]);
  });

  it('stores and clears the import notice', () => {
    service.setInputs(designModel);
    service.setImportNotice('Imported from criteria.json');

    expect(service.importNotice()).toBe('Imported from criteria.json');

    service.setImportNotice(null);
    expect(service.importNotice()).toBeNull();
  });
});
