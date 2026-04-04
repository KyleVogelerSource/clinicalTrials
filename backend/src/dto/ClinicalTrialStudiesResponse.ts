export interface ClinicalTrialStudiesResponse {
  totalCount: number;
  studies: ClinicalTrialStudy[];
  nextPageToken?: string;
}

export interface ClinicalTrialStudy {
  protocolSection: ProtocolSection;
  derivedSection?: DerivedSection;
  hasResults?: boolean;
}

export interface ProtocolSection {
  identificationModule: IdentificationModule;
  statusModule?: StatusModule;
  sponsorCollaboratorsModule?: SponsorCollaboratorsModule;
  oversightModule?: OversightModule;
  descriptionModule?: DescriptionModule;
  conditionsModule?: ConditionsModule;
  designModule?: DesignModule;
  armsInterventionsModule?: ArmsInterventionsModule;
  outcomesModule?: OutcomesModule;
  eligibilityModule?: EligibilityModule;
  contactsLocationsModule?: ContactsLocationsModule;
  referencesModule?: ReferencesModule;
}

export interface IdentificationModule {
  nctId: string;
  orgStudyIdInfo?: {
    id: string;
  };
  organization?: {
    fullName?: string;
    class?: string;
  };
  briefTitle: string;
  officialTitle?: string;
  acronym?: string;
}

export interface StatusModule {
  statusVerifiedDate?: string;
  overallStatus?: string;
  whyStopped?: string;
  expandedAccessInfo?: {
    hasExpandedAccess?: boolean;
  };

  startDateStruct?: DateStruct;
  primaryCompletionDateStruct?: DateStructWithType;
  completionDateStruct?: DateStructWithType;

  studyFirstSubmitDate?: string;
  studyFirstSubmitQcDate?: string;
  studyFirstPostDateStruct?: DateStructWithType;

  lastUpdateSubmitDate?: string;
  lastUpdatePostDateStruct?: DateStructWithType;
}

export interface DateStruct {
  date: string;
}

export interface DateStructWithType extends DateStruct {
  type?: string;
}

export interface SponsorCollaboratorsModule {
  responsibleParty?: ResponsibleParty;
  leadSponsor?: SponsorOrganization;
  collaborators?: SponsorOrganization[];
}

export interface ResponsibleParty {
  type?: string;
  investigatorFullName?: string;
  investigatorTitle?: string;
  investigatorAffiliation?: string;
}

export interface SponsorOrganization {
  name?: string;
  class?: string;
}

export interface OversightModule {
  oversightHasDmc?: boolean;
}

export interface DescriptionModule {
  briefSummary?: string;
  detailedDescription?: string;
}

export interface ConditionsModule {
  conditions?: string[];
  keywords?: string[];
}

export interface DesignModule {
  studyType?: string;
  phases?: string[];
  designInfo?: DesignInfo;
  enrollmentInfo?: EnrollmentInfo;
}

export interface DesignInfo {
  allocation?: string;
  interventionModel?: string;
  primaryPurpose?: string;
  maskingInfo?: MaskingInfo;
}

export interface MaskingInfo {
  masking?: string;
  whoMasked?: string[];
}

export interface EnrollmentInfo {
  count?: number;
  type?: string;
}

export interface ArmsInterventionsModule {
  armGroups?: ArmGroup[];
  interventions?: Intervention[];
}

export interface ArmGroup {
  label?: string;
  type?: string;
  description?: string;
  interventionNames?: string[];
}

export interface Intervention {
  type?: string;
  name?: string;
  description?: string;
  armGroupLabels?: string[];
}

export interface OutcomesModule {
  primaryOutcomes?: Outcome[];
  secondaryOutcomes?: Outcome[];
}

export interface Outcome {
  measure?: string;
  timeFrame?: string;
}

export interface EligibilityModule {
  eligibilityCriteria?: string;
  healthyVolunteers?: boolean;
  sex?: string;
  minimumAge?: string;
  maximumAge?: string;
  stdAges?: string[];
}

export interface ContactsLocationsModule {
  overallOfficials?: OverallOfficial[];
  locations?: Location[];
}

export interface OverallOfficial {
  name?: string;
  affiliation?: string;
  role?: string;
}

export interface Location {
  facility?: string;
  city?: string;
  zip?: string;
  country?: string;
  geoPoint?: GeoPoint;
}

export interface GeoPoint {
  lat?: number;
  lon?: number;
}

export interface ReferencesModule {
  references?: Reference[];
}

export interface Reference {
  pmid?: string;
  type?: string;
  citation?: string;
}

export interface DerivedSection {
  miscInfoModule?: {
    versionHolder?: string;
  };
  conditionBrowseModule?: ConditionBrowseModule;
}

export interface ConditionBrowseModule {
  meshes?: MeshTerm[];
  ancestors?: MeshTerm[];
}

export interface MeshTerm {
  id?: string;
  term?: string;
}
