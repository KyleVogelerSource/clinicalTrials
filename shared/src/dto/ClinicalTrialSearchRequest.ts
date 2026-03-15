export interface ClinicalTrialSearchRequest {
  term?: string;               // query.term
  condition?: string;          // query.cond
  intervention?: string;       // query.intr
  sponsor?: string;            // query.spons
  investigator?: string;       // query.invest
  location?: string;           // query.locn
  overallStatus?: string;      // filter.overallStatus
  studyType?: string;          // filter.advanced AREA[StudyType]
  phase?: string;              // filter.advanced AREA[Phase]
  interventionModel?: string;  // filter.advanced AREA[InterventionModel]
  primaryPurpose?: string;     // filter.advanced AREA[PrimaryPurpose]
  sex?: string;                // filter.advanced AREA[Sex]
  minAge?: number;             // filter.advanced AREA[MinimumAge] RANGE lower bound
  maxAge?: number;             // filter.advanced AREA[MinimumAge] RANGE upper bound
  healthyVolunteers?: boolean; // filter.advanced AREA[HealthyVolunteers]
  startDateFrom?: string;      // filter.advanced AREA[StartDate] RANGE lower bound (YYYY-MM-DD or YYYY-MM)
  startDateTo?: string;        // filter.advanced AREA[StartDate] RANGE upper bound (YYYY-MM-DD or YYYY-MM)
  completionDateFrom?: string; // filter.advanced AREA[CompletionDate] RANGE lower bound (YYYY-MM-DD or YYYY-MM)
  completionDateTo?: string;   // filter.advanced AREA[CompletionDate] RANGE upper bound (YYYY-MM-DD or YYYY-MM)
  minEnrollment?: number;      // filter.advanced AREA[EnrollmentCount] RANGE lower bound
  maxEnrollment?: number;      // filter.advanced AREA[EnrollmentCount] RANGE upper bound
  hasResults?: boolean;        // filter.advanced AREA[HasResults]
  pageSize?: number;           // pageSize (max 100)
  pageToken?: string;          // pageToken for pagination
  countTotal?: boolean;        // countTotal - request total match count in response
}