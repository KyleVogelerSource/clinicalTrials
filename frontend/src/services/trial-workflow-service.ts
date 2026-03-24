import { Injectable, signal } from "@angular/core";
import { TrialResultsRequest } from "../../../shared/src/dto/TrialResultsRequest";

/**
 * Contains local state for user's input
 * at each state of the Design trail tracks.
 */
@Injectable({
    providedIn: 'root'
})
export class TrialWorkflowService {
    // Designer state
    inputParams = signal<any | null>(null);
    
    // Selection state
    foundTrials = signal<any[]>([]);
    filterWords = signal<string[]>([]);
    fromDate = signal<string>("");
    toDate = signal<string>("");
    
    // Results state
    selectedTrials = signal<any>([]);
    results = signal<any | null>(null);

    reset() {
        this.inputParams.set(null);
        this.foundTrials.set([]);
        this.filterWords.set([]);
        this.fromDate.set("");
        this.toDate.set("");
        this.selectedTrials.set([]);
        this.results.set(null);
    }

    setInputs(obj : any) { // TODO: use a type
        this.inputParams.set(obj);
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
        };
        
        return request;
    }
}