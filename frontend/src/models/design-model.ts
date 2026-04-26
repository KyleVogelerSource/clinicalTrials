export interface DesignModel {
    condition: string,
    phase: string,
    allocationType: string,
    interventionModel: string | null,
    blindingType: string,
    minAge: number | null,
    maxAge: number | null,
    sex: string,
    required: string[],
    ineligible: string[],
    
    // User Trial Specifics
    userPatients: number | null,
    userSites: number | null,
    userInclusions: number | null,
    userExclusions: number | null,
    userOutcomes: number | null,
    userArms: number | null,

    // Refinement state
    selectedTrialIds?: string[],
}
