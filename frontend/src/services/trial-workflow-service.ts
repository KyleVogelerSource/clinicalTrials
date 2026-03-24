import { Injectable, signal, inject } from "@angular/core";
import { TrialResultsRequest } from "../../../shared/src/dto/TrialResultsRequest";
import { ClinicalStudyService } from "./clinical-study.service";
import { ResultsApiService } from "./results-api.service";
import { TrialResultsResponse } from "../../../shared/src/dto/TrialResultsResponse";

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
    inputParams = signal<any | null>(null);

    // Selection state
    foundTrials = signal<any[]>([]);
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

    setInputs(obj : any) { // TODO: use a type
        this.inputParams.set(obj);
    }

    searchTrials() {
        // Logic for fetching trials based on inputParams goes here
        // For now, we utilize the mock data from the service
        const trials = this.clinicalStudyService.getMockTrials();
        this.foundTrials.set(trials);
        // Clear previous selections on new search
        this.selectedTrialIds.set([]);
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