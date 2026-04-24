import { describe, expect, it } from 'vitest';
import {
  mapDesignModelToSavedSearchCriteria,
  mapDesignModelToExecutionSearchRequest,
  mapSavedSearchCriteriaToDesignModel,
} from './saved-search-criteria-mapper';

describe('saved-search-criteria-mapper', () => {
  it('maps a designer model into saved-search criteria', () => {
    expect(
      mapDesignModelToSavedSearchCriteria({
        condition: 'Diabetes',
        phase: 'Phase 3',
        allocationType: 'Randomized',
        interventionModel: 'Parallel Assignment',
        blindingType: 'Double',
        minAge: 18,
        maxAge: 65,
        sex: 'Female',
        required: ['Hypertension'],
        ineligible: ['Heart Failure'],
      })
    ).toEqual({
      condition: 'Diabetes',
      phase: 'Phase 3',
      allocationType: 'Randomized',
      interventionModel: 'Parallel Assignment',
      blindingType: 'Double',
      minAge: 18,
      maxAge: 65,
      sex: 'Female',
      requiredConditions: ['Hypertension'],
      ineligibleConditions: ['Heart Failure'],
    });
  });

  it('maps saved-search criteria back into the designer model with defaults for missing fields', () => {
    expect(
      mapSavedSearchCriteriaToDesignModel(
        {
          condition: 'Diabetes',
          phase: 'Phase 2',
          requiredConditions: ['Hypertension'],
        },
        {
          phase: 'Phase 1',
          allocationType: 'N/A',
          phases: ['Phase 1', 'Phase 2', 'Phase 3'],
          allocations: ['N/A', 'Randomized'],
          interventionModels: ['Single Group Assignment', 'Parallel Assignment'],
          blindingType: 'None (Open Label)',
          blindingTypes: ['None (Open Label)', 'Double'],
          sex: 'All',
          sexes: ['All', 'Female', 'Male'],
        }
      )
    ).toEqual({
      condition: 'Diabetes',
      phase: 'Phase 2',
      allocationType: 'N/A',
      interventionModel: null,
      blindingType: 'None (Open Label)',
      minAge: null,
      maxAge: null,
      sex: 'All',
      required: ['Hypertension'],
      ineligible: [],
      userPatients: null,
      userSites: null,
      userInclusions: null,
      userExclusions: null,
      userOutcomes: null,
      userArms: null,
      inclusionCriteria: [],
      exclusionCriteria: [],
    });
  });

  it('maps normalized lowercase saved-search criteria back to matching designer options', () => {
    expect(
      mapSavedSearchCriteriaToDesignModel(
        {
          condition: 'diabetes type 2',
          phase: 'phase 3',
          allocationType: 'randomized',
          interventionModel: 'parallel assignment',
          blindingType: 'double',
          sex: 'female',
        },
        {
          phase: 'Phase 1',
          allocationType: 'N/A',
          phases: ['Phase 1', 'Phase 2', 'Phase 3'],
          allocations: ['N/A', 'Randomized'],
          interventionModels: ['Single Group Assignment', 'Parallel Assignment'],
          blindingType: 'None (Open Label)',
          blindingTypes: ['None (Open Label)', 'Double'],
          sex: 'All',
          sexes: ['All', 'Female', 'Male'],
        }
      )
    ).toEqual({
      condition: 'diabetes type 2',
      phase: 'Phase 3',
      allocationType: 'Randomized',
      interventionModel: 'Parallel Assignment',
      blindingType: 'Double',
      minAge: null,
      maxAge: null,
      sex: 'Female',
      required: [],
      ineligible: [],
      userPatients: null,
      userSites: null,
      userInclusions: null,
      userExclusions: null,
      userOutcomes: null,
      userArms: null,
      inclusionCriteria: [],
      exclusionCriteria: [],
    });
  });

  it('maps a designer model into an execution search request using label translations', () => {
    expect(
      mapDesignModelToExecutionSearchRequest(
        {
          condition: 'Diabetes',
          phase: 'Phase 3',
          allocationType: 'Randomized',
          interventionModel: 'Parallel Assignment',
          blindingType: 'Double',
          sex: 'Female',
          required: ['Hypertension'],
          ineligible: ['Heart Failure'],
        },
        {
          phaseByLabel: { 'Phase 3': 'PHASE3' },
          interventionModelByLabel: { 'Parallel Assignment': 'PARALLEL' },
        }
      )
    ).toEqual({
      condition: 'Diabetes',
      phase: 'PHASE3',
      allocationType: 'Randomized',
      interventionModel: 'PARALLEL',
      blindingType: 'Double',
      sex: 'Female',
      requiredConditions: ['Hypertension'],
      ineligibleConditions: ['Heart Failure'],
    });
  });
});