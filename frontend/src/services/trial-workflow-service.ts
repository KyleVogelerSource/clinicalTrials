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
    inputParams = signal<any | null>(null);
    foundTrials = signal<any | null>(null);
    selectedTrials = signal<any>([]);
    results = signal<any | null>(null);

    reset() {
        this.inputParams.set(null);
        this.foundTrials.set(null);
        this.selectedTrials.set([]);
        this.results.set(null);
    }

    setInputs(obj : any) { // TODO: use a type
        this.inputParams.set(obj);
    }

    getForResults() : TrialResultsRequest | undefined {
        const v = this.inputParams();
        const request: TrialResultsRequest = {
            condition: v.condition ?? null,
            phase: v.phase ?? null,
            allocationType: v.allocationType ?? null,
            interventionModel: v.interventionModel ?? null,
            blindingType: v.blindingType ?? null,
            minAge: v.minAge ?? null,
            maxAge: v.maxAge ?? null,
            sex: v.sex ?? null,
            requiredConditions: v.required ?? [],
            ineligibleConditions: v.ineligible ?? [],
        };
        return request;
    }
}