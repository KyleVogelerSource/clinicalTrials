export interface ClinicalTrialSearchRequest {
  term?: string;               // query.term
  condition?: string;          // query.cond
  intervention?: string;       // query.intr
  sponsor?: string;            // query.spons
  investigator?: string;       // query.invest
  location?: string;           // query.locn
  overallStatus?: string;      // filter.overallStatus
  studyType?: string;          // filter.studyType
  phase?: string;              // filter.phase
  interventionModel?: string;  // filter.interventionModel
  primaryPurpose?: string;     // filter.primaryPurpose
  sex?: string;                // filter.sex
  minAge?: number;             // filter.age RANGE lower bound
  maxAge?: number;             // filter.age RANGE upper bound
  healthyVolunteers?: boolean; // filter.healthyVolunteers
  startDateFrom?: string;      // filter.startDate RANGE lower bound (YYYY-MM-DD or YYYY-MM)
  startDateTo?: string;        // filter.startDate RANGE upper bound (YYYY-MM-DD or YYYY-MM)
  completionDateFrom?: string; // filter.completionDate RANGE lower bound (YYYY-MM-DD or YYYY-MM)
  completionDateTo?: string;   // filter.completionDate RANGE upper bound (YYYY-MM-DD or YYYY-MM)
  minEnrollment?: number;      // filter.enrollment RANGE lower bound
  maxEnrollment?: number;      // filter.enrollment RANGE upper bound
  hasResults?: boolean;        // filter.hasResults
  pageSize?: number;           // pageSize (max 100)
  pageToken?: string;          // pageToken for pagination
}