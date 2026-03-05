// Comprehensive OpenAPI Study Data Models
// Based on https://clinicaltrials.gov/data-api/

// Basic Types
export type NormalizedDate = string; // yyyy-MM-dd
export type PartialDate = string; // yyyy, yyyy-MM, or yyyy-MM-dd
export type NormalizedTime = string;
export type DateTimeMinutes = string; // yyyy-MM-dd'T'HH:mm

export interface GeoPoint {
  lat: number;
  lon: number;
}

// Identification Module
export interface IdentificationModule {
  nctId: string;
  nctIdAliases?: string[];
  orgStudyIdInfo?: OrgStudyIdInfo;
  secondaryIdInfos?: SecondaryIdInfo[];
  briefTitle: string;
  officialTitle?: string;
  acronym?: string;
  organization?: Organization;
}

export interface OrgStudyIdInfo {
  id: string;
  type?: string;
  link?: string;
}

export interface SecondaryIdInfo {
  id: string;
  type?: string;
  domain?: string;
  link?: string;
}

export interface Organization {
  fullName: string;
  class?: string; // AgencyClass enum
}

// Status Module
export interface StatusModule {
  statusVerifiedDate?: PartialDate;
  overallStatus: string; // Status enum
  lastKnownStatus?: string;
  delayedPosting?: boolean;
  whyStopped?: string;
  expandedAccessInfo?: ExpandedAccessInfo;
  startDateStruct?: DateStruct;
  primaryCompletionDateStruct?: DateStruct;
  completionDateStruct?: DateStruct;
  studyFirstSubmitDate?: NormalizedDate;
  studyFirstSubmitQcDate?: NormalizedDate;
  studyFirstPostDateStruct?: DateStruct;
  resultsWaived?: boolean;
  resultsFirstSubmitDate?: NormalizedDate;
  resultsFirstSubmitQcDate?: NormalizedDate;
  resultsFirstPostDateStruct?: DateStruct;
  dispFirstSubmitDate?: NormalizedDate;
  dispFirstSubmitQcDate?: NormalizedDate;
  dispFirstPostDateStruct?: DateStruct;
  lastUpdateSubmitDate?: NormalizedDate;
  lastUpdatePostDateStruct?: DateStruct;
}

export interface DateStruct {
  date?: PartialDate;
  type?: string; // DateType enum: ACTUAL, ESTIMATED
}

export interface ExpandedAccessInfo {
  hasExpandedAccess?: boolean;
  nctId?: string;
  statusForNctId?: string;
}

// Sponsor/Collaborators Module
export interface SponsorCollaboratorsModule {
  responsibleParty?: ResponsibleParty;
  leadSponsor: Sponsor;
  collaborators?: Sponsor[];
}

export interface ResponsibleParty {
  type: string; // ResponsiblePartyType enum
  investigatorFullName?: string;
  investigatorTitle?: string;
  investigatorAffiliation?: string;
  oldNameTitle?: string;
  oldOrganization?: string;
}

export interface Sponsor {
  name: string;
  class: string; // AgencyClass enum
}

// Oversight Module
export interface OversightModule {
  oversightHasDmc?: boolean;
  isFdaRegulatedDrug?: boolean;
  isFdaRegulatedDevice?: boolean;
  isUnapprovedDevice?: boolean;
  isPpsd?: boolean;
  isUsExport?: boolean;
  fdaaa801Violation?: boolean;
}

// Description Module
export interface DescriptionModule {
  briefSummary?: string;
  detailedDescription?: string;
}

// Conditions Module
export interface ConditionsModule {
  conditions?: string[];
  keywords?: string[];
}

// Design Module
export interface DesignModule {
  studyType: string; // StudyType enum
  phase?: string[]; // Phase enum
  designInfo?: DesignInfo;
  enrollmentInfo?: EnrollmentInfo;
  bioSpec?: BioSpec;
  targetDuration?: NormalizedTime;
  expandedAccessTypes?: ExpandedAccessTypes;
  patientRegistry?: boolean;
  nPtrsToThisExpAccNctId?: number;
}

export interface DesignInfo {
  allocation?: string; // DesignAllocation enum
  interventionModel?: string; // InterventionalAssignment enum
  interventionModelDescription?: string;
  primaryPurpose?: string; // PrimaryPurpose enum
  observationalModel?: string; // ObservationalModel enum
  timePerspective?: string; // DesignTimePerspective enum
  maskingInfo?: MaskingBlock;
}

