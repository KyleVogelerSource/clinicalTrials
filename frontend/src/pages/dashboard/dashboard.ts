import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from "@angular/core";
import { CommonModule, DecimalPipe, DatePipe } from "@angular/common";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { debounceTime, distinctUntilChanged, switchMap, of, finalize } from "rxjs";

import { ClinicalStudyService } from "../../services/clinical-study.service";
import { TrialWorkflowService } from "../../services/trial-workflow-service";
import { AuthService } from "../../services/auth.service";
import { SavedSearchService } from "../../services/saved-search.service";
import { mapDesignModelToSavedSearchCriteria } from "../../services/saved-search-criteria-mapper";
import { LoadingIndicator } from "../../primitives/loading-indicator/loading-indicator";
import { AutoCompleteInput } from "../../primitives/auto-complete-input/auto-complete-input";
import { KeywordSelector } from "../../primitives/keyword-selector/keyword-selector";
import { Tooltip } from "../../primitives/tooltip/tooltip";
import { StudyTrial } from "../../models/study-trial";
import { ClinicalTrialSearchRequest } from "@shared/dto/ClinicalTrialSearchRequest";
import { PermissionService } from "../../services/permission.service";
import { ACTION_NAMES } from "@shared/auth/action-names";
import { parseDesignerCriteriaFile } from "../../services/designer-criteria-file.service";
import { LoadingService } from "../../services/loading.service";

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
        KeywordSelector,
        Tooltip,
        DecimalPipe,
        DatePipe
    ],
    host: {
        '(document:click)': 'onDocumentClick($event)'
    },
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class Dashboard implements OnInit {
    private clinicalStudiesService = inject(ClinicalStudyService);
    protected workflowService = inject(TrialWorkflowService);
    protected authService = inject(AuthService);
    private savedSearchService = inject(SavedSearchService);
    private router = inject(Router);
    private permissionService = inject(PermissionService);
    private loadingService = inject(LoadingService);

    // Form Options
    phaseOptions = this.clinicalStudiesService.getPhases();
    allocationOptions = this.clinicalStudiesService.getAllocations();
    interventionOptions = this.clinicalStudiesService.getInterventionModels();
    blindingOptions = this.clinicalStudiesService.getMaskingTypes();
    sexOptions = this.clinicalStudiesService.getSexes();

    // Local State
    isLoading = signal(false);
    foundTrials = signal<StudyTrial[]>([]);
    expandedTrialId = signal<string | null>(null);
    conditionMatches = signal<string[]>([]);
    conditionValue = signal('');
    sortOrder = signal<'date_desc' | 'date_asc' | 'enrollment_desc' | 'enrollment_asc' | 'name_asc' | 'name_desc' | 'status_asc' | 'status_desc'>('date_desc');
    startDateFilter = signal<string>('');
    endDateFilter = signal<string>('');
    
    // Save Search State
    showSavePanel = signal(false);
    saveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
    saveErrorMessage = signal('');

    // Column Filters
    nameFilter = signal<string>('');
    statusFilter = signal<string>('');
    participantsFilter = signal<number | null>(null);
    keywordFilter = signal<string[]>([]);
    activeFilter = signal<string | null>(null);

    // Import State
    importStatus = signal<'idle' | 'success' | 'error'>('idle');
    importMessage = signal('');
    canImportCriteria = this.permissionService.watch(ACTION_NAMES.searchCriteriaImport);

    // Service State Proxies
    selectedTrialIds = this.workflowService.selectedTrialIds;

    DISPLAY_THRESHOLD = 1000;

    uniqueStatuses = computed(() => {
        const statuses = new Set(this.foundTrials().map(t => t.overallStatus));
        return Array.from(statuses).sort();
    });

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

    saveForm = new FormGroup({
        name: new FormControl<string>('', [Validators.required, Validators.maxLength(200)]),
        description: new FormControl<string>('', [Validators.maxLength(1000)]),
        visibility: new FormControl<'private' | 'shared'>('private', [Validators.required]),
    });

    displayedTrials = computed(() => {
        let trials = [...this.foundTrials()];
        
        // Apply Date Range
        const start = this.startDateFilter();
        const end = this.endDateFilter();
        if (start) trials = trials.filter(t => t.startDate >= start);
        if (end) trials = trials.filter(t => t.startDate <= end);

        // Apply Column Filters
        const nameF = this.nameFilter().toLowerCase();
        if (nameF) trials = trials.filter(t => t.briefTitle.toLowerCase().includes(nameF));

        const statusF = this.statusFilter();
        if (statusF) trials = trials.filter(t => t.overallStatus === statusF);

        const partF = this.participantsFilter();
        if (partF !== null) trials = trials.filter(t => t.enrollmentCount >= partF);

        // Apply Keyword Filter
        const keywords = this.keywordFilter();
        if (keywords.length > 0) {
            trials = trials.filter(t => {
                const combinedText = `${t.briefTitle} ${t.description} ${t.sponsor} ${t.sites.join(' ')}`.toLowerCase();
                return keywords.every(k => combinedText.includes(k.toLowerCase()));
            });
        }

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
                case 'status_asc':
                    return a.overallStatus.localeCompare(b.overallStatus);
                case 'status_desc':
                    return b.overallStatus.localeCompare(a.overallStatus);
                default:
                    return 0;
            }
        });
    });

    toggleSort(column: 'date' | 'enrollment' | 'name' | 'status') {
        const current = this.sortOrder();
        let next: any;

        switch (column) {
            case 'date':
                next = current === 'date_desc' ? 'date_asc' : 'date_desc';
                break;
            case 'enrollment':
                next = current === 'enrollment_desc' ? 'enrollment_asc' : 'enrollment_desc';
                break;
            case 'name':
                next = current === 'name_asc' ? 'name_desc' : 'name_asc';
                break;
            case 'status':
                next = current === 'status_asc' ? 'status_desc' : 'status_asc';
                break;
        }
        this.sortOrder.set(next);
    }

    toggleFilter(column: string, event: Event) {
        event.stopPropagation();
        if (this.activeFilter() === column) {
            this.activeFilter.set(null);
        } else {
            this.activeFilter.set(column);
        }
    }

    onAddKeyword(keyword: string) {
        this.keywordFilter.update(k => [...new Set([...k, keyword])]);
    }

    onRemoveKeyword(keyword: string) {
        this.keywordFilter.update(k => k.filter(v => v !== keyword));
    }

    clearFilters() {
        this.nameFilter.set('');
        this.statusFilter.set('');
        this.participantsFilter.set(null);
        this.keywordFilter.set([]);
        this.startDateFilter.set('');
        this.endDateFilter.set('');
    }

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
                blindingType: savedParams.blindingType,
                userPatients: savedParams.userPatients,
                userSites: savedParams.userSites,
                userInclusions: savedParams.userInclusions,
                userExclusions: savedParams.userExclusions,
                userOutcomes: savedParams.userOutcomes,
                userArms: savedParams.userArms
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
                this.clearFilters();
                
                // Only clear selections if this is a fresh search (no existing state in workflow service)
                const currentSelections = this.workflowService.selectedTrialIds();
                const existingParams = this.workflowService.inputParams();
                const isReturning = existingParams?.condition === values.condition;

                if (!isReturning) {
                    this.selectedTrialIds.set([]);
                }

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
                    this.workflowService.foundTrials.set(trials);
                    
                    // Smart Selection: 
                    // 1. If we have explicit saved selections (from a loaded search), use those.
                    // 2. If we are returning and already have selections, keep them.
                    // 3. Otherwise (fresh search), auto-select all results.
                    
                    const savedParams = this.workflowService.inputParams();
                    if (savedParams?.selectedTrialIds && savedParams.selectedTrialIds.length > 0) {
                        this.selectedTrialIds.set(savedParams.selectedTrialIds);
                        // Clear them from workflow service input params once applied so they don't persist across fresh searches
                        this.workflowService.setInputs({ ...savedParams, selectedTrialIds: [] });
                    } else if (this.selectedTrialIds().length === 0) {
                        const allIds = trials.map(t => t.nctId);
                        this.selectedTrialIds.set(allIds);
                    }
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

    onToggleSavePanel() {
        this.showSavePanel.update(v => !v);
        this.saveStatus.set('idle');
    }

    onSaveSearch() {
        if (this.saveForm.invalid || !this.searchForm.valid) return;

        const formValues = this.searchForm.getRawValue();
        const criteria = mapDesignModelToSavedSearchCriteria({
            condition: formValues.condition ?? '',
            phase: formValues.phase ?? '',
            allocationType: formValues.allocationType ?? '',
            interventionModel: formValues.interventionModel ?? null,
            blindingType: formValues.blindingType ?? '',
            minAge: null,
            maxAge: null,
            sex: '',
            required: [],
            ineligible: [],
            userPatients: formValues.userPatients ?? null,
            userSites: formValues.userSites ?? null,
            userInclusions: formValues.userInclusions ?? null,
            userExclusions: formValues.userExclusions ?? null,
            userOutcomes: formValues.userOutcomes ?? null,
            userArms: formValues.userArms ?? null,
            selectedTrialIds: this.selectedTrialIds()
        });

        const name = this.saveForm.value.name!;
        const description = this.saveForm.value.description ?? null;
        const visibility = this.saveForm.value.visibility!;

        this.saveStatus.set('saving');
        this.loadingService.show('Saving search criteria...');
        
        this.savedSearchService.create({
            name,
            description,
            visibility,
            criteriaJson: criteria as any
        }).pipe(
            finalize(() => this.loadingService.hide())
        ).subscribe({
            next: () => {
                this.saveStatus.set('saved');
                setTimeout(() => this.showSavePanel.set(false), 1500);
            },
            error: (err: any) => {
                this.saveStatus.set('error');
                this.saveErrorMessage.set(
                    err.status === 409
                        ? 'An equivalent search is already saved.'
                        : 'Could not save search. Please try again.'
                );
            },
        });
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
            ineligible: [],

            // User Trial Specifics
            userPatients: values.userPatients ?? null,
            userSites: values.userSites ?? null,
            userInclusions: values.userInclusions ?? null,
            userExclusions: values.userExclusions ?? null,
            userOutcomes: values.userOutcomes ?? null,
            userArms: values.userArms ?? null,
            inclusionCriteria: [],
            exclusionCriteria: [],

            // Current selections
            selectedTrialIds: this.selectedTrialIds()
        });

        this.loadingService.show('Analyzing clinical trials data...');
        this.router.navigate(['/analysis']);
    }

    onDocumentClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (this.activeFilter() && !target.closest('.filter-popover')) {
            this.activeFilter.set(null);
        }
    }

    async onImportFile(event: Event) {
        if (!this.canImportCriteria()) {
            return;
        }

        const input = event.target as HTMLInputElement | null;
        const file = input?.files?.[0];
        if (!file) return;

        try {
            const content = await file.text();
            const criteria = parseDesignerCriteriaFile(content, file.name, {
                phase: this.clinicalStudiesService.getDefaultPhase(),
                phases: this.phaseOptions,
                allocationType: this.clinicalStudiesService.getDefaultAllocation(),
                allocations: this.allocationOptions,
                interventionModels: this.interventionOptions,
                blindingType: this.clinicalStudiesService.getDefaultMaskingType(),
                blindingTypes: this.blindingOptions,
                sex: this.clinicalStudiesService.getDefaultSex(),
                sexes: this.sexOptions,
            });

            this.searchForm.patchValue({
                condition: criteria.condition,
                phase: criteria.phase,
                allocationType: criteria.allocationType,
                interventionModel: criteria.interventionModel,
                blindingType: criteria.blindingType,
                userPatients: criteria.userPatients,
                userSites: criteria.userSites,
                userInclusions: criteria.userInclusions,
                userExclusions: criteria.userExclusions,
                userOutcomes: criteria.userOutcomes,
                userArms: criteria.userArms
            });
            this.conditionValue.set(criteria.condition);
            this.workflowService.setInputs(criteria);
            this.importStatus.set('success');
            this.importMessage.set(`Imported criteria from ${file.name}.`);
            
            // Trigger search manually to ensure it happens immediately
            this.searchForm.updateValueAndValidity();
        } catch (err) {
            console.error('Import failed', err);
            this.importStatus.set('error');
            this.importMessage.set('Could not import criteria file. Use a valid JSON export.');
        } finally {
            if (input) {
                input.value = '';
            }
        }
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