import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from "@angular/core";
import { CommonModule, DecimalPipe, DatePipe } from "@angular/common";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { debounceTime, distinctUntilChanged, switchMap, tap, of, finalize } from "rxjs";

import { ClinicalStudyService } from "../../services/clinical-study.service";
import { TrialWorkflowService } from "../../services/trial-workflow-service";
import { AuthService } from "../../services/auth.service";
import { SavedSearchService } from "../../services/saved-search.service";
import { LoadingIndicator } from "../../primitives/loading-indicator/loading-indicator";
import { AutoCompleteInput } from "../../primitives/auto-complete-input/auto-complete-input";
import { StudyTrial } from "../../models/study-trial";
import { ClinicalTrialSearchRequest } from "@shared/dto/ClinicalTrialSearchRequest";

@Component({
    selector: "app-dashboard",
    templateUrl: "./dashboard.html",
    styleUrl: "./dashboard.css",
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        LoadingIndicator,
        AutoCompleteInput,
        DecimalPipe,
        DatePipe
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class Dashboard implements OnInit {
    private clinicalStudiesService = inject(ClinicalStudyService);
    private workflowService = inject(TrialWorkflowService);
    private authService = inject(AuthService);
    private savedSearchService = inject(SavedSearchService);
    private router = inject(Router);

    // Form Options
    phaseOptions = this.clinicalStudiesService.getPhases();
    allocationOptions = this.clinicalStudiesService.getAllocations();
    interventionOptions = this.clinicalStudiesService.getInterventionModels();
    blindingOptions = this.clinicalStudiesService.getMaskingTypes();

    // Local State
    isLoading = signal(false);
    foundTrials = signal<StudyTrial[]>([]);
    expandedTrialId = signal<string | null>(null);
    conditionMatches = signal<string[]>([]);
    conditionValue = signal('');
    sortOrder = signal<'date_desc' | 'date_asc' | 'enrollment_desc' | 'enrollment_asc' | 'name_asc' | 'name_desc'>('date_desc');

    // Service State Proxies
    selectedTrialIds = this.workflowService.selectedTrialIds;

    DISPLAY_THRESHOLD = 1000;

    searchForm = new FormGroup({
        condition: new FormControl<string>('', [Validators.required]),
        phase: new FormControl<string>(this.clinicalStudiesService.getDefaultPhase(), [Validators.required]),
        allocationType: new FormControl<string>(this.clinicalStudiesService.getDefaultAllocation(), [Validators.required]),
        interventionModel: new FormControl<string | null>(null),
        blindingType: new FormControl<string>(this.clinicalStudiesService.getDefaultMaskingType(), [Validators.required]),
        
        // User Trial Specifics (not sent to search)
        userPatients: new FormControl<number | null>(null),
        userInclusions: new FormControl<number | null>(null),
        userExclusions: new FormControl<number | null>(null),
        userOutcomes: new FormControl<number | null>(null),
        userSites: new FormControl<number | null>(null),
        userArms: new FormControl<number | null>(null),
    });

    displayedTrials = computed(() => {
        const trials = [...this.foundTrials()];
        const order = this.sortOrder();

        return trials.sort((a, b) => {
            switch (order) {
                case 'date_desc':
                    return b.startDate.localeCompare(a.startDate);
                case 'date_asc':
                    return a.startDate.localeCompare(b.startDate);
                case 'enrollment_desc':
                    return b.enrollmentCount - a.enrollmentCount;
                case 'enrollment_asc':
                    return a.enrollmentCount - b.enrollmentCount;
                case 'name_asc':
                    return a.briefTitle.localeCompare(b.briefTitle);
                case 'name_desc':
                    return b.briefTitle.localeCompare(a.briefTitle);
                default:
                    return 0;
            }
        });
    });

    isAllSelected = computed(() => {
        const displayed = this.displayedTrials();
        const selected = this.selectedTrialIds();
        if (displayed.length === 0 || displayed.length > this.DISPLAY_THRESHOLD) return false;
        return displayed.every(t => selected.includes(t.nctId));
    });

    ngOnInit(): void {
        // Sync with existing state if any
        const savedParams = this.workflowService.inputParams();
        if (savedParams) {
            this.searchForm.patchValue({
                condition: savedParams.condition,
                phase: savedParams.phase,
                allocationType: savedParams.allocationType,
                interventionModel: savedParams.interventionModel,
                blindingType: savedParams.blindingType
            }, { emitEvent: false });
            this.conditionValue.set(savedParams.condition || '');
        }

        // Setup live search
        this.searchForm.valueChanges.pipe(
            debounceTime(300),
            distinctUntilChanged((prev, curr) => 
                prev.condition === curr.condition &&
                prev.phase === curr.phase &&
                prev.allocationType === curr.allocationType &&
                prev.interventionModel === curr.interventionModel &&
                prev.blindingType === curr.blindingType
            ),
            switchMap(values => {
                if (!values.condition || values.condition.trim() === '') {
                    this.foundTrials.set([]);
                    return of(null);
                }

                this.isLoading.set(true);
                const request: ClinicalTrialSearchRequest = {
                    condition: values.condition,
                    phase: this.mapPhase(values.phase!),
                    interventionModel: this.mapIntervention(values.interventionModel!),
                    pageSize: 100
                };

                return this.workflowService.searchTrialsV2(request).pipe(
                    finalize(() => this.isLoading.set(false))
                );
            })
        ).subscribe({
            next: (trials) => {
                if (trials) {
                    this.foundTrials.set(trials);
                }
            },
            error: (err) => {
                console.error("Dashboard search failed", err);
                this.isLoading.set(false);
            }
        });

        // Trigger initial search if condition exists
        if (this.searchForm.value.condition) {
            this.searchForm.updateValueAndValidity();
        }
    }

    onConditionSearch(query: string) {
        if (query && query.trim().length > 0) {
            const matches = this.clinicalStudiesService.getMatchingConditions(query.trim());
            this.conditionMatches.set(matches);
        } else {
            this.conditionMatches.set([]);
        }
    }

    onConditionSelected(condition: string) {
        this.searchForm.controls.condition.setValue(condition);
        this.conditionValue.set(condition);
        this.conditionMatches.set([]);
    }

    toggleTrialSelection(id: string) {
        this.selectedTrialIds.update(ids => {
            if (ids.includes(id)) {
                return ids.filter(i => i !== id);
            } else {
                return [...ids, id];
            }
        });
    }

    isTrialSelected(id: string): boolean {
        return this.selectedTrialIds().includes(id);
    }

    toggleAllSelection() {
        if (this.isAllSelected()) {
            const displayedIds = this.displayedTrials().map(t => t.nctId);
            this.selectedTrialIds.update(ids => ids.filter(id => !displayedIds.includes(id)));
        } else {
            const displayedIds = this.displayedTrials().map(t => t.nctId);
            this.selectedTrialIds.update(ids => Array.from(new Set([...ids, ...displayedIds])));
        }
    }

    toggleTrialExpansion(id: string) {
        this.expandedTrialId.update(curr => curr === id ? null : id);
    }

    setSortOrder(order: any) {
        this.sortOrder.set(order);
    }

    onProcess() {
        // Map form to DesignModel for existing results page compatibility
        const values = this.searchForm.value;
        this.workflowService.setInputs({
            condition: values.condition ?? '',
            phase: values.phase ?? '',
            allocationType: values.allocationType ?? '',
            interventionModel: values.interventionModel ?? null,
            blindingType: values.blindingType ?? '',
            // Demographic defaults since they are removed from Dashboard for now
            minAge: null,
            maxAge: null,
            sex: '',
            required: [],
            ineligible: []
        });

        this.workflowService.processResults();
        this.router.navigate(['/results']);
    }

    private mapPhase(phase: string): string | undefined {
        const map: Record<string, string> = {
            'Early Phase 1': 'EARLY_PHASE1',
            'Phase 1': 'PHASE1',
            'Phase 1/Phase 2': 'PHASE1 OR PHASE2',
            'Phase 2': 'PHASE2',
            'Phase 2/Phase 3': 'PHASE2 OR PHASE3',
            'Phase 3': 'PHASE3',
            'Phase 4': 'PHASE4',
            'N/A': 'NA'
        };
        return map[phase];
    }

    private mapIntervention(model: string): string | undefined {
        const map: Record<string, string> = {
            'Single Group Assignment': 'SINGLE_GROUP',
            'Parallel Assignment': 'PARALLEL',
            'Crossover Assignment': 'CROSSOVER',
            'Factorial Assignment': 'FACTORIAL',
            'Sequential Assignment': 'SEQUENTIAL'
        };
        return map[model];
    }
}
