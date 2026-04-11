import { Injectable } from '@angular/core';
import meshData from '../../../shared/src/static/combined-mesh-data.json';
import conditionData from '../../../shared/src/static/common-disease-conditions.json';
import trialDesignOptions from '../../../shared/src/static/trial-design-options.json';
import { ClinicalTrialSearchRequest } from '../../../shared/src/dto/ClinicalTrialSearchRequest';
import { ClinicalTrialStudiesResponse } from '../../../shared/src/dto/ClinicalTrialStudiesResponse';
import Fuse from 'fuse.js'; // A fuzzy match library
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../app/config/api.config';
import { Observable } from 'rxjs';
import { StudyTrial } from '../models/study-trial';

interface MeshEntry {
    id: string;
    name: string;
    synonyms: string[];
}

@Injectable({
    providedIn: 'root',
})
export class ClinicalStudyService {
    private keywords: Fuse<MeshEntry>;
    private conditions: Fuse<MeshEntry>;

    constructor(private http: HttpClient) {
        this.keywords = new Fuse(meshData as MeshEntry[], {
            keys: ['name', 'synonyms'],
            threshold: 0.3,
        });

        this.conditions = new Fuse(conditionData as MeshEntry[], {
            keys: ['name', 'synonyms'],
            threshold: 0.3
        });
    }

    getSuggestedKeywords(input: string): string[] {
        return input ? this.search(input, this.keywords) : [];
    }

    getMatchingConditions(input: string | null): string[] {
        return input ? this.search(input, this.conditions) : [];
    }

    private search(input: string, dataSet: Fuse<MeshEntry>): string[] {
        const results = dataSet.search(input);
        const uniqueNames = new Set<string>();

        for (const result of results) {
            uniqueNames.add(result.item.name);
            if (uniqueNames.size >= 10) {
                break;
            }
        }
        return Array.from(uniqueNames);
    }

    getInterventionModels = () => trialDesignOptions.interventionModels;
    getMaskingTypes = () => trialDesignOptions.maskingTypes;
    getDefaultMaskingType = () => trialDesignOptions.defaultMaskingType;
    getMaskingRoles = () => trialDesignOptions.maskingRoles;
    getPrimaryPurposes = () => trialDesignOptions.primaryPurposes;
    getAllocations = () => trialDesignOptions.allocations;
    getDefaultAllocation = () => trialDesignOptions.defaultAllocation;
    getEnrollmentTypes = () => trialDesignOptions.enrollmentTypes;
    getPhases = () => trialDesignOptions.phases;
    getDefaultPhase = () => trialDesignOptions.defaultPhase;
    getSexes = () => trialDesignOptions.sexes;
    getDefaultSex = () => trialDesignOptions.defaultSex;

    getTrials() {
        const url = apiUrl('/api/clinical-trials/search');
    }

    searchStudies(request: ClinicalTrialSearchRequest): Observable<ClinicalTrialStudiesResponse> {
        const url = apiUrl('/api/clinical-trials/search');
        return this.http.post<ClinicalTrialStudiesResponse>(url, request);
    }

