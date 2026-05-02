import { Injectable, signal, inject, effect } from "@angular/core";
import { Observable, map, tap, finalize } from "rxjs";
import { TrialResultsRequest } from "@shared/dto/TrialResultsRequest";
import { ClinicalTrialSearchRequest } from "@shared/dto/ClinicalTrialSearchRequest";
import { ClinicalStudyService } from "./clinical-study.service";
import { ResultsApiService } from "./results-api.service";
import { LoadingService } from "./loading.service";
import { DesignModel } from "../models/design-model";
import { StudyTrial } from "../models/study-trial";
import { ClinicalTrialStudy } from "@shared/dto/ClinicalTrialStudiesResponse";
import { MetricRow, ResultsModel } from "../models/results-model";
import { mapDesignModelToExecutionSearchRequest } from "./saved-search-criteria-mapper";
import { HeatPoint } from "../primitives/heatmap/heatmap";
import { TrialNormalizer } from "./trial-normalizer.service";

const PHASE_MAP: Record<string, string> = {
    'Early Phase 1': 'EARLY_PHASE1',
    'Phase 1': 'PHASE1',
    'Phase 2': 'PHASE2',
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
    private normalizer = inject(TrialNormalizer);
    private trialCache: Map<string, ClinicalTrialStudy> = new Map();

    // Designer state
    inputParams = signal<DesignModel | null>(null);

    // Selection state
    foundTrials = signal<StudyTrial[]>([]);
    filterWords = signal<string[]>([]);
    fromDate = signal<string>("");
    toDate = signal<string>("");
    importNotice = signal<string | null>(null);

    // Results state
    selectedTrialIds = signal<string[]>([]);
    results = signal<ResultsModel>(new ResultsModel());

    constructor() {
        this.restoreSession();

        // Save session state on changes
        effect(() => {
            const inputs = this.inputParams();
            if (inputs) sessionStorage.setItem('tw_inputs', JSON.stringify(inputs));
            else sessionStorage.removeItem('tw_inputs');
        });

        effect(() => {
            const selections = this.selectedTrialIds();
            if (selections.length > 0) sessionStorage.setItem('tw_selections', JSON.stringify(selections));
            else sessionStorage.removeItem('tw_selections');
        });
    }

    private restoreSession() {
        const storedInputs = sessionStorage.getItem('tw_inputs');
        const storedSelections = sessionStorage.getItem('tw_selections');

        if (storedInputs) {
            try {
                this.inputParams.set(JSON.parse(storedInputs));
                if (storedSelections) {
                    this.selectedTrialIds.set(JSON.parse(storedSelections));
                }
                
                // Re-fetch found trials to restore cache and list
                this.searchTrials(false); 
            } catch (e) {
                console.error("Failed to parse session storage", e);
                this.reset();
            }
        }
    }

    reset() {
        sessionStorage.removeItem('tw_inputs');
        sessionStorage.removeItem('tw_selections');
        this.inputParams.set(null);
        this.foundTrials.set([]);
        this.filterWords.set([]);
        this.fromDate.set("");
        this.toDate.set("");
        this.importNotice.set(null);
        this.selectedTrialIds.set([]);
        this.results.set(new ResultsModel());
    }

    setInputs(inputs : DesignModel) {
        this.inputParams.set(inputs);
    }

    setImportNotice(message: string | null) {
        this.importNotice.set(message);
    }

    searchTrials(clearSelections = true) {
        const input = this.inputParams();
        if (!input) return;

        const request: ClinicalTrialSearchRequest = {
            ...mapDesignModelToExecutionSearchRequest(input, {
                phaseByLabel: PHASE_MAP,
                interventionModelByLabel: INTERVENTION_MODEL_MAP,
            }),
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
        if (clearSelections) {
            this.selectedTrialIds.set([]);
        }
    }

    searchTrialsV2(request: ClinicalTrialSearchRequest): Observable<StudyTrial[]> {
        return this.clinicalStudyService.searchStudies(request).pipe(
            tap(response => {
                response.studies.forEach(study => this.trialCache.set(study.protocolSection.identificationModule.nctId, study));
            }),
            map(response => response.studies.map(study => this.toStudyTrial(study)))
        );
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
            overallStatus: study.protocolSection.statusModule?.overallStatus || 'Unknown',
            sites: locations.map(loc => loc.facility).filter((f): f is string => !!f)
        }
    }

    processResults() {
        this.processResultsV2();
    }

    processResultsV2() {
        this.loadingService.show('Analyzing clinical trials data...');

        const countCriteriaItems = (text: string): number => {
            if (!text) return 0;
            // Split by lines and look for markers like "-", "*", "1.", etc. at the start of non-empty lines
            const lines = text.split('\n');
            const criteriaLines = lines.filter(line => {
                const trimmed = line.trim();
                return trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed);
            });
            // If no clear markers, fallback to non-empty lines but cap it to avoid huge numbers
            return criteriaLines.length > 0 ? criteriaLines.length : lines.filter(l => l.trim().length > 5).length;
        };

        const trials = this.selectedTrialIds().map(id => this.trialCache.get(id)).filter((t): t is ClinicalTrialStudy => !!t);
        const plotData = trials.map(trial => {
            const criteria = trial.protocolSection.eligibilityModule?.eligibilityCriteria ?? '';
            const parts = criteria.split(/exclusion criteria/i);
            const inclusionText = parts[0];
            const exclusionText = parts.length > 1 ? parts[1] : '';

            return {
                id: trial.protocolSection.identificationModule.nctId,
                terminationCause: trial.protocolSection.statusModule?.whyStopped ?? null,
                geoLocations: trial.protocolSection.contactsLocationsModule?.locations?.map(loc => ({
                    geoPoint: loc.geoPoint,
                    city: loc.city,
                    country: loc.country,
                    facility: loc.facility
                })) ?? [],
                startDate: trial.protocolSection.statusModule?.startDateStruct,
                completionDate: trial.protocolSection.statusModule?.completionDateStruct,
                totalEnrollment: trial.protocolSection.designModule?.enrollmentInfo?.count ?? 0,
                siteCount: trial.protocolSection.contactsLocationsModule?.locations?.length ?? 0,
                inclusionStrictness: countCriteriaItems(inclusionText),
                exclusionStrictness: countCriteriaItems(exclusionText),
                outcomeDensity: (trial.protocolSection.outcomesModule?.primaryOutcomes?.length ?? 0) + (trial.protocolSection.outcomesModule?.secondaryOutcomes?.length ?? 0),
                minAge: trial.protocolSection.eligibilityModule?.minimumAge,
                maxAge: trial.protocolSection.eligibilityModule?.maximumAge,
                interventionCount: trial.protocolSection.armsInterventionsModule?.interventions?.length ?? 0,
                armCount: trial.protocolSection.armsInterventionsModule?.armGroups?.length ?? 0,
                collaboratorCount: trial.protocolSection.sponsorCollaboratorsModule?.collaborators?.length ?? 0,
                completedDate: trial.protocolSection.statusModule?.primaryCompletionDateStruct,
                maskingInfo: trial.protocolSection.designModule?.designInfo?.maskingInfo?.whoMasked ?? [],
                conditionCount: trial.protocolSection.conditionsModule?.conditions?.length ?? 0,
                status: trial.protocolSection.statusModule?.overallStatus ?? 'UNKNOWN',
                eligibilityCriteria: criteria
            };
        });

        this.results.update(current => {
            current = new ResultsModel();
            
            // --- Improved Site Naming & Aggregation Logic ---
            const GENERIC_NAMES = new Set(['research site', 'clinical site', 'clinical research site', 'investigative site', 'study site', 'phase 1 unit', 'medical center', 'hospital', 'university', 'unknown', 'na', 'n/a']);
            
            const isGeneric = (name: string): boolean => {
                const lower = name.toLowerCase().trim();
                if (GENERIC_NAMES.has(lower)) return true;
                if ((lower.endsWith('investigative site') || lower.endsWith('research site')) && lower.split(' ').length <= 2) return true;
                return false;
            };

            const getBestName = (names: Set<string>): string => {
                const list = Array.from(names);
                if (list.length === 0) return 'Clinical Site';
                return list.sort((a, b) => {
                    const aG = isGeneric(a);
                    const bG = isGeneric(b);
                    if (aG && !bG) return 1;
                    if (!aG && bG) return -1;
                    return b.length - a.length;
                })[0];
            };

            // Map: key (geo-coords or lowercase name) -> { names: Set, count: number, coords: [lat, lon], locationStr: string }
            const siteGroups = new Map<string, { names: Set<string>, count: number, coords: [number, number] | null, locationStr: string }>();

            plotData.forEach(trial => {
                trial.geoLocations.forEach(loc => {
                    if (!loc.facility) return;
                    
                    const lat = loc.geoPoint?.lat;
                    const lon = loc.geoPoint?.lon;
                    // Use a slightly rounded geo-key to group nearby entries that might be slightly offset
                    const geoKey = (lat && lon) ? `${lat.toFixed(4)},${lon.toFixed(4)}` : null;
                    const key = geoKey || loc.facility.toLowerCase().trim();

                    const group = siteGroups.get(key) || { 
                        names: new Set<string>(), 
                        count: 0, 
                        coords: (lat && lon) ? [lat, lon] : null,
                        locationStr: `${loc.city || ''}${loc.city && loc.country ? ', ' : ''}${loc.country || ''}`
                    };
                    
                    group.names.add(loc.facility);
                    group.count++;
                    siteGroups.set(key, group);
                });
            });

            // Pre-calculate best names for each key to use in heatmap and topSites
            const bestNames = new Map<string, string>();
            siteGroups.forEach((group, key) => {
                bestNames.set(key, getBestName(group.names));
            });

            // 1. Heatmap Points
            current.siteLocations = plotData.flatMap(trial => 
                trial.geoLocations.map(loc => {
                    if (!loc.geoPoint || !loc.geoPoint.lat || !loc.geoPoint.lon || !loc.facility) return null;
                    const key = `${loc.geoPoint.lat.toFixed(4)},${loc.geoPoint.lon.toFixed(4)}`;
                    const point: HeatPoint = { 
                        longitude: loc.geoPoint.lon, 
                        latitude: loc.geoPoint.lat,
                        label: bestNames.get(key) || loc.facility,
                        subLabel: `${loc.city || ''}${loc.city && loc.country ? ', ' : ''}${loc.country || ''}`
                    };
                    return point;
                }).filter((loc): loc is HeatPoint => !!loc)
            );

            // 2. Top Sites (Table)
            const siteEntries = Array.from(siteGroups.entries()).map(([key, group]) => ({
                name: bestNames.get(key)!,
                count: group.count,
                coords: group.coords
            }));

            const top12 = siteEntries
                .filter(s => s.count > 1)
                .sort((a, b) => b.count - a.count)
                .slice(0, 12);

            if (top12.length < 12) {
                const remainder = siteEntries
                    .filter(s => s.count <= 1)
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 12 - top12.length);
                current.topSites = [...top12, ...remainder];
            } else {
                current.topSites = top12;
            }

            // Metric Rows
            current.metricRows = plotData.map(trial => {
                const row = new MetricRow();
                const completedDate = trial.completedDate ? Date.parse(trial.completedDate.date) : null;
                const startDate = trial.startDate ? Date.parse(trial.startDate.date) : null;
                if (completedDate && startDate) {
                    const diff = (completedDate - startDate) / (1000 * 60 * 60 * 24);
                    row.timelineSlippage = diff;
                    if (diff > 0) row.recruitmentVelocity = trial.totalEnrollment / diff;
                }
                if (trial.maxAge) row.maxAge = parseInt(trial.maxAge);
                if (trial.minAge) row.minAge = parseInt(trial.minAge);
                if (trial.minAge && trial.maxAge) row.ageSpan = row.maxAge - row.minAge;
                
                row.id = trial.id ?? 'Unknown';
                row.totalEnrollment = trial.totalEnrollment;
                row.siteCount = trial.siteCount;
                row.inclusionStrictness = trial.inclusionStrictness;
                row.exclusionStrictness = trial.exclusionStrictness;

                row.siteEfficiency = trial.siteCount == 0 ? 0 : (trial.totalEnrollment / trial.siteCount);
                row.outcomeDensity = trial.outcomeDensity;
                row.interventionCount = trial.interventionCount;
                row.collaboratorCount = trial.collaboratorCount;
                row.maskingIntensity = trial.maskingInfo.length;
                row.conditionCount = trial.conditionCount;
                row.armCount = trial.armCount;
                return row;
            });

            // Calculate derived results for charts
            const validTrials = current.metricRows.filter(r => r.timelineSlippage > 0);

            // Expected Timeline binning logic
            const enrollments = validTrials
                .map((r: MetricRow) => r.totalEnrollment)
                .sort((a: number, b: number) => a - b);

            const timelineBuckets: any[] = [];
            if (enrollments.length > 0) {
                const maxBuckets = Math.min(6, Math.ceil(enrollments.length / 2));
                const bucketSize = Math.max(1, Math.floor(enrollments.length / maxBuckets));
                const boundaries: number[] = [0];
                for (let i = 1; i < maxBuckets; i++) {
                    const rawVal = enrollments[i * bucketSize];
                    const rounded = Math.max(boundaries[boundaries.length - 1] + 50, Math.round(rawVal / 50) * 50);
                    if (rounded < enrollments[enrollments.length - 1]) boundaries.push(rounded);
                }
                boundaries.push(Infinity);

                for (let i = 0; i < boundaries.length - 1; i++) {
                    const min = boundaries[i];
                    const max = boundaries[i + 1];
                    const label = max === Infinity ? `${min}+` : `${min}-${max}`;
                    const trialsInBucket = validTrials.filter((r: MetricRow) => r.totalEnrollment >= min && (max === Infinity ? true : r.totalEnrollment < max));
                    if (trialsInBucket.length > 0) {
                        const actualDays = Math.round(trialsInBucket.reduce((acc: number, r: MetricRow) => acc + r.timelineSlippage, 0) / trialsInBucket.length);
                        const estimatedDays = Math.round(actualDays * 0.9);
                        timelineBuckets.push({ patientBucket: label, estimatedDays, actualDays });
                    }
                }
            }

            // Sibling-Adjusted Timeline (Overall Duration)
            const design = this.inputParams();
            const targetEnrollment = design?.userPatients ?? 0;
            let adjustedVelocity = 0;
            let velocityStdDev = 0;
            let siblingCount = 0;

            if (targetEnrollment > 0 && validTrials.length > 0) {
                // Try to find structural siblings (±50% enrollment)
                let siblings = validTrials.filter(r => 
                    r.totalEnrollment >= targetEnrollment * 0.5 && 
                    r.totalEnrollment <= targetEnrollment * 1.5
                );

                // Fallback: if too few siblings, widen the net
                if (siblings.length < 3) {
                    siblings = validTrials.filter(r => 
                        r.totalEnrollment >= targetEnrollment * 0.25 && 
                        r.totalEnrollment <= targetEnrollment * 4
                    );
                }

                // Ultimate fallback: all valid trials
                if (siblings.length < 3) {
                    siblings = validTrials;
                }

                siblingCount = siblings.length;
                const velocities = siblings.map(s => s.recruitmentVelocity);
                const sum = velocities.reduce((a, b) => a + b, 0);
                adjustedVelocity = sum / siblings.length;

                // Calculate StdDev for range
                if (siblings.length > 1) {
                    const avg = adjustedVelocity;
                    const squareDiffs = velocities.map(v => Math.pow(v - avg, 2));
                    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
                    velocityStdDev = Math.sqrt(avgSquareDiff);
                }
            }

            // Global avg as fallback if target enrollment is missing or no siblings
            const globalTotalDays = validTrials.reduce((acc: number, r: MetricRow) => acc + r.timelineSlippage, 0);
            const globalTotalEnrollmentVal = validTrials.reduce((acc: number, r: MetricRow) => acc + r.totalEnrollment, 0);
            const globalVelocity = globalTotalEnrollmentVal > 0 ? globalTotalEnrollmentVal / globalTotalDays : 0;
            
            const finalVelocity = adjustedVelocity > 0 ? adjustedVelocity : globalVelocity;
            const estDays = targetEnrollment > 0 && finalVelocity > 0 ? Math.round(targetEnrollment / finalVelocity) : 0;
            
            // Range based on std dev
            let minDays = 0;
            let maxDays = 0;
            if (estDays > 0 && velocityStdDev > 0 && finalVelocity > velocityStdDev) {
                minDays = Math.round(targetEnrollment / (finalVelocity + velocityStdDev));
                maxDays = Math.round(targetEnrollment / (finalVelocity - velocityStdDev));
            }

            // Termination distribution for report
            const terminations = new Map<string, number>();
            plotData.forEach(t => {
                const status = t.status.split('_').join(' ');
                terminations.set(status, (terminations.get(status) || 0) + 1);
            });
            current.terminationReasons = Array.from(terminations.entries()).map(([reason, count]) => ({ reason, count }));

            // Driver Analysis
            const metricsToTest = [
                { name: 'Site Count', key: 'siteCount', invert: false },
                { name: 'Inclusion Strictness', key: 'inclusionStrictness', invert: true },
                { name: 'Age Span', key: 'ageSpan', invert: false },
                { name: 'Intervention Count', key: 'interventionCount', invert: true },
                { name: 'Outcome Density', key: 'outcomeDensity', invert: true },
                { name: 'Arm Count', key: 'armCount', invert: true }
            ];

            const drivers = metricsToTest.map(m => {
                const values = validTrials.map((r: MetricRow) => (r as any)[m.key] as number);
                const velocities = validTrials.map((r: MetricRow) => r.recruitmentVelocity);
                const n = values.length;
                if (n < 2) return { name: m.name, correlation: 0, key: m.key, invert: m.invert };
                const sumX = values.reduce((a: number, b: number) => a + b, 0);
                const sumY = velocities.reduce((a: number, b: number) => a + b, 0);
                const sumXY = values.reduce((acc: number, x: number, i: number) => acc + x * velocities[i], 0);
                const sumX2 = values.reduce((a: number, b: number) => a + b * b, 0);
                const sumY2 = velocities.reduce((a: number, b: number) => a + b * b, 0);
                const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
                const correlation = denominator === 0 ? 0 : ((n * sumXY) - (sumX * sumY)) / denominator;
                return { name: m.name, correlation: m.invert ? -correlation : correlation, key: m.key, invert: m.invert };
            });

            const significantDrivers = drivers.filter(d => Math.abs(d.correlation) >= 0.05);
            const topDrivers = significantDrivers.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)).slice(0, 3);
            const recruitmentByImpact = topDrivers.map((driver) => {
                return { 
                    label: driver.name,
                    correlation: driver.correlation,
                    impactText: driver.correlation > 0 ? 'Speeds up recruitment' : 'Slows down recruitment',
                    avgDays: 0,
                    participantCount: 0
                };
            });

            current.trialResults = {
                timestamp: new Date(),
                overallScore: 0,
                overallSummary: 'Generating detailed analysis...',
                totalTrialsFound: trials.length,
                queryCondition: this.inputParams()?.condition ?? 'Selected Trials',
                avgRecruitmentDays: estDays, // Refactored to represent estimated duration in days
                participantTarget: targetEnrollment,
                recruitmentByImpact,
                timelineBuckets,
                terminationReasons: current.terminationReasons,
                generatedAt: new Date().toISOString(),
                // Pass range info for UI
                timelineRange: maxDays > 0 ? `${minDays} - ${maxDays}` : undefined,
                siblingCount
            };

            return current;
        });

        const request = this.createResultsRequest();
        if (request) {
            const normalizedTrials = trials.map(t => this.normalizer.normalizeForBenchmark(t));

            this.apiService.getResults(request, normalizedTrials).pipe(
                finalize(() => this.loadingService.hide())
            ).subscribe({
                next: (aiResults) => {
                    this.results.update(current => {
                        // Map the new AI explanation to the overallSummary field
                        if (aiResults.explanation?.explanation) {
                            aiResults.overallSummary = aiResults.explanation.explanation;
                        } else if (!aiResults.overallSummary) {
                            aiResults.overallSummary = "Analysis completed, but no detailed summary was provided by the AI.";
                        }

                        // Preserve locally calculated data
                        if (current.trialResults) {
                            aiResults.timelineBuckets = current.trialResults.timelineBuckets;
                            aiResults.recruitmentByImpact = current.trialResults.recruitmentByImpact;
                            aiResults.avgRecruitmentDays = current.trialResults.avgRecruitmentDays;
                            aiResults.participantTarget = current.trialResults.participantTarget;
                            aiResults.timelineRange = current.trialResults.timelineRange;
                            aiResults.siblingCount = current.trialResults.siblingCount;
                        }
                        current.trialResults = aiResults;
                        return { ...current };
                    });
                },
                error: (err) => {
                    console.error("AI Results failed", err);
                    this.results.update(current => {
                        if (current.trialResults) current.trialResults.overallSummary = "Failed to load detailed AI analysis.";
                        return { ...current };
                    });
                }
            });
        } else {
            this.loadingService.hide();
        }
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
            inclusionCriteria: input.inclusionCriteria ?? [],
            exclusionCriteria: input.exclusionCriteria ?? [],
        };

        return request;
    }
}