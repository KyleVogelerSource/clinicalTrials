import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from "@angular/core";
import { CommonModule, DecimalPipe, DatePipe } from "@angular/common";
import { FormControl, FormGroup, ReactiveFormsModule, FormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { debounceTime, distinctUntilChanged, switchMap, of, finalize } from "rxjs";

import { ClinicalStudyService } from "../../services/clinical-study.service";
import { TrialWorkflowService } from "../../services/trial-workflow-service";
import { AuthService } from "../../services/auth.service";
import { SavedSearchService } from "../../services/saved-search.service";
import { mapDesignModelToSavedSearchCriteria } from "../../services/saved-search-criteria-mapper";
import { LoadingIndicator } from "../../primitives/loading-indicator/loading-indicator";
import { AutoCompleteInput } from "../../primitives/auto-complete-input/auto-complete-input";
import { MultiSelect, MultiSelectOption } from "../../primitives/multi-select/multi-select";
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
        FormsModule,
        LoadingIndicator,
        AutoCompleteInput,
        MultiSelect,
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
    phaseOptions: MultiSelectOption[] = this.clinicalStudiesService.getPhases().map(p => ({ label: p, value: p }));
    allocationOptions: MultiSelectOption[] = this.clinicalStudiesService.getAllocations().map(a => ({ label: a, value: a }));
    interventionOptions: MultiSelectOption[] = this.clinicalStudiesService.getInterventionModels().map(m => ({ label: m, value: m }));
    blindingOptions: MultiSelectOption[] = this.clinicalStudiesService.getMaskingTypes().map(b => ({ label: b, value: b }));
    sexOptions = this.clinicalStudiesService.getSexes();

    // Tooltip Descriptions
    phaseDescriptions: Record<string, string> = {
        'Early Phase 1': 'Exploratory study involving very limited human exposure, no therapeutic or diagnostic intent.',
        'Phase 1': 'Initial safety and dosage testing in a small group of healthy people or patients.',
        'Phase 2': 'Testing efficacy and safety in a larger group of patients.',
        'Phase 3': 'Large scale testing against standard treatments to confirm efficacy and monitor side effects.',
        'Phase 4': 'Post-marketing surveillance to gather more information on safety and long-term effects.',
        'N/A': 'Phase not applicable for this study type (e.g., behavioral or device studies).'
    };

    allocationDescriptions: Record<string, string> = {
        'Randomized': 'Participants are assigned to study groups by chance (like a coin flip).',
        'Non-Randomized': 'Participants are assigned to study groups by the investigators.',
        'N/A': 'No group assignment is used (e.g., single-arm studies).'
    };

    interventionDescriptions: Record<string, string> = {
        'Single Group Assignment': 'All participants receive the same intervention.',
        'Parallel Assignment': 'Participants are assigned to one of two or more groups for the duration of the study.',
        'Crossover Assignment': 'Participants receive different interventions in a sequence.',
        'Factorial Assignment': 'Two or more interventions are tested simultaneously in various combinations.',
        'Sequential Assignment': 'Participants are assigned to groups in a specific order based on previous results.'
    };

    blindingDescriptions: Record<string, string> = {
        'None (Open Label)': 'Both investigators and participants know which intervention is being given.',
        'Single': 'Only the participants are unaware of which intervention they are receiving.',
        'Double': 'Both participants and investigators are unaware of group assignments.',
        'Triple': 'Participants, investigators, and outcome assessors are all unaware of assignments.',
        'Quadruple': 'Adds further layers of blinding, often including data analysts.'
    };

    // Local State
    isLoading = signal(false);
    foundTrials = signal<StudyTrial[]>([]);
    isThresholdWarningDismissed = signal(false);
    expandedTrialId = signal<string | null>(null);
    conditionMatches = signal<string[]>([]);
    conditionValue = signal('');
    sortOrder = signal<'date_desc' | 'date_asc' | 'enrollment_desc' | 'enrollment_asc' | 'name_asc' | 'name_desc' | 'status_asc' | 'status_desc'>('date_desc');
    startDateFilter = signal<string>('');
    endDateFilter = signal<string>('');
    requiredConditions = signal<string[]>([]);
    ineligibleConditions = signal<string[]>([]);
    
    // Save Search State
    showSavePanel = signal(false);
    saveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
    saveErrorMessage = signal('');

    // Column Filters
    nctIdFilter = signal<string>('');
    nameFilter = signal<string>('');
    statusFilter = signal<string[]>([]);
    participantsFilter = signal<number | null>(null);
    participantsMaxFilter = signal<number | null>(null);
    keywordFilter = signal<string[]>([]);

    statusOptions = computed<MultiSelectOption[]>(() => {
        return this.uniqueStatuses().map(s => {
            let className = 'status-badge ';
            const lower = s.toLowerCase();
            if (s === 'COMPLETED') className += 'status-completed';
            else if (lower.includes('terminated') || lower.includes('withdrawn')) className += 'status-terminated';
            else if (lower === 'unknown') className += 'status-unknown';
            else className += 'status-active';

            return {
                label: s.split('_').join(' '),
                value: s,
                class: className
            };
        });
    });

    nctIdMatches = computed(() => {
        const query = this.nctIdFilter().toLowerCase();
        if (!query) return [];
        return Array.from(new Set(this.foundTrials().map(t => t.nctId)))
            .filter(id => id.toLowerCase().includes(query))
            .slice(0, 10);
    });

    keywordMatches = signal<string[]>([]);

    // Import State
    importStatus = signal<'idle' | 'success' | 'error'>('idle');
    importMessage = signal('');
    canImportCriteria = this.permissionService.watch(ACTION_NAMES.searchCriteriaImport);

    // Service State Proxies
    selectedTrialIds = this.workflowService.selectedTrialIds;

    selectedInViewCount = computed(() => {
        const displayedIds = new Set(this.displayedTrials().map(t => t.nctId));
        return this.selectedTrialIds().filter(id => displayedIds.has(id)).length;
    });

    DISPLAY_THRESHOLD = 1000;

    uniqueStatuses = computed(() => {
        const statuses = new Set(this.foundTrials().map(t => t.overallStatus));
        return Array.from(statuses).sort();
    });

    searchForm = new FormGroup({
        condition: new FormControl<string>('', [Validators.required]),
        phase: new FormControl<string[]>([], [Validators.required, Validators.minLength(1)]),
        allocationType: new FormControl<string[]>([]),
        interventionModel: new FormControl<string[]>([]),
        blindingType: new FormControl<string[]>([]),
        
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
        
        // Apply Year Range
        const start = this.startDateFilter();
        const end = this.endDateFilter();
        if (start) trials = trials.filter(t => t.startDate.substring(0, 4) >= start);
        if (end) trials = trials.filter(t => t.startDate.substring(0, 4) <= end);

        // Apply Column Filters
        const nctF = this.nctIdFilter().toLowerCase();
        if (nctF) trials = trials.filter(t => t.nctId.toLowerCase().includes(nctF));

        const nameF = this.nameFilter().toLowerCase();
        if (nameF) trials = trials.filter(t => t.briefTitle.toLowerCase().includes(nameF));

        const statusF = this.statusFilter();
        if (statusF.length > 0) trials = trials.filter(t => statusF.includes(t.overallStatus));

        const partF = this.participantsFilter();
        if (partF !== null) trials = trials.filter(t => t.enrollmentCount >= partF);

        const partMaxF = this.participantsMaxFilter();
        if (partMaxF !== null) trials = trials.filter(t => t.enrollmentCount <= partMaxF);

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

    onNctIdSearch(query: string) {
        this.nctIdFilter.set(query);
    }

    onNctIdSelected(nctId: string) {
        this.nctIdFilter.set(nctId);
    }

    onKeywordSearch(query: string) {
        if (!query) {
            this.keywordMatches.set([]);
            return;
        }
        // Basic suggestion logic: find words from displayed trials that start with query
        const words = new Set<string>();
        const queryLower = query.toLowerCase();
        this.displayedTrials().forEach(t => {
            const text = `${t.briefTitle} ${t.description} ${t.sponsor}`.toLowerCase();
            text.split(/\s+/).forEach(word => {
                const clean = word.replace(/[^a-z0-9]/g, '');
                if (clean.startsWith(queryLower) && clean.length > 3) {
                    words.add(clean);
                }
            });
        });
        this.keywordMatches.set(Array.from(words).sort().slice(0, 10));
    }

    onAddKeywordFromInput(event: Event) {
        const input = event.target as HTMLInputElement;
        const val = input.value.trim();
        if (val) {
            this.onAddKeyword(val);
            input.value = '';
        }
    }

    onAddKeyword(keyword: string) {
        this.keywordFilter.update(k => [...new Set([...k, keyword])]);
    }

    onRemoveKeyword(keyword: string) {
        this.keywordFilter.update(k => k.filter(v => v !== keyword));
    }

    onAddRequired(keyword: string) {
        this.requiredConditions.update(k => [...new Set([...k, keyword])]);
        this.searchForm.updateValueAndValidity();
    }

    onRemoveRequired(keyword: string) {
        this.requiredConditions.update(k => k.filter(v => v !== keyword));
        this.searchForm.updateValueAndValidity();
    }

    onAddIneligible(keyword: string) {
        this.ineligibleConditions.update(k => [...new Set([...k, keyword])]);
        this.searchForm.updateValueAndValidity();
    }

    onRemoveIneligible(keyword: string) {
        this.ineligibleConditions.update(k => k.filter(v => v !== keyword));
        this.searchForm.updateValueAndValidity();
    }

    clearFilters(includeYearRange: boolean = true) {
        this.nctIdFilter.set('');
        this.nameFilter.set('');
        this.statusFilter.set([]);
        this.participantsFilter.set(null);
        this.participantsMaxFilter.set(null);
        this.keywordFilter.set([]);
        if (includeYearRange) {
            this.startDateFilter.set('');
            this.endDateFilter.set('');
        }
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
            const phases = savedParams.phase ? savedParams.phase.split(' OR ') : [this.clinicalStudiesService.getDefaultPhase()];
            const allocationArr = savedParams.allocationType ? savedParams.allocationType.split(' OR ').map(s => s.trim()).filter(Boolean) : [];
            const interventionArr = savedParams.interventionModel ? savedParams.interventionModel.split(' OR ').map(s => s.trim()).filter(Boolean) : [];
            const blindingArr = savedParams.blindingType ? savedParams.blindingType.split(' OR ').map(s => s.trim()).filter(Boolean) : [];
            
            this.searchForm.patchValue({
                condition: savedParams.condition,
                phase: phases,
                allocationType: allocationArr,
                interventionModel: interventionArr,
                blindingType: blindingArr,
                userPatients: savedParams.userPatients,
                userSites: savedParams.userSites,
                userInclusions: savedParams.userInclusions,
                userExclusions: savedParams.userExclusions,
                userOutcomes: savedParams.userOutcomes,
                userArms: savedParams.userArms
            }, { emitEvent: false });
            this.conditionValue.set(savedParams.condition || '');
            this.startDateFilter.set(savedParams.startDateFrom || '');
            this.endDateFilter.set(savedParams.startDateTo || '');
            this.requiredConditions.set(savedParams.required || []);
            this.ineligibleConditions.set(savedParams.ineligible || []);
        }

        // Setup live search
        this.searchForm.valueChanges.pipe(
            debounceTime(300),
            // Map form values and include the year range and condition signals
            switchMap(values => {
                const condition = values.condition;
                const phase = values.phase;
                const allocationType = values.allocationType;
                const interventionModel = values.interventionModel;
                const blindingType = values.blindingType;
                const startYear = this.startDateFilter();
                const endYear = this.endDateFilter();
                const required = this.requiredConditions();
                const ineligible = this.ineligibleConditions();

                return of({ 
                    condition, phase, allocationType, interventionModel, blindingType, 
                    startYear, endYear, required, ineligible 
                });
            }),
            distinctUntilChanged((prev, curr) => 
                prev.condition === curr.condition &&
                JSON.stringify(prev.phase) === JSON.stringify(curr.phase) &&
                JSON.stringify(prev.allocationType) === JSON.stringify(curr.allocationType) &&
                JSON.stringify(prev.interventionModel) === JSON.stringify(curr.interventionModel) &&
                JSON.stringify(prev.blindingType) === JSON.stringify(curr.blindingType) &&
                prev.startYear === curr.startYear &&
                prev.endYear === curr.endYear &&
                JSON.stringify(prev.required) === JSON.stringify(curr.required) &&
                JSON.stringify(prev.ineligible) === JSON.stringify(curr.ineligible)
            ),
            switchMap(params => {
                const conditionValid = params.condition && params.condition.trim().length >= 2;
                const phaseValid = params.phase && params.phase.length > 0;

                if (!conditionValid || !phaseValid) {
                    this.foundTrials.set([]);
                    return of(null);
                }

                this.isLoading.set(true);
                this.isThresholdWarningDismissed.set(false); // Reset dismissal on new search
                this.clearFilters(false); // Don't clear the year range while searching
                
                // Only clear selections if this is a fresh search (no existing state in workflow service)
                const existingParams = this.workflowService.inputParams();
                const isReturning = existingParams?.condition === params.condition;

                if (!isReturning) {
                    this.selectedTrialIds.set([]);
                }

                const request: ClinicalTrialSearchRequest = {
                    condition: params.condition as string,
                    phase: this.mapPhase(params.phase!),
                    allocationType: this.mapAllocation(params.allocationType as string[]),
                    interventionModel: this.mapIntervention(params.interventionModel as string[]),
                    blindingType: this.mapBlinding(params.blindingType as string[]),
                    startDateFrom: params.startYear || undefined,
                    startDateTo: params.endYear || undefined,
                    requiredConditions: params.required.length > 0 ? params.required : undefined,
                    ineligibleConditions: params.ineligible.length > 0 ? params.ineligible : undefined,
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
                    
                    const foundIds = new Set(trials.map(t => t.nctId));

                    // Smart Selection: 
                    // 1. If we have explicit saved selections (from a loaded search), use those (pruned).
                    // 2. If we are returning and already have selections, keep them (pruned).
                    // 3. Otherwise (fresh search), auto-select all results.
                    
                    const savedParams = this.workflowService.inputParams();
                    if (savedParams?.selectedTrialIds && savedParams.selectedTrialIds.length > 0) {
                        const pruned = savedParams.selectedTrialIds.filter(id => foundIds.has(id));
                        this.selectedTrialIds.set(pruned);
                        // Clear them from workflow service input params once applied so they don't persist across fresh searches
                        this.workflowService.setInputs({ ...savedParams, selectedTrialIds: [] });
                    } else if (this.selectedTrialIds().length === 0) {
                        const allIds = trials.map(t => t.nctId);
                        this.selectedTrialIds.set(allIds);
                    } else {
                        // Regular filter update while on the page
                        this.selectedTrialIds.update(current => current.filter(id => foundIds.has(id)));
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
        // Update the form control value as the user types to ensure validity and search triggering
        this.searchForm.controls.condition.setValue(query, { emitEvent: true });
        
        if (query && query.trim().length > 0) {
            const matches = this.clinicalStudiesService.getMatchingConditions(query.trim());
            this.conditionMatches.set(matches);
        } else {
            this.conditionMatches.set([]);
        }
    }

    onConditionSelected(condition: string) {
        this.searchForm.controls.condition.setValue(condition, { emitEvent: true });
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
        const phaseValue = this.mapPhase(formValues.phase ?? []) || '';
        const allocationValue = this.mapAllocation(formValues.allocationType ?? []) || '';
        const interventionValue = this.mapIntervention(formValues.interventionModel ?? []) || null;
        const blindingValue = this.mapBlinding(formValues.blindingType ?? []) || '';
        const criteria = mapDesignModelToSavedSearchCriteria({
            condition: formValues.condition ?? '',
            phase: phaseValue,
            allocationType: allocationValue,
            interventionModel: interventionValue,
            blindingType: blindingValue,
            minAge: null,
            maxAge: null,
            sex: '',
            required: this.requiredConditions(),
            ineligible: this.ineligibleConditions(),
            startDateFrom: this.startDateFilter() || null,
            startDateTo: this.endDateFilter() || null,
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
        const phaseValue = this.mapPhase(values.phase ?? []) || '';
        const allocationValue = this.mapAllocation(values.allocationType ?? []) || '';
        const interventionValue = this.mapIntervention(values.interventionModel ?? []) || null;
        const blindingValue = this.mapBlinding(values.blindingType ?? []) || '';
        this.workflowService.setInputs({
            condition: values.condition ?? '',
            phase: phaseValue,
            allocationType: allocationValue,
            interventionModel: interventionValue,
            blindingType: blindingValue,
            // Demographic defaults since they are removed from Dashboard for now
            minAge: null,
            maxAge: null,
            sex: '',
            required: this.requiredConditions(),
            ineligible: this.ineligibleConditions(),

            startDateFrom: this.startDateFilter() || null,
            startDateTo: this.endDateFilter() || null,

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

    onClearWorkspace() {
        if (window.confirm("Are you sure you want to clear all inputs and selections? This action cannot be undone.")) {
            this.workflowService.reset();
            this.searchForm.reset({
                condition: '',
                phase: [this.clinicalStudiesService.getDefaultPhase()],
                allocationType: [],
                interventionModel: [],
                blindingType: [],
                userPatients: null,
                userInclusions: null,
                userExclusions: null,
                userOutcomes: null,
                userSites: null,
                userArms: null
            });
            this.conditionValue.set('');
            this.startDateFilter.set('');
            this.endDateFilter.set('');
            this.requiredConditions.set([]);
            this.ineligibleConditions.set([]);
            this.foundTrials.set([]);
            this.clearFilters();
        }
    }

    onDocumentClick(_event: MouseEvent) {
        // Unused now since popovers are removed
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
                phases: this.clinicalStudiesService.getPhases(), // Re-use raw phases for import parsing
                allocationType: this.clinicalStudiesService.getDefaultAllocation(),
                allocations: this.allocationOptions.map(o => o.value),
                interventionModels: this.interventionOptions.map(o => o.value),
                blindingType: this.clinicalStudiesService.getDefaultMaskingType(),
                blindingTypes: this.blindingOptions.map(o => o.value),
                sex: this.clinicalStudiesService.getDefaultSex(),
                sexes: this.sexOptions,
            });

            const phaseArr = criteria.phase ? criteria.phase.split(' OR ') : [this.clinicalStudiesService.getDefaultPhase()];
            const allocationArr = criteria.allocationType ? criteria.allocationType.split(' OR ').map((s: string) => s.trim()).filter(Boolean) : [];
            const interventionArr = criteria.interventionModel ? criteria.interventionModel.split(' OR ').map((s: string) => s.trim()).filter(Boolean) : [];
            const blindingArr = criteria.blindingType ? criteria.blindingType.split(' OR ').map((s: string) => s.trim()).filter(Boolean) : [];

            this.searchForm.patchValue({
                condition: criteria.condition,
                phase: phaseArr,
                allocationType: allocationArr,
                interventionModel: interventionArr,
                blindingType: blindingArr,
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

    private mapPhase(phases: string[] | string): string | undefined {
        const map: Record<string, string> = {
            'Early Phase 1': 'EARLY_PHASE1',
            'Phase 1': 'PHASE1',
            'Phase 2': 'PHASE2',
            'Phase 3': 'PHASE3',
            'Phase 4': 'PHASE4',
            'N/A': 'NA'
        };

        if (Array.isArray(phases)) {
            return phases.map(p => map[p]).filter(Boolean).join(' OR ') || undefined;
        }

        return map[phases] || phases;
    }

    private mapAllocation(allocations: string[] | string | null | undefined): string | undefined {
        const map: Record<string, string> = {
            'Randomized': 'RANDOMIZED',
            'Non-Randomized': 'NON_RANDOMIZED',
            'N/A': 'NA'
        };
        if (!allocations) return undefined;
        const arr = Array.isArray(allocations) ? allocations : [allocations];
        if (arr.length === 0) return undefined;
        return arr.map(a => map[a]).filter(Boolean).join(' OR ') || undefined;
    }

    private mapIntervention(models: string | string[] | null | undefined): string | undefined {
        const map: Record<string, string> = {
            'Single Group Assignment': 'SINGLE_GROUP',
            'Parallel Assignment': 'PARALLEL',
            'Crossover Assignment': 'CROSSOVER',
            'Factorial Assignment': 'FACTORIAL',
            'Sequential Assignment': 'SEQUENTIAL'
        };
        if (!models) return undefined;
        const arr = Array.isArray(models) ? models : [models];
        if (arr.length === 0) return undefined;
        return arr.map(m => map[m]).filter(Boolean).join(' OR ') || undefined;
    }

    private mapBlinding(blindings: string[] | string | null | undefined): string | undefined {
        const map: Record<string, string> = {
            'None (Open Label)': 'NONE',
            'Single': 'SINGLE',
            'Double': 'DOUBLE',
            'Triple': 'TRIPLE',
            'Quadruple': 'QUADRUPLE'
        };
        if (!blindings) return undefined;
        const arr = Array.isArray(blindings) ? blindings : [blindings];
        if (arr.length === 0) return undefined;
        return arr.map(b => map[b]).filter(Boolean).join(' OR ') || undefined;
    }
}