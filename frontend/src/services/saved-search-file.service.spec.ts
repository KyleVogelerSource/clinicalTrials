import { describe, expect, it } from 'vitest';
import { buildSavedSearchesExportJson, parseSavedSearchesImportJson } from './saved-search-file.service';

describe('saved-search-file.service', () => {
  it('builds a saved-search export envelope', () => {
    const json = JSON.parse(buildSavedSearchesExportJson([
      {
        id: 1,
        ownerUserId: 1,
        ownerUsername: 'alice',
        name: 'Diabetes',
        description: 'desc',
        visibility: 'private',
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z',
        permissions: { isOwner: true, canView: true, canRun: true, canEdit: true },
        criteriaJson: { condition: 'Diabetes' },
      },
    ]));

    expect(json.format).toBe('clinicaltrials-saved-searches');
    expect(json.searches[0].name).toBe('Diabetes');
  });

  it('parses a saved-search import envelope', () => {
    expect(parseSavedSearchesImportJson(JSON.stringify({
      searches: [
        {
          name: 'Imported Search',
          description: null,
          visibility: 'private',
          criteriaJson: { condition: 'Diabetes' },
        },
      ],
    }))).toEqual([
      {
        name: 'Imported Search',
        description: null,
        visibility: 'private',
        criteriaJson: { condition: 'Diabetes' },
      },
    ]);
  });

  it('parses a designer-criteria export into one new saved search', () => {
    expect(parseSavedSearchesImportJson(JSON.stringify({
      format: 'clinicaltrials-designer-criteria',
      version: 1,
      criteria: {
        condition: 'Diabetes Mellitus, Type 2',
        phase: 'Phase 1',
        allocationType: 'Randomized',
      },
    }))).toEqual([
      {
        name: 'Diabetes Mellitus, Type 2 (Phase 1)',
        description: 'Imported from designer criteria',
        visibility: 'private',
        criteriaJson: {
          condition: 'Diabetes Mellitus, Type 2',
          phase: 'Phase 1',
          allocationType: 'Randomized',
        },
      },
    ]);
  });

  it('builds imported designer search names from condition only or fallback', () => {
    expect(parseSavedSearchesImportJson(JSON.stringify({
      format: 'clinicaltrials-designer-criteria',
      criteria: { condition: '  Asthma  ' },
    }))[0].name).toBe('Asthma');

    expect(parseSavedSearchesImportJson(JSON.stringify({
      format: 'clinicaltrials-designer-criteria',
      criteria: { sponsor: 'NIH' },
    }))[0].name).toBe('Imported Search');
  });

  it('parses bare saved-search arrays and stringifies descriptions', () => {
    expect(parseSavedSearchesImportJson(JSON.stringify([
      {
        name: 'Bare Import',
        description: 123,
        visibility: 'shared',
        criteriaJson: { condition: 'Asthma' },
      },
    ]))).toEqual([
      {
        name: 'Bare Import',
        description: '123',
        visibility: 'shared',
        criteriaJson: { condition: 'Asthma' },
      },
    ]);
  });

  it('rejects invalid saved-search import files', () => {
    expect(() => parseSavedSearchesImportJson(JSON.stringify({ searches: [] })))
      .toThrow('Saved search import requires a non-empty searches array.');
  });

  it('rejects malformed designer criteria and incomplete saved searches', () => {
    expect(() => parseSavedSearchesImportJson(JSON.stringify({
      format: 'clinicaltrials-designer-criteria',
      criteria: null,
    }))).toThrow('Designer criteria import requires a criteria object.');

    expect(() => parseSavedSearchesImportJson(JSON.stringify({
      searches: [{ name: 'Missing Criteria', visibility: 'private' }],
    }))).toThrow('Each imported saved search must include name, criteriaJson, and visibility.');
  });
});
