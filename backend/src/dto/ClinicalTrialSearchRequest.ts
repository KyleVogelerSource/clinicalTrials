export interface ClinicalTrialSearchRequest {
  term?: string;
  condition?: string;
  intervention?: string;
  sponsor?: string;
  investigator?: string;
  location?: string;
  overallStatus?: string;
  studyType?: string;
  phase?: string;
  allocationType?: string;
  interventionModel?: string;
  blindingType?: string;
  primaryPurpose?: string;
  sex?: string;
  minAge?: number;
  maxAge?: number;
  healthyVolunteers?: boolean;
  startDateFrom?: string;
  startDateTo?: string;
  completionDateFrom?: string;
  completionDateTo?: string;
  minEnrollment?: number;
  maxEnrollment?: number;
  hasResults?: boolean;
  pageSize?: number;
  pageToken?: string;
  countTotal?: boolean;
  requiredConditions?: string[];
  ineligibleConditions?: string[];

  // User Trial Specifics
  userPatients?: number | null;
  userSites?: number | null;
  userInclusions?: number | null;
  userExclusions?: number | null;
  userOutcomes?: number | null;
  userArms?: number | null;
}