export interface MaskingBlock {
  masking?: string; // DesignMasking enum
  maskingDescription?: string;
  whoMasked?: string[]; // WhoMasked enum
}

export interface EnrollmentInfo {
  count: number;
  type: string; // EnrollmentType enum: ACTUAL, ESTIMATED
}

export interface BioSpec {
  retention?: string; // BioSpecRetention enum
  description?: string;
}

export interface ExpandedAccessTypes {
  individual?: boolean;
  intermediate?: boolean;
  treatment?: boolean;
}

// Arms/Interventions Module
export interface ArmsInterventionsModule {
  armGroups?: ArmGroup[];
  interventions?: Intervention[];
}

export interface ArmGroup {
  label: string;
  type: string; // ArmGroupType enum
  description?: string;
  interventionNames?: string[];
}

export interface Intervention {
  type: string; // InterventionType enum
  name: string;
  description?: string;
  otherNames?: string[];
  armGroupLabels?: string[];
}

// Outcomes Module
export interface OutcomesModule {
  primaryOutcomes?: Outcome[];
  secondaryOutcomes?: Outcome[];
  otherOutcomes?: Outcome[];
}

export interface Outcome {
  measure: string;
  timeFrame?: string;
  description?: string;
}

// Eligibility Module
export interface EligibilityModule {
  eligibilityCriteria?: string;
  healthyVolunteers?: boolean;
  sex?: string; // Sex enum: FEMALE, MALE, ALL
  genderBased?: boolean;
  genderDescription?: string;
  minimumAge?: NormalizedTime;
  maximumAge?: NormalizedTime;
  stdAges?: string[]; // StandardAge enum
  studyPopulation?: string;
  samplingMethod?: string; // SamplingMethod enum
}

// Contacts/Locations Module
export interface ContactsLocationsModule {
  centralContacts?: Contact[];
  overallOfficials?: Official[];
  locations?: Location[];
}

export interface Contact {
  name?: string;
  role?: string; // ContactRole enum
  phone?: string;
  phoneExt?: string;
  email?: string;
}

export interface Official {
  name: string;
  affiliation?: string;
  role: string; // OfficialRole enum
}

export interface Location {
  facility?: string;
  status?: string; // RecruitmentStatus enum
  city?: string;
  state?: string;
  zip?: string;
  country: string;
  countryCode?: string;
  geoPoint?: GeoPoint;
  contacts?: Contact[];
}

// References Module
export interface ReferencesModule {
  references?: Reference[];
  seeAlsoLinks?: SeeAlsoLink[];
  availIpds?: AvailIpd[];
}

export interface Reference {
  pmid?: string;
  type?: string; // ReferenceType enum
  citation?: string;
  retractions?: Retraction[];
}

export interface Retraction {
  pmid?: string;
  source?: string;
}

export interface SeeAlsoLink {
  label?: string;
  url?: string;
}

export interface AvailIpd {
  id?: string;
  type?: string;
  url?: string;
  comment?: string;
}

// IPD Sharing Statement Module
export interface IpdSharingStatementModule {
  ipdSharing?: string; // IpdSharing enum
  description?: string;
  infoTypes?: string[]; // IpdSharingInfoType enum
  timeFrame?: string;
  accessCriteria?: string;
  url?: string;
}

// Protocol Section Container
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
  ipdSharingStatementModule?: IpdSharingStatementModule;
}

// Results Section (partial - can be extended)
export interface ResultsSection {
  participantFlowModule?: ParticipantFlowModule;
  baselineCharacteristicsModule?: BaselineCharacteristicsModule;
  outcomeMeasuresModule?: OutcomeMeasuresModule;
  adverseEventsModule?: AdverseEventsModule;
  moreInfoModule?: MoreInfoModule;
}

export interface ParticipantFlowModule {
  preAssignmentDetails?: string;
  recruitmentDetails?: string;
  groups?: FlowGroup[];
  periods?: FlowPeriod[];
}

export interface FlowGroup {
  id: string;
  title: string;
  description?: string;
}

export interface FlowPeriod {
  title: string;
  milestones?: FlowMilestone[];
  dropWithdraws?: DropWithdraw[];
}

export interface FlowMilestone {
  type: string;
  comment?: string;
  achievements?: FlowStats[];
}

export interface FlowStats {
  groupId: string;
  numSubjects?: string;
  numUnits?: string;
}

