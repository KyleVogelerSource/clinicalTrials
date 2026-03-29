import { Injectable, signal, inject } from "@angular/core";
import { TrialResultsRequest } from "../../../shared/src/dto/TrialResultsRequest";
import { ClinicalTrialSearchRequest } from "../../../shared/src/dto/ClinicalTrialSearchRequest";
import { ClinicalStudyService } from "./clinical-study.service";
import { ResultsApiService } from "./results-api.service";
import { TrialResultsResponse } from "../../../shared/src/dto/TrialResultsResponse";
import { DesignModel } from "../models/design-model";
import { StudyTrial } from "../models/study-trial";
import { ClinicalTrialStudy } from "../../../shared/src/dto/ClinicalTrialStudiesResponse";

const PHASE_MAP: Record<string, string> = {
    'Early Phase 1': 'EARLY_PHASE1',
    'Phase 1': 'PHASE1',
    'Phase 1/Phase 2': 'PHASE1 | PHASE2',
    'Phase 2': 'PHASE2',
    'Phase 2/Phase 3': 'PHASE2 | PHASE3',
    'Phase 3': 'PHASE3',
    'Phase 4': 'PHASE4',
    'N/A': 'NA'
};

const INTERVENTION_MODEL_MAP: Record<string, string> = {
    'Single Group Assignment': 'SINGLE_GROUP',
    'Parallel Assignment': 'PARALLEL',
    'Crossover Assignment': 'CROSSOVER',
    'Factorial Assignment': 'FACTORIAL',
    'Sequential Assignment': 'SEQUENTIAL'
};

/**
 * Contains local state for user's input
 * at each state of the Design trail tracks.
 */
@Injectable({
    providedIn: 'root'
})
export class TrialWorkflowService {
    private clinicalStudyService = inject(ClinicalStudyService);
    private apiService = inject(ResultsApiService);

    // Designer state
    inputParams = signal<DesignModel | null>(null);

    // Selection state
    foundTrials = signal<StudyTrial[]>([]);
    filterWords = signal<string[]>([]);
    fromDate = signal<string>("");
    toDate = signal<string>("");

    // Results state
    selectedTrialIds = signal<string[]>([]);
    results = signal<TrialResultsResponse | null>(null);

    reset() {
        this.inputParams.set(null);
        this.foundTrials.set([]);
        this.filterWords.set([]);
        this.fromDate.set("");
        this.toDate.set("");
        this.selectedTrialIds.set([]);
        this.results.set(null);
    }

    setInputs(inputs : DesignModel) {
        this.inputParams.set(inputs);
    }

    searchTrials() {
        const input = this.inputParams();
        if (!input) return;

        const request: ClinicalTrialSearchRequest = {
            condition: input.condition ?? undefined,
            phase: input.phase ? PHASE_MAP[input.phase] : undefined,
            interventionModel: input.interventionModel ? INTERVENTION_MODEL_MAP[input.interventionModel] : undefined,
            sex: input.sex ?? undefined,
            minAge: input.minAge ?? undefined,
            maxAge: input.maxAge ?? undefined,
            requiredConditions: input.required ?? [],
            ineligibleConditions: input.ineligible ?? [],
        };

        this.clinicalStudyService.searchStudies(request).subscribe({
            next: (response) => {
                const mapped = response.studies.map(study => this.toStudyTrial(study));
                this.foundTrials.set(mapped);
            },
            error: (err) => {
                console.error("Failed to search trials:", err);
            }
        });

        // Clear previous selections on new search
        this.selectedTrialIds.set([]);
    }

    private toStudyTrial(study : ClinicalTrialStudy) : StudyTrial {
        return {
            nctId: study.protocolSection.identificationModule.nctId,
            briefTitle: study.protocolSection.identificationModule.briefTitle,
            conditions: study.protocolSection.conditionsModule?.conditions || [],
            enrollmentCount: study.protocolSection.designModule?.enrollmentInfo?.count || 0,
            location: '', // TODO
            startDate: study.protocolSection.statusModule?.startDateStruct?.date || '',
            completionDate: study.protocolSection.statusModule?.completionDateStruct?.date || '',
            sponsor: study.protocolSection.sponsorCollaboratorsModule?.leadSponsor?.name || 'Unknown',
            phase: study.protocolSection.designModule?.phases?.[0] || 'N/A',
            description: study.protocolSection.descriptionModule?.briefSummary || '',
            sites: [] // TODO
        }
    }

    processResults() {
        const request = this.getForResults();
        if (!request) return;

        // In a real app, this would be an observable we subscribe to
        // For now, we just call the mock API
        this.apiService.getResults(request).subscribe(response => {
            this.results.set(response);
        });
    }

    getForResults() : TrialResultsRequest | undefined {
        const input = this.inputParams();
        if (!input) 
            return undefined;
        
        const request: TrialResultsRequest = {
            condition: input.condition ?? null,
            phase: input.phase ?? null,
            allocationType: input.allocationType ?? null,
            interventionModel: input.interventionModel ?? null,
            blindingType: input.blindingType ?? null,
            minAge: input.minAge ?? null,
            maxAge: input.maxAge ?? null,
            sex: input.sex ?? null,
            requiredConditions: input.required ?? [],
            ineligibleConditions: input.ineligible ?? [],
            selectedTrialIds: this.selectedTrialIds(),
        };

        return request;
    }
}