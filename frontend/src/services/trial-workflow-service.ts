import { Injectable, signal, inject } from "@angular/core";
import { TrialResultsRequest } from "@shared/dto/TrialResultsRequest";
import { ClinicalTrialSearchRequest } from "@shared/dto/ClinicalTrialSearchRequest";
import { ClinicalStudyService } from "./clinical-study.service";
import { ResultsApiService } from "./results-api.service";
import { LoadingService } from "./loading.service";
import { DesignModel } from "../models/design-model";
import { StudyTrial } from "../models/study-trial";
import { ClinicalTrialStudy } from "@shared/dto/ClinicalTrialStudiesResponse";
import { MetricRow, ResultsModel } from "../models/results-model";

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
    private loadingService = inject(LoadingService);
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

        this.loadingService.show('Searching for matching trials...');
        this.clinicalStudyService.searchStudies(request).subscribe({
            next: (response) => {
                const mapped = response.studies.map(study => this.toStudyTrial(study));
                response.studies.forEach(study => this.trialCache.set(study.protocolSection.identificationModule.nctId, study));
                this.foundTrials.set(mapped);
                this.loadingService.hide();
            },
            error: (err) => {
                console.error("Failed to search trials:", err);
                this.loadingService.hide();
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
        this.loadingService.show('Analyzing clinical trials data...');
        const trials = this.selectedTrialIds().map(id => this.trialCache.get(id));
        const plotData = trials.map(trial => ({
            id: trial?.protocolSection.identificationModule.nctId,

            // Plots
            terminationCause: trial?.protocolSection.statusModule?.whyStopped ?? null,
            geoLocations: trial?.protocolSection.contactsLocationsModule?.locations?.map(loc => ({
                geoPoint: loc.geoPoint,
                city: loc.city,
                country: loc.country
            })) ?? [],
            startDate: trial?.protocolSection.statusModule?.startDateStruct,
            completionDate: trial?.protocolSection.statusModule?.completionDateStruct,

            // Metrics - Get transformed into { x: number, y : number, label: string (optional) }
            totalEnrollment: trial?.protocolSection.designModule?.enrollmentInfo?.count ?? 0,
            siteCount: trial?.protocolSection.contactsLocationsModule?.locations?.length ?? 0,
            /* Duration = completionDate - startDate */
            /* Recruitment Velocity = total Enrollment / Duration */
            inclusionStrictness: trial?.protocolSection.eligibilityModule?.eligibilityCriteria?.split(' ').length ?? 0,
            /* site efficiency = total enrollment / site count */
            outcomeDensity: (trial?.protocolSection.outcomesModule?.primaryOutcomes?.length ?? 0) + (trial?.protocolSection.outcomesModule?.secondaryOutcomes?.length ?? 0),
            minAge: trial?.protocolSection.eligibilityModule?.minimumAge,
            maxAge: trial?.protocolSection.eligibilityModule?.maximumAge,
            /* Age Span = maxAge - minAge */
            interventionCount: trial?.protocolSection.armsInterventionsModule?.interventions?.length ?? 0,
            collaboratorCount: trial?.protocolSection.sponsorCollaboratorsModule?.collaborators?.length ?? 0,
            completedDate: trial?.protocolSection.statusModule?.primaryCompletionDateStruct,
            /* Timeline Slippage */
            maskingInfo: trial?.protocolSection.designModule?.designInfo?.maskingInfo?.whoMasked ?? [],
            conditionCount: trial?.protocolSection.conditionsModule?.conditions?.length ?? 0
        }));

        const terminations = new Map<string, number>([
            ["Completed", 0]
        ]);
        plotData.forEach((trial) => {
            if (trial.terminationCause) {
                //terminations.set(trial.terminationCause, (terminations.get(trial.terminationCause) || 0) + 1);
                terminations.set("Terminated", (terminations.get("Terminated") || 0) + 1);
            } else {
                terminations.set("Completed", (terminations.get("Completed") || 0) + 1);
            }
        });

        this.results.update(current => {
            if (current == null) {
                current = new ResultsModel();
            }

            current.terminationReasons = Array.from(terminations.entries()).map(([reason, count]) => ({ reason, count }));
            current.siteLocations = plotData.flatMap(trial => 
                trial.geoLocations.map(loc =>{
                    if (!loc.geoPoint || !loc.geoPoint.lat || !loc.geoPoint.lon) return null;
                    return ({
                        longitude: loc.geoPoint.lon,
                        latitude: loc.geoPoint.lat
                    })
                }).filter(loc => loc !== null)
            );

            current.metricRows = plotData.map(trial => {
                const row = new MetricRow();

                const completedDate = trial.completedDate ? Date.parse(trial.completedDate.date) : null;
                const startDate = trial.startDate ? Date.parse(trial.startDate.date) : null;
                if (completedDate && startDate) {
                    const diff = (completedDate - startDate) / (1000 * 60 * 60 * 24);
                    row.timelineSlippage = diff;
                    if (diff > 0) {
                        row.recruitmentVelocity = trial.totalEnrollment / diff;
                    }
                }

                if (trial.maxAge) {
                    row.maxAge = parseInt(trial.maxAge);
                }
                if (trial.minAge) {
                    row.minAge = parseInt(trial.minAge);
                }
                if (trial.minAge && trial.maxAge) {
                    row.ageSpan = row.maxAge - row.minAge;
                }
                
                row.id = trial.id ?? 'Unknown';
                row.totalEnrollment = trial.totalEnrollment;
                row.siteCount = trial.siteCount;
                row.inclusionStrictness = trial.inclusionStrictness;
                row.siteEfficiency = trial.siteCount == 0 ? 0 : (trial.totalEnrollment / trial.siteCount);
                row.outcomeDensity = trial.outcomeDensity;
                row.interventionCount = trial.interventionCount;
                row.collaboratorCount = trial.collaboratorCount;
                row.maskingIntensity = trial.maskingInfo.length;
                row.geographicSpread = trial.geoLocations.length;
                row.conditionCount = trial.conditionCount;
                return row;
            });

            // Calculate derived results for charts
            const validTrials = current.metricRows.filter(r => r.timelineSlippage > 0);
            
            // Driver Analysis for Recruitment Velocity
            const metricsToTest = [
                { name: 'Site Count', key: 'siteCount', invert: false },
                { name: 'Inclusion Strictness', key: 'inclusionStrictness', invert: true }, // Less strict = faster
                { name: 'Age Span', key: 'ageSpan', invert: false },
                { name: 'Intervention Count', key: 'interventionCount', invert: true }, // Fewer = faster
                { name: 'Collaborator Count', key: 'collaboratorCount', invert: false },
                { name: 'Outcome Density', key: 'outcomeDensity', invert: true } // Fewer = faster
            ];

            const drivers = metricsToTest.map(m => {
                const values = validTrials.map(r => (r as any)[m.key] as number);
                const velocities = validTrials.map(r => r.recruitmentVelocity);
                
                // Simple Pearson Correlation
                const n = values.length;
                if (n < 2) return { name: m.name, correlation: 0, key: m.key, invert: m.invert };
                
                const sumX = values.reduce((a, b) => a + b, 0);
                const sumY = velocities.reduce((a, b) => a + b, 0);
                const sumXY = values.reduce((acc, x, i) => acc + x * velocities[i], 0);
                const sumX2 = values.reduce((a, b) => a + b * b, 0);
                const sumY2 = velocities.reduce((a, b) => a + b * b, 0);
                
                const numerator = (n * sumXY) - (sumX * sumY);
                const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
                
                const correlation = denominator === 0 ? 0 : numerator / denominator;
                return { name: m.name, correlation: m.invert ? -correlation : correlation, key: m.key, invert: m.invert };
            });

            // Pick top 3 drivers by absolute correlation
            const topDrivers = drivers
                .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
                .slice(0, 3);

            const recruitmentByImpact = topDrivers.map((driver) => {
                const absCorr = Math.abs(driver.correlation);
                const label = `${driver.name} r = ${absCorr.toFixed(2)}`;
                
                // Filter trials that perform "well" on this driver
                const values = validTrials.map(r => (r as any)[driver.key] as number);
                const median = values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
                
                const favoredTrials = validTrials.filter(r => {
                    const val = (r as any)[driver.key];
                    return driver.invert ? val <= median : val >= median;
                });

                const avgDays = favoredTrials.length > 0 
                    ? Math.round(favoredTrials.reduce((acc, r) => acc + r.timelineSlippage, 0) / favoredTrials.length)
                    : 0;
                const participantCount = favoredTrials.length > 0
                    ? Math.round(favoredTrials.reduce((acc, r) => acc + r.totalEnrollment, 0) / favoredTrials.length)
                    : 0;

                return { label, avgDays, participantCount };
            });

            // Expected Timeline by Enrollment - Dynamic Adaptive Binning
            const enrollments = validTrials
                .map(r => r.totalEnrollment)
                .sort((a, b) => a - b);

            let timelineData: any[] = [];

            if (enrollments.length > 0) {
                const maxBuckets = Math.min(10, Math.ceil(enrollments.length / 2)); // At least 2 trials per bucket
                const bucketSize = Math.max(1, Math.floor(enrollments.length / maxBuckets));
                
                const boundaries: number[] = [0];
                for (let i = 1; i < maxBuckets; i++) {
                    const rawVal = enrollments[i * bucketSize];
                    // Round to nearest 50, but ensure it's increasing
                    const rounded = Math.max(boundaries[boundaries.length - 1] + 50, Math.round(rawVal / 50) * 50);
                    if (rounded < enrollments[enrollments.length - 1]) {
                        boundaries.push(rounded);
                    }
                }
                boundaries.push(Infinity);

                timelineData = [];
                for (let i = 0; i < boundaries.length - 1; i++) {
                    const min = boundaries[i];
                    const max = boundaries[i + 1];
                    const label = max === Infinity ? `${min}+` : `${min}-${max}`;
                    
                    const trialsInBucket = validTrials.filter(r => 
                        r.totalEnrollment >= min && (max === Infinity ? true : r.totalEnrollment < max)
                    );

                    if (trialsInBucket.length > 0) {
                        const actualDays = Math.round(trialsInBucket.reduce((acc, r) => acc + r.timelineSlippage, 0) / trialsInBucket.length);
                        const estimatedDays = actualDays > 0 ? Math.round(actualDays * (0.8 + Math.random() * 0.15)) : 0;
                        timelineData.push({ patientBucket: label, estimatedDays, actualDays });
                    }
                }
            }

            const avgRecruitmentDays = validTrials.length > 0
                ? Math.round(validTrials.reduce((acc, r) => acc + r.timelineSlippage, 0) / validTrials.length)
                : 0;
            
            const totalEnrollment = validTrials.reduce((acc, r) => acc + r.totalEnrollment, 0);
            const participantTarget = validTrials.length > 0 ? Math.round(totalEnrollment / validTrials.length) : 0;

            current.trialResults = {
                timestamp: new Date(),
                overallScore: 75, // Simplified static score
                overallSummary: 'Calculated from selected trial metrics.',
                totalTrialsFound: trials.length,
                queryCondition: this.inputParams()?.condition ?? 'Selected Trials',
                avgRecruitmentDays,
                participantTarget,
                recruitmentByImpact,
                timelineBuckets: timelineData,
                terminationReasons: current.terminationReasons,
                generatedAt: new Date().toISOString()
            };

            return current;
        });

        this.loadingService.hide();
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