export interface DropWithdraw {
  type: string;
  comment?: string;
  reasons?: FlowStats[];
}

export interface BaselineCharacteristicsModule {
  populationDescription?: string;
  groups?: MeasureGroup[];
}

export interface MeasureGroup {
  id: string;
  title: string;
  description?: string;
}

export interface OutcomeMeasuresModule {
  outcomeMeasures?: OutcomeMeasure[];
}

export interface OutcomeMeasure {
  type: string; // OutcomeMeasureType enum
  title: string;
  description?: string;
  populationDescription?: string;
  reportingStatus?: string;
  timeFrame?: string;
  paramType?: string;
  dispersionType?: string;
  unitOfMeasure?: string;
}

export interface AdverseEventsModule {
  frequencyThreshold?: string;
  timeFrame?: string;
  description?: string;
  eventGroups?: EventGroup[];
}

export interface EventGroup {
  id: string;
  title: string;
  description?: string;
  deathsNumAffected?: number;
  deathsNumAtRisk?: number;
  seriousNumAffected?: number;
  seriousNumAtRisk?: number;
  otherNumAffected?: number;
  otherNumAtRisk?: number;
}

export interface MoreInfoModule {
  limitationsAndCaveats?: LimitationsAndCaveats;
  certainAgreement?: CertainAgreement;
  pointOfContact?: PointOfContact;
}

export interface LimitationsAndCaveats {
  description?: string;
}

export interface CertainAgreement {
  piSponsorEmployee?: boolean;
  restrictionType?: string;
  restrictiveAgreement?: boolean;
  otherDetails?: string;
}

export interface PointOfContact {
  title?: string;
  organization?: string;
  email?: string;
  phone?: string;
  phoneExt?: string;
}

// Derived Section
export interface DerivedSection {
  miscInfoModule?: MiscInfoModule;
  conditionBrowseModule?: BrowseModule;
  interventionBrowseModule?: BrowseModule;
}

export interface MiscInfoModule {
  versionHolder?: NormalizedDate;
  removedCountries?: string[];
}

export interface BrowseModule {
  meshes?: Mesh[];
  ancestors?: Mesh[];
  browseLeaves?: BrowseLeaf[];
  browseBranches?: BrowseBranch[];
}

export interface Mesh {
  id: string;
  term: string;
}

export interface BrowseLeaf {
  id: string;
  name: string;
  asFound?: string;
  relevance?: string;
}

export interface BrowseBranch {
  abbrev: string;
  name: string;
}

// Complete Study Record
export interface FullStudyRecord {
  protocolSection: ProtocolSection;
  resultsSection?: ResultsSection;
  annotationSection?: AnnotationSection;
  documentSection?: DocumentSection;
  derivedSection?: DerivedSection;
  hasResults?: boolean;
}

export interface AnnotationSection {
  annotationModule?: AnnotationModule;
}

export interface AnnotationModule {
  unpostedAnnotation?: UnpostedAnnotation;
  violationAnnotation?: ViolationAnnotation;
}

export interface UnpostedAnnotation {
  unpostedEvents?: UnpostedEvent[];
}

export interface UnpostedEvent {
  type: string;
  date?: NormalizedDate;
  dateUnknown?: boolean;
}

export interface ViolationAnnotation {
  violationEvents?: ViolationEvent[];
}

export interface ViolationEvent {
  type: string;
  description?: string;
  creationDate?: NormalizedDate;
  issuedDate?: NormalizedDate;
  releaseDate?: NormalizedDate;
  postedDate?: NormalizedDate;
}

export interface DocumentSection {
  largeDocumentModule?: LargeDocumentModule;
}

export interface LargeDocumentModule {
  noSap?: boolean;
  largeDocs?: LargeDoc[];
}

export interface LargeDoc {
  typeAbbrev?: string;
  hasProtocol?: boolean;
  hasSap?: boolean;
  hasIcf?: boolean;
  label?: string;
  date?: NormalizedDate;
  uploadDate?: DateTimeMinutes;
  filename?: string;
  size?: number;
}

// API Response Wrapper
export interface StudiesResponse {
  nctId?: string;
  protocolSection: ProtocolSection;
  hasResults?: boolean;
  resultsSection?: ResultsSection;
  derivedSection?: DerivedSection;
}

export interface StudiesListResponse {
  studies: StudiesResponse[];
  nextPageToken?: string;
  totalCount?: number;
}
