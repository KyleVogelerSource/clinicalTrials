
export interface StudyTrial {
    nctId: string;
    briefTitle: string;
    conditions: string[];
    enrollmentCount: number;
    location: string;
    startDate: string;
    completionDate: string;
    sponsor: string;
    sites: string[];
    countries: string[];
    phase: string;
    description: string;
    overallStatus: string;
}
