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
    ineligible: string[]
}
