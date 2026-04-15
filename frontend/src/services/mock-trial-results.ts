import { TrialResultsResponse } from '@shared/dto/TrialResultsResponse';

export const mockTrialResultsResponse: TrialResultsResponse = {
    overallScore: 73,
    totalTrialsFound: 511,
    queryCondition: "Type 2 Diabetes",
    terminationReasons: [
        { reason: "Slow Recruitment", count: 42 },
        { reason: "Sponsor Decision", count: 38 },
        { reason: "Safety Concerns", count: 27 },
        { reason: "Lack of Efficacy", count: 19 },
        { reason: "Protocol Deviation", count: 14 },
        { reason: "Funding Loss", count: 11 },
        { reason: "Regulatory Issue", count: 8 },
        { reason: "Other", count: 23 },
    ],
    avgRecruitmentDays: 487,
    participantTarget: 240,
    recruitmentByImpact: [
        { label: "High Impact", avgDays: 312, participantCount: 187 },
        { label: "Medium Impact", avgDays: 487, participantCount: 243 },
        { label: "Low Impact", avgDays: 621, participantCount: 81 },
    ],
    timelineBuckets: [
        { patientBucket: "0–50",    estimatedDays: 180, actualDays: 210 },
        { patientBucket: "51–100",  estimatedDays: 270, actualDays: 305 },
        { patientBucket: "101–250", estimatedDays: 365, actualDays: 420 },
        { patientBucket: "251–500", estimatedDays: 480, actualDays: 0   },
        { patientBucket: "500+",    estimatedDays: 720, actualDays: 0   },
    ],
    generatedAt: new Date().toISOString(),
};
