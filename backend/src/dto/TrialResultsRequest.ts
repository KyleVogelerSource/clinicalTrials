export interface EligibilityCriterion {
  description: string;
  conceptId?: string | null;
}

export interface TrialResultsRequest {
  condition: string | null;
  phase: string | null;
  allocationType: string | null;
  interventionModel: string | null;
  blindingType: string | null;
  minAge: number | null;
  maxAge: number | null;
  sex: string | null;
  requiredConditions: string[];
  ineligibleConditions: string[];
  selectedTrialIds: string[];
  inclusionCriteria: EligibilityCriterion[];
  exclusionCriteria: EligibilityCriterion[];
}