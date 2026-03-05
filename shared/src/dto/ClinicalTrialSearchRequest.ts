export interface ClinicalTrialSearchRequest {
  term?: string; // query.term
  condition?: string; // query.cond
  intervention?: string; // query.intr
  sponsor?: string; // query.spons
  investigator?: string; // query.invest
  location?: string; // query.locn
  overallStatus?: string; // filter.overallStatus
  studyType?: string; // filter.studyType
  phase?: string; // filter.phase
  interventionModel?: string; // filter.interventionModel
  primaryPurpose?: string; // filter.primaryPurpose
  sex?: string; // filter.sex 
  minAge?: number; // filter.minAge
  maxAge?: number; // filter.maxAge
  healthyVolunteers?: boolean; // filter.healthyVolunteers
  startDateFrom?: string; // filter.startDateFrom YYYY-MM-DD or YYYY-MM
  startDateTo?: string; // filter.startDateTo YYYY-MM-DD or YYYY-MM
  completionDateFrom?: string; // filter.completionDateFrom YYYY-MM-DD or YYYY-MM
  completionDateTo?: string; // filter.completionDateTo YYYY-MM-DD or YYYY-MM
  minEnrollment?: number; // filter.minEnrollment
  maxEnrollment?: number; // filter.maxEnrollment
  hasResults?: boolean; // filter.hasResults
  pageSize?: number;
  pageToken?: string;
  countTotal?: boolean;
}