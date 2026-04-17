import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from "@angular/core";
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { ProgressTrack } from "../../primitives/progress-track/progress-track";
import { KeywordSelector } from "../../primitives/keyword-selector/keyword-selector";
import { AutoCompleteInput } from "../../primitives/auto-complete-input/auto-complete-input";
import { ClinicalStudyService } from "../../services/clinical-study.service";
import { TrialWorkflowService } from "../../services/trial-workflow-service";
import { DesignModel } from "../../models/design-model";
import { AuthService } from "../../services/auth.service";
import { SavedSearchService } from "../../services/saved-search.service";
import { PermissionService } from "../../services/permission.service";
import { mapDesignModelToSavedSearchCriteria } from "../../services/saved-search-criteria-mapper";
import {
    parseDesignerCriteriaFile,
} from "../../services/designer-criteria-file.service";
import { ACTION_NAMES } from "@shared/auth/action-names";

const DESIGNER_IMPORT_HELP_DISMISSED_KEY = 'designer_import_help_dismissed';

@Component({
    selector: "app-designer",
    templateUrl: "./designer.html",
    styleUrl: "./designer.css",
    imports: [ ReactiveFormsModule, ProgressTrack, KeywordSelector, AutoCompleteInput ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class Designer implements OnInit {
    clinicalStudiesService = inject(ClinicalStudyService);
    workflowService = inject(TrialWorkflowService);
    router = inject(Router);
    authService = inject(AuthService);
    savedSearchService = inject(SavedSearchService);
    permissionService = inject(PermissionService);

    conditionMatches = signal<string[]>([]);
    conditionValue = signal<string>('');
    requiredConditions = signal<string[]>([]);
    ineligibleConditions = signal<string[]>([]);
    showSavePanel = signal(false);
    saveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
    saveErrorMessage = signal('');
    importStatus = signal<'idle' | 'success' | 'error'>('idle');
    importMessage = signal('');
    showImportHelp = signal(true);
    canImportCriteria = this.permissionService.watch(ACTION_NAMES.searchCriteriaImport);

    saveForm = new FormGroup({
        name: new FormControl<string>('', [Validators.required, Validators.maxLength(200)]),
        description: new FormControl<string | null>(null),
        visibility: new FormControl<'private' | 'shared'>('private', [Validators.required]),
    });

    phaseOptions = this.clinicalStudiesService.getPhases();
    allocationOptions = this.clinicalStudiesService.getAllocations();
    interventionOptions = this.clinicalStudiesService.getInterventionModels();
    blindingOptions = this.clinicalStudiesService.getMaskingTypes();
    sexOptions = this.clinicalStudiesService.getSexes();

    inputForm = new FormGroup({
        condition: new FormControl<string>('', [Validators.required]),
        phase: new FormControl<string>(this.clinicalStudiesService.getDefaultPhase(), [Validators.required]),
        allocationType: new FormControl<string>(this.clinicalStudiesService.getDefaultAllocation(), [Validators.required]),
        interventionModel: new FormControl<string | null>(null),
        blindingType: new FormControl<string>(this.clinicalStudiesService.getDefaultMaskingType(), [Validators.required]),
        minAge: new FormControl<number | null>(null, [Validators.min(0), Validators.max(150)]),
        maxAge: new FormControl<number | null>(null, [Validators.min(0), Validators.max(150)]),
        sex: new FormControl<string>(this.clinicalStudiesService.getDefaultSex()),
        // hidden fields
        required: new FormControl<string[]>([]),
        ineligible: new FormControl<string[]>([]),
    });

    ngOnInit() {
        this.showImportHelp.set(!this.getStoredImportHelpDismissed());
        const savedParams = this.workflowService.inputParams();
        if (savedParams) {
            this.inputForm.patchValue(savedParams);
            this.conditionValue.set(savedParams.condition || '');
            this.requiredConditions.set(savedParams.required || []);
            this.ineligibleConditions.set(savedParams.ineligible || []);
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
        this.inputForm.controls.condition.setValue(condition);
        this.conditionValue.set(condition);
        this.conditionMatches.set([]);
    }

    onAddRequired(tag: string) {
        if (!this.requiredConditions().includes(tag)) {
            this.requiredConditions.update(tags => {
                const updated = [...tags, tag];
                this.inputForm.controls.required.setValue(updated);
                return updated;
            });
        }
    }

    onRemoveRequired(tag: string) {
        this.requiredConditions.update(tags => {
            const updated = tags.filter(t => t !== tag);
            this.inputForm.controls.required.setValue(updated);
            return updated;
        });
    }

    onAddIneligible(tag: string) {
        if (!this.ineligibleConditions().includes(tag)) {
            this.ineligibleConditions.update(tags => {
                const updated = [...tags, tag];
                this.inputForm.controls.ineligible.setValue(updated);
                return updated;
            });
        }
    }

    onRemoveIneligible(tag: string) {
        this.ineligibleConditions.update(tags => {
            const updated = tags.filter(t => t !== tag);
            this.inputForm.controls.ineligible.setValue(updated);
            return updated;
        });
    }

    onNext() {
        const model = this.inputForm.value as DesignModel;
        this.workflowService.setInputs(model);
        this.workflowService.searchTrials();
        this.router.navigate(['/selection']);
    }

    onToggleSavePanel() {
        this.showSavePanel.update(v => !v);
        this.saveStatus.set('idle');
    }

    onSaveSearch() {
        if (this.saveForm.invalid || !this.inputForm.valid) return;

        const formValues = this.inputForm.getRawValue();
        const criteria = mapDesignModelToSavedSearchCriteria(formValues);

        const name = this.saveForm.value.name!;
        const description = this.saveForm.value.description ?? null;
        const visibility = this.saveForm.value.visibility!;

        this.saveStatus.set('saving');
        this.savedSearchService.create({ name, description, criteriaJson: criteria, visibility }).subscribe({
            next: () => {
                this.saveStatus.set('saved');
                this.saveForm.reset({ visibility: 'private' });
            },
            error: (err: { status?: number }) => {
                this.saveStatus.set('error');
                this.saveErrorMessage.set(
                    err?.status === 409
                        ? 'An equivalent search is already saved.'
                        : 'Could not save search. Please try again.'
                );
            },
        });
    }

    onDismissImportHelp() {
        this.showImportHelp.set(false);
        this.setStoredImportHelpDismissed(true);
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

            this.inputForm.patchValue(criteria);
            this.conditionValue.set(criteria.condition);
            this.requiredConditions.set(criteria.required);
            this.ineligibleConditions.set(criteria.ineligible);
            this.workflowService.setInputs(criteria);
            this.workflowService.setImportNotice(`Imported criteria from ${file.name}.`);
            this.workflowService.searchTrials();
            this.importStatus.set('success');
            this.importMessage.set(`Imported criteria from ${file.name}.`);
            this.router.navigate(['/selection']);
        } catch {
            this.importStatus.set('error');
            this.importMessage.set('Could not import criteria file. Use a valid JSON export.');
        } finally {
            if (input) {
                input.value = '';
            }
        }
    }

    private getStoredImportHelpDismissed(): boolean {
        try {
            return globalThis.localStorage?.getItem(DESIGNER_IMPORT_HELP_DISMISSED_KEY) === 'true';
        } catch {
            return false;
        }
    }

    private setStoredImportHelpDismissed(dismissed: boolean) {
        try {
            globalThis.localStorage?.setItem(DESIGNER_IMPORT_HELP_DISMISSED_KEY, dismissed ? 'true' : 'false');
        } catch {
            // ignore localStorage access failures
        }
    }
}
