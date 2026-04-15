import { Injectable, signal, inject } from "@angular/core";
import { TrialResultsRequest } from "@shared/dto/TrialResultsRequest";
import { ClinicalTrialSearchRequest } from "@shared/dto/ClinicalTrialSearchRequest";
import { ClinicalStudyService } from "./clinical-study.service";
import { ResultsApiService } from "./results-api.service";
import { DesignModel } from "../models/design-model";
import { StudyTrial } from "../models/study-trial";
import { ClinicalTrialStudy } from "@shared/dto/ClinicalTrialStudiesResponse";
import { ResultsModel } from "../models/results-model";

const PHASE_MAP: Record<string, string> = {
    'Early Phase 1': 'EARLY_PHASE1',
    'Phase 1': 'PHASE1',
    'Phase 1/Phase 2': 'PHASE1 OR PHASE2',
    'Phase 2': 'PHASE2',
    'Phase 2/Phase 3': 'PHASE2 OR PHASE3',
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
    private trialCache: Map<string, ClinicalTrialStudy> = new Map();

    // Designer state
    inputParams = signal<DesignModel | null>(null);

    // Selection state
    foundTrials = signal<StudyTrial[]>([]);
    filterWords = signal<string[]>([]);
    fromDate = signal<string>("");
    toDate = signal<string>("");

    // Results state
    selectedTrialIds = signal<string[]>([]);
    results = signal<ResultsModel>(new ResultsModel());

    reset() {
        this.inputParams.set(null);
        this.foundTrials.set([]);
        this.filterWords.set([]);
        this.fromDate.set("");
        this.toDate.set("");
        this.selectedTrialIds.set([]);
        this.results.set(new ResultsModel());
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
            pageSize: 100
        };

        this.clinicalStudyService.searchStudies(request).subscribe({
            next: (response) => {
                const mapped = response.studies.map(study => this.toStudyTrial(study));
                response.studies.forEach(study => this.trialCache.set(study.protocolSection.identificationModule.nctId, study));
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
        const locations = study.protocolSection.contactsLocationsModule?.locations || [];
        const firstLocation = locations[0];
        const locationStr = firstLocation 
            ? `${firstLocation.city || ''}${firstLocation.city && firstLocation.country ? ', ' : ''}${firstLocation.country || ''}`
            : 'Unknown';

        return {
            nctId: study.protocolSection.identificationModule.nctId,
            briefTitle: study.protocolSection.identificationModule.briefTitle,
            conditions: study.protocolSection.conditionsModule?.conditions || [],
            enrollmentCount: study.protocolSection.designModule?.enrollmentInfo?.count || 0,
            location: locationStr,
            startDate: study.protocolSection.statusModule?.startDateStruct?.date || '',
            completionDate: study.protocolSection.statusModule?.completionDateStruct?.date || '',
            sponsor: study.protocolSection.sponsorCollaboratorsModule?.leadSponsor?.name || 'Unknown',
            phase: study.protocolSection.designModule?.phases?.[0] || 'N/A',
            description: study.protocolSection.descriptionModule?.briefSummary || '',
            sites: locations.map(loc => loc.facility).filter((f): f is string => !!f)
        }
    }

    processResults() {
        const trials = this.selectedTrialIds().map(id => this.trialCache.get(id));
        const plotData: any[] = trials.map(trial => ({
            id: trial?.protocolSection.identificationModule.nctId,

            // Plots
            terminationCause: trial?.protocolSection.statusModule?.whyStopped ?? null,
            geoLocations: trial?.protocolSection.contactsLocationsModule?.locations?.map(loc => {
                geoPoint: loc.geoPoint
                city: loc.city
                country: loc.country
            }) ?? [],
            startDate: trial?.protocolSection.statusModule?.startDateStruct,
            completionDate: trial?.protocolSection.statusModule?.completionDateStruct,

            // Metrics - Get transformed into { x: number, y : number, label: string (optional) }
            totalEnrollment: trial?.protocolSection.designModule?.enrollmentInfo?.count ?? 0,
            siteCount: trial?.protocolSection.contactsLocationsModule?.locations?.length ?? 0,
            /* Duration = completionDate - startDate */
            /* Recruitment Velocity = total Enrollment / Duration */
            inclusionStrictnes: trial?.protocolSection.eligibilityModule?.eligibilityCriteria?.split(' ').length ?? 0,
            /* site efficiency = total enrollment / site count */
            outcomeDensity: (trial?.protocolSection.outcomesModule?.primaryOutcomes?.length ?? 0) + (trial?.protocolSection.outcomesModule?.secondaryOutcomes?.length ?? 0),
            minAge: trial?.protocolSection.eligibilityModule?.minimumAge,
            maxAge: trial?.protocolSection.eligibilityModule?.maximumAge,
            /* Age Span = maxAge - minAge */
            interventionCount: trial?.protocolSection.armsInterventionsModule?.interventions?.length ?? 0,
            collaboratorCount: trial?.protocolSection.sponsorCollaboratorsModule?.collaborators?.length ?? 0,
            completedDate: trial?.protocolSection.statusModule?.primaryCompletionDateStruct,
            /* Timeline Slippage */
            conditionCount: trial?.protocolSection.conditionsModule?.conditions?.length ?? 0
        }));

        var terminations = new Map<string, number>([
            ["Completed", 0]
        ]);
        plotData.forEach((trial: any) => {
            if (trial.terminationCause as string) {
                terminations.set(trial.terminationCause, (terminations.get(trial.terminationCause) || 0) + 1);
            } else {
                terminations.set("Completed", (terminations.get("Completed") || 0) + 1);
            }
        });

        this.results.update(current => {
            if (current == null) {
                current = new ResultsModel();
            }

            current.terminationReasons = Array.from(terminations.entries()).map(([reason, count]) => ({ reason, count }));
            // current.metricRows = plotData.map(trial =>{
            //     return ({
            //         id: trial.id,
            //         totalEnrollment: trial.totalEnrollment,
            //         siteCount: trial.siteCount,
            //         recruitmentVelocity: trial.totalEnrollment / (trial.completedDate - trial.startDate), // todo: zero
            //         inclusionStrictnes: trial.inclusionStrictnes,
            //         siteEfficiency: trial.siteCount == 0 ? 0 : (trial.totalEnrollment / trial.siteCount),
            //         outcomeDensity: trial.outcomeDensity,
            //         ageSpan: trial.maxAge - trial.minAge,
            //         minAge: trial.minAge,
            //         maxAge: trial.maxAge,
            //         interventionCount: trial.interventionCount,
            //         collaboratorCount: trial.collaboratorCount,
            //         timelineSlippage: trial.completedDate - trial.startDate, // todo: not yet a number need to convert strings
            //         maskingIntensity: trial.maskingIntensity,
            //         geographicSpread: trial.geographicSpread,
            //         conditionCount: trial.conditionCount
            //     });
            // });

            return current;
        })

        const request = this.createResultsRequest();
        if (!request) return;

        this.apiService.getResults(request).subscribe(response => {
            this.results.update(current => {
                if (current == null) {
                    current = new ResultsModel();
                }
                current.trialResults = response;
                return current;
            })
        });
    }

    createResultsRequest() : TrialResultsRequest | undefined {
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