    getMockTrials(): StudyTrial[] {
        return [
            {
                nctId: 'NCT00000001',
                briefTitle: 'A Study of New Treatment for Diabetes',
                conditions: ['Type 2 Diabetes'],
                enrollmentCount: 150,
                location: 'Boston, USA',
                startDate: '2023-01-01',
                completionDate: '2025-12-31',
                sponsor: 'PharmaCorp',
                phase: 'Phase 3',
                description: 'This study evaluates the safety and efficacy of a new oral medication for adults with Type 2 Diabetes who are not well-controlled on metformin.',
                sites: ['Massachusetts General Hospital', 'Beth Israel Deaconess Medical Center', 'Tufts Medical Center']
            },
            {
                nctId: 'NCT00000002',
                briefTitle: 'Evaluation of Diet on Heart Health',
                conditions: ['Heart Disease', 'Hypertension'],
                enrollmentCount: 500,
                location: 'New York, USA',
                startDate: '2022-06-15',
                completionDate: '2024-06-15',
                sponsor: 'HealthInst',
                phase: 'N/A',
                description: 'A longitudinal study observing the effects of a Mediterranean-style diet on blood pressure and cardiac event rates in high-risk populations.',
                sites: ['Mount Sinai Hospital', 'NewYork-Presbyterian Hospital', 'NYU Langone Health']
            },
            {
                nctId: 'NCT00000003',
                briefTitle: 'Safety and Efficacy of Drug X in Asthma',
                conditions: ['Asthma'],
                enrollmentCount: 250,
                location: 'San Francisco, USA',
                startDate: '2021-03-10',
                completionDate: '2023-03-10',
                sponsor: 'BioTech Solutions',
                phase: 'Phase 2',
                description: 'Randomized, double-blind study to determine the optimal dose of Drug X for preventing severe asthma exacerbations.',
                sites: ['UCSF Medical Center', 'California Pacific Medical Center', 'Stanford Health Care']
            },
            {
                nctId: 'NCT00000004',
                briefTitle: 'Phase III Trial of New Alzheimer Treatment',
                conditions: ['Alzheimer Disease'],
                enrollmentCount: 1200,
                location: 'London, UK',
                startDate: '2024-01-01',
                completionDate: '2028-12-31',
                sponsor: 'GlobalPharma',
                phase: 'Phase 3',
                description: 'Multi-center trial evaluating a monoclonal antibody targeting amyloid plaques in patients with early-stage Alzheimer disease.',
                sites: ['Guy\'s and St Thomas\' NHS Foundation Trust', 'University College London Hospitals', 'King\'s College Hospital']
            },
            {
                nctId: 'NCT00000005',
                briefTitle: 'Insulin Resistance Reduction in Obese Adolescents',
                conditions: ['Type 2 Diabetes', 'Obesity'],
                enrollmentCount: 320,
                location: 'Chicago, USA',
                startDate: '2020-09-01',
                completionDate: '2022-09-01',
                sponsor: 'PedsResearch',
                phase: 'Phase 2',
                description: 'A randomized controlled trial examining lifestyle interventions to reduce insulin resistance in obese adolescents aged 12-18.',
                sites: ['Lurie Children\'s Hospital', 'Rush University Medical Center']
            },
            {
                nctId: 'NCT00000006',
                briefTitle: 'Metformin vs Placebo in Pre-Diabetes',
                conditions: ['Pre-Diabetes'],
                enrollmentCount: 400,
                location: 'Houston, USA',
                startDate: '2019-04-15',
                completionDate: '2021-04-15',
                sponsor: 'DiabetesCare Inc',
                phase: 'Phase 3',
                description: 'Double-blind placebo-controlled trial evaluating metformin in adults with pre-diabetes to delay or prevent onset of Type 2 Diabetes.',
                sites: ['Houston Methodist Hospital', 'UTHealth McGovern Medical School']
            },
            {
                nctId: 'NCT00000007',
                briefTitle: 'Cardiac Rehabilitation After Heart Failure',
                conditions: ['Heart Failure', 'Heart Disease'],
                enrollmentCount: 180,
                location: 'Cleveland, USA',
                startDate: '2023-07-01',
                completionDate: '2026-01-01',
                sponsor: 'CardioInst',
                phase: 'Phase 2',
                description: 'Structured exercise program for patients recovering from acute heart failure events, measuring 6-month readmission rates.',
                sites: ['Cleveland Clinic', 'University Hospitals Cleveland Medical Center']
            },
            {
                nctId: 'NCT00000008',
                briefTitle: 'Novel Bronchodilator in Chronic Asthma',
                conditions: ['Asthma', 'COPD'],
                enrollmentCount: 600,
                location: 'Toronto, Canada',
                startDate: '2022-02-01',
                completionDate: '2025-02-01',
                sponsor: 'RespiPharma',
                phase: 'Phase 3',
                description: 'Multi-center trial of a long-acting bronchodilator in patients with moderate-to-severe persistent asthma inadequately controlled by inhaled corticosteroids.',
                sites: ['Toronto General Hospital', 'Sunnybrook Health Sciences Centre', 'Mount Sinai Hospital Toronto']
            },
            {
                nctId: 'NCT00000009',
                briefTitle: 'Early Intervention in Mild Cognitive Impairment',
                conditions: ['Alzheimer Disease', 'Mild Cognitive Impairment'],
                enrollmentCount: 750,
                location: 'Mayo Clinic, USA',
                startDate: '2021-11-01',
                completionDate: '2026-11-01',
                sponsor: 'NeuroGen',
                phase: 'Phase 2',
                description: 'A multi-site randomized trial of a neuroprotective agent to slow progression from mild cognitive impairment to Alzheimer disease.',
                sites: ['Mayo Clinic Rochester', 'Johns Hopkins Hospital', 'UCSF Memory and Aging Center']
            },
            {
                nctId: 'NCT00000010',
                briefTitle: 'Hypertension Control via Telemedicine',
                conditions: ['Hypertension'],
                enrollmentCount: 900,
                location: 'Remote, USA',
                startDate: '2023-03-15',
                completionDate: '2025-03-15',
                sponsor: 'TeleHealth Corp',
                phase: 'N/A',
                description: 'A pragmatic trial of a telemedicine-based hypertension management program versus usual care, measuring systolic BP reduction at 12 months.',
                sites: ['Kaiser Permanente Northern California', 'Geisinger Health System']
            },
            {
                nctId: 'NCT00000011',
                briefTitle: 'GLP-1 Receptor Agonist in Type 2 Diabetes',
                conditions: ['Type 2 Diabetes'],
                enrollmentCount: 480,
                location: 'Philadelphia, USA',
                startDate: '2024-05-01',
                completionDate: '2027-05-01',
                sponsor: 'EndoPharm',
                phase: 'Phase 3',
                description: 'A head-to-head comparison of two GLP-1 receptor agonists in patients with Type 2 Diabetes and cardiovascular risk factors.',
                sites: ['Penn Medicine', 'Temple University Hospital']
            },
            {
                nctId: 'NCT00000012',
                briefTitle: 'Pulmonary Rehabilitation in Post-COVID Asthma',
                conditions: ['Asthma', 'Post-COVID Syndrome'],
                enrollmentCount: 210,
                location: 'Seattle, USA',
                startDate: '2022-10-01',
                completionDate: '2024-10-01',
                sponsor: 'LungHealth Foundation',
                phase: 'Phase 2',
                description: 'Assessment of a structured pulmonary rehabilitation program in patients who developed asthma following COVID-19 infection.',
                sites: ['UW Medical Center', 'Swedish Medical Center Seattle']
            },
            {
                nctId: 'NCT00000013',
                briefTitle: 'Blood Pressure Reduction with Low-Sodium Diet',
                conditions: ['Hypertension', 'Cardiovascular Disease'],
                enrollmentCount: 340,
                location: 'Atlanta, USA',
                startDate: '2020-01-15',
                completionDate: '2022-01-15',
                sponsor: 'NutritionFirst',
                phase: 'N/A',
                description: 'A dietary intervention trial examining the effect of a standardized low-sodium meal plan on blood pressure in hypertensive adults.',
                sites: ['Emory University Hospital', 'Grady Memorial Hospital']
            },
            {
                nctId: 'NCT00000014',
                briefTitle: 'Immunotherapy for Early-Stage Alzheimer Disease',
                conditions: ['Alzheimer Disease'],
                enrollmentCount: 520,
                location: 'San Diego, USA',
                startDate: '2025-01-01',
                completionDate: '2029-12-31',
                sponsor: 'NeuralPath Therapeutics',
                phase: 'Phase 2',
                description: 'A phase 2 trial of a novel tau-targeting immunotherapy in patients with early-stage Alzheimer disease confirmed by PET imaging.',
                sites: ['UC San Diego Health', 'Scripps Health', 'Sharp HealthCare']
            },
            {
                nctId: 'NCT00000015',
                briefTitle: 'Diabetes Prevention in High-Risk Communities',
                conditions: ['Type 2 Diabetes', 'Obesity'],
                enrollmentCount: 670,
                location: 'Los Angeles, USA',
                startDate: '2021-06-01',
                completionDate: '2024-06-01',
                sponsor: 'CommunityHealth Alliance',
                phase: 'N/A',
                description: 'A community-based randomized trial of culturally tailored lifestyle interventions in high-risk Hispanic adults to prevent Type 2 Diabetes.',
                sites: ['Cedars-Sinai Medical Center', 'LAC+USC Medical Center', 'Kaiser Permanente Los Angeles']
            },
        ];
    }
}

