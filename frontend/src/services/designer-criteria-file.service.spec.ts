import { describe, expect, it } from 'vitest';
import {
  buildDesignerExportJson,
  normalizeImportedCriteria,
  parseDesignerCriteriaFile,
} from './designer-criteria-file.service';

describe('designer-criteria-file.service', () => {
  const defaults = {
    phase: 'Phase 1',
    phases: ['Phase 1', 'Phase 2', 'Phase 3'],
    allocationType: 'N/A',
    allocations: ['N/A', 'Randomized'],
    interventionModels: ['Single Group Assignment', 'Parallel Assignment'],
    blindingType: 'None (Open Label)',
    blindingTypes: ['None (Open Label)', 'Double'],
    sex: 'All',
    sexes: ['All', 'Female', 'Male'],
  };

  it('builds a JSON export envelope for designer criteria', () => {
    const json = JSON.parse(buildDesignerExportJson({
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
      userPatients: null,
      userSites: null,
      userInclusions: null,
      userExclusions: null,
      userOutcomes: null,
      userArms: null,
      inclusionCriteria: [],
      exclusionCriteria: [],
    }));

    expect(json.format).toBe('clinicaltrials-designer-criteria');
    expect(json.criteria.condition).toBe('Diabetes');
  });

  it('parses a JSON import into designer criteria', () => {
    expect(parseDesignerCriteriaFile(JSON.stringify({
      criteria: {
        condition: 'Diabetes',
        phase: 'phase 3',
        allocationType: 'randomized',
        interventionModel: 'parallel assignment',
        blindingType: 'double',
        sex: 'female',
      },
    }), 'criteria.json', defaults)).toEqual({
      condition: 'Diabetes',
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

  it('rejects non-json imports', () => {
    expect(() => parseDesignerCriteriaFile('condition,phase\nDiabetes,Phase 3', 'criteria.csv', defaults))
      .toThrow('Unsupported criteria file format: criteria.csv');
  });

  it('normalizes imported criteria with defaults for missing values', () => {
    expect(normalizeImportedCriteria({ condition: 'Diabetes' }, defaults)).toEqual({
      condition: 'Diabetes',
      phase: 'Phase 1',
      allocationType: 'N/A',
      interventionModel: null,
      blindingType: 'None (Open Label)',
      minAge: null,
      maxAge: null,
      sex: 'All',
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
});