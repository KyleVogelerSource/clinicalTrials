import { describe, expect, it } from 'vitest';
import { MetricRow, ResultsModel, metricNames } from './results-model';

describe('results-model', () => {
  it('exposes metric extractors for every metric name', () => {
    const row = new MetricRow();
    row.totalEnrollment = 100;
    row.siteCount = 5;
    row.recruitmentVelocity = 2.5;
    row.inclusionStrictness = 3;
    row.exclusionStrictness = 4;
    row.siteEfficiency = 20;
    row.outcomeDensity = 6;
    row.ageSpan = 47;
    row.minAge = 18;
    row.maxAge = 65;
    row.interventionCount = 2;
    row.collaboratorCount = 1;
    row.duration = 365;
    row.maskingIntensity = 2;
    row.conditionCount = 1;
    row.armCount = 2;

    expect(Object.keys(MetricRow.metricExtractors)).toEqual(expect.arrayContaining(metricNames));
    expect(Object.keys(MetricRow.metricExtractors)).toContain('Exclusion Strictness');
    expect(MetricRow.metricExtractors['Total Enrollment'](row)).toBe(100);
    expect(MetricRow.metricExtractors['Site Count'](row)).toBe(5);
    expect(MetricRow.metricExtractors['Recruitment Velocity'](row)).toBe(2.5);
    expect(MetricRow.metricExtractors['Inclusion Strictness'](row)).toBe(3);
    expect(MetricRow.metricExtractors['Exclusion Strictness'](row)).toBe(4);
    expect(MetricRow.metricExtractors['Site Efficiency'](row)).toBe(20);
    expect(MetricRow.metricExtractors['Outcome Density'](row)).toBe(6);
    expect(MetricRow.metricExtractors['Age Span'](row)).toBe(47);
    expect(MetricRow.metricExtractors['Min Age'](row)).toBe(18);
    expect(MetricRow.metricExtractors['Max Age'](row)).toBe(65);
    expect(MetricRow.metricExtractors['Intervention Count'](row)).toBe(2);
    expect(MetricRow.metricExtractors['Collaborator Count'](row)).toBe(1);
    expect(MetricRow.metricExtractors['Duration (Days)'](row)).toBe(365);
    expect(MetricRow.metricExtractors['Masking Intensity'](row)).toBe(2);
    expect(MetricRow.metricExtractors['Condition Count'](row)).toBe(1);
    expect(MetricRow.metricExtractors['Arm Count'](row)).toBe(2);
  });

  it('initializes metric row defaults', () => {
    const row = new MetricRow();

    expect(row).toMatchObject({
      id: '',
      totalEnrollment: 0,
      siteCount: 0,
      recruitmentVelocity: 0,
      inclusionStrictness: 0,
      exclusionStrictness: 0,
      siteEfficiency: 0,
      outcomeDensity: 0,
      ageSpan: 0,
      minAge: 0,
      maxAge: 0,
      interventionCount: 0,
      collaboratorCount: 0,
      duration: 0,
      maskingIntensity: 0,
      conditionCount: 0,
      armCount: 0,
    });
  });

  it('initializes result model collections and metric names', () => {
    const model = new ResultsModel();

    expect(model.trialResults).toBeUndefined();
    expect(model.terminationReasons).toEqual([]);
    expect(model.siteLocations).toEqual([]);
    expect(model.topSites).toEqual([]);
    expect(model.metricRows).toEqual([]);
    expect(model.complitionBenchmarks).toEqual([]);
    expect(model.terminationBenchmarks).toEqual([]);
    expect(model.metricNames).toBe(metricNames);
  });
});
