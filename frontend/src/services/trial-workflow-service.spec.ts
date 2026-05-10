import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClinicalStudyService } from './clinical-study.service';
import { LoadingService } from './loading.service';
import { ResultsApiService } from './results-api.service';
import { TrialWorkflowService } from './trial-workflow-service';

describe('TrialWorkflowService', () => {
  let service: TrialWorkflowService;
  let clinicalStudyService: {
    searchStudies: ReturnType<typeof vi.fn>;
    getPhases: ReturnType<typeof vi.fn>;
    getAllocations: ReturnType<typeof vi.fn>;
    getInterventionModels: ReturnType<typeof vi.fn>;
    getMaskingTypes: ReturnType<typeof vi.fn>;
  };
  let resultsApiService: {
    getResults: ReturnType<typeof vi.fn>;
  };
  let loadingService: LoadingService;

  const designModel = {
    condition: 'Type 2 Diabetes',
    phase: ['Phase 2'],
    allocationType: ['Randomized'],
    interventionModel: ['Parallel Assignment'],
    blindingType: ['Double'],
    minAge: 18,
    maxAge: 65,
    sex: 'All',
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
        armGroups: [{ armGroupLabel: 'Arm A' }, { armGroupLabel: 'Arm B' }],
        interventions: [{ name: 'Drug A' }, { name: 'Lifestyle' }],
      },
    },
  } as any;

  beforeEach(() => {
    clinicalStudyService = {
      searchStudies: vi.fn(),
      getPhases: vi.fn().mockReturnValue(['Phase 1', 'Phase 2', 'Phase 3']),
      getAllocations: vi.fn().mockReturnValue(['Randomized', 'Non-Randomized', 'N/A']),
      getInterventionModels: vi.fn().mockReturnValue(['Single Group Assignment', 'Parallel Assignment']),
      getMaskingTypes: vi.fn().mockReturnValue(['None (Open Label)', 'Single', 'Double', 'Triple', 'Quadruple']),
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
    loadingService = TestBed.inject(LoadingService);
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

    expect(clinicalStudyService.searchStudies).toHaveBeenCalledWith({
      condition: 'Type 2 Diabetes',
      phase: 'PHASE2',
      allocationType: 'RANDOMIZED',
      interventionModel: 'PARALLEL',
      blindingType: 'DOUBLE',
      sex: 'ALL',
      pageSize: 100,
      minAge: 18,
      maxAge: 65,
      selectedTrialIds: [],
      userArms: null,
      userExclusions: null,
      userInclusions: null,
      userOutcomes: null,
      userPatients: null,
      userSites: null,
    });
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

  it('skips searches with incomplete criteria and clears found trials', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    service.foundTrials.set([{ nctId: 'existing' } as any]);
    service.setInputs({
      ...designModel,
      condition: 'D',
      phase: [],
    });

    service.searchTrials();

    expect(clinicalStudyService.searchStudies).not.toHaveBeenCalled();
    expect(service.foundTrials()).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      'Skipping search: missing or incomplete criteria',
      { hasCondition: false, hasPhase: false }
    );
  });

  it('clears found trials and hides the loader when search fails', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    clinicalStudyService.searchStudies.mockReturnValue(throwError(() => new Error('search failed')));
    service.foundTrials.set([{ nctId: 'existing' } as any]);
    service.setInputs(designModel);

    service.searchTrials();

    expect(errorSpy).toHaveBeenCalledWith('Failed to search trials:', expect.any(Error));
    expect(service.foundTrials()).toEqual([]);
    expect(loadingService.isLoading()).toBe(false);
  });

  it('searchTrialsV2 maps studies and caches them without mutating selections', async () => {
    clinicalStudyService.searchStudies.mockReturnValue(of({
      totalCount: 1,
      studies: [study],
    }));
    service.selectedTrialIds.set(['NCT100']);

    const mapped = await firstValueFrom(service.searchTrialsV2({ condition: 'diabetes' }));

    expect(mapped).toEqual([
      expect.objectContaining({
        nctId: 'NCT100',
        location: 'Boston, USA',
      }),
    ]);
    expect(service.selectedTrialIds()).toEqual(['NCT100']);
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
      estimatedDurationDays: 100,
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
      armCount: 2,
      collaboratorCount: 2,
      maskingIntensity: 2,
      conditionCount: 1,
    }));
    expect(service.results().trialResults?.overallScore).toBe(77);
  });

  it('processes local metrics without requesting AI when skipAi is true', () => {
    clinicalStudyService.searchStudies.mockReturnValue(of({
      totalCount: 1,
      studies: [study],
    }));
    service.setInputs(designModel);
    service.searchTrials();
    service.selectedTrialIds.set(['NCT100']);

    service.processResultsV2(true);

    expect(resultsApiService.getResults).not.toHaveBeenCalled();
    expect(service.results().trialResults?.totalTrialsFound).toBe(1);
  });

  it('uses explanation text from AI results and preserves local metrics', () => {
    clinicalStudyService.searchStudies.mockReturnValue(of({
      totalCount: 1,
      studies: [study],
    }));
    resultsApiService.getResults.mockReturnValue(of({
      overallScore: 91,
      totalTrialsFound: 1,
      queryCondition: 'Type 2 Diabetes',
      terminationReasons: [],
      estimatedDurationDays: 1,
      participantTarget: 1,
      recruitmentByImpact: [],
      timelineBuckets: [],
      explanation: { explanation: 'Detailed AI summary.', generatedAt: '2026-04-17T00:00:00.000Z' },
      generatedAt: '2026-04-17T00:00:00.000Z',
    }));
    service.setInputs({ ...designModel, userPatients: 200, userSites: 1 });
    service.searchTrials();
    service.selectedTrialIds.set(['NCT100']);

    service.processResults();

    expect(service.results().trialResults).toEqual(
      expect.objectContaining({
        overallSummary: 'Detailed AI summary.',
        estimatedDurationDays: 100,
        participantTarget: 200,
        siteCountTarget: 1,
      })
    );
    expect(service.isAILoading()).toBe(false);
  });

  it('sets fallback summary when AI result has no summary and marks failures on AI errors', () => {
    clinicalStudyService.searchStudies.mockReturnValue(of({
      totalCount: 1,
      studies: [study],
    }));
    service.setInputs(designModel);
    service.searchTrials();
    service.selectedTrialIds.set(['NCT100']);

    resultsApiService.getResults.mockReturnValueOnce(of({
      overallScore: 40,
      totalTrialsFound: 1,
      queryCondition: 'Type 2 Diabetes',
      terminationReasons: [],
      estimatedDurationDays: 1,
      participantTarget: 1,
      recruitmentByImpact: [],
      timelineBuckets: [],
      generatedAt: '2026-04-17T00:00:00.000Z',
    }));
    service.processResults();
    expect(service.results().trialResults?.overallSummary).toBe('Analysis completed, but no detailed summary was provided by the AI.');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    resultsApiService.getResults.mockReturnValueOnce(throwError(() => new Error('AI failed')));
    service.processResults();

    expect(errorSpy).toHaveBeenCalledWith('AI Results failed', expect.any(Error));
    expect(service.results().trialResults?.overallSummary).toBe('Failed to load detailed AI analysis.');
    expect(service.isAILoading()).toBe(false);
  });

  it('selects the best site name using consensus and length penalty', () => {
    // Two trials with sites at the exact same coordinates but different names
    const study1 = {
      ...study,
      protocolSection: {
        ...study.protocolSection,
        identificationModule: { nctId: 'NCT_SITE_1', briefTitle: 'Trial 1' },
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
      }
    } as any;

    const study2 = {
      ...study,
      protocolSection: {
        ...study.protocolSection,
        identificationModule: { nctId: 'NCT_SITE_2', briefTitle: 'Trial 2' },
        contactsLocationsModule: {
          locations: [
            {
              facility: 'BMC Health System - For more information about our clinical trials program please visit our website at bmc.org/research',
              city: 'Boston',
              country: 'USA',
              geoPoint: { lat: 42.36, lon: -71.05 },
            },
            {
              facility: 'Boston Medical Center Research',
              city: 'Boston',
              country: 'USA',
              geoPoint: { lat: 42.36, lon: -71.05 },
            }
          ],
        },
      }
    } as any;

    clinicalStudyService.searchStudies.mockReturnValue(of({
      totalCount: 2,
      studies: [study1, study2],
    }));
    resultsApiService.getResults.mockReturnValue(of({}));
    
    service.setInputs(designModel);
    service.searchTrials();
    service.selectedTrialIds.set(['NCT_SITE_1', 'NCT_SITE_2']);

    service.processResults();

    const siteLocations = service.results().siteLocations;
    // Both trials point to the same 42.36, -71.05 coordinate
    // Names available: "Boston Medical Center", "BMC Health System - For more information...", "Boston Medical Center Research"
    // "Boston Medical Center" and "Boston Medical Center Research" share words "Boston", "Medical", "Center".
    // "Boston Medical Center" should win due to consensus and better length than the verbose one.
    
    const bmcLocation = siteLocations.find(l => l.latitude === 42.36 && l.longitude === -71.05);
    expect(bmcLocation?.label).toBe('Boston Medical Center');
    expect(bmcLocation?.label).not.toContain('For more information');
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
