import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from "@angular/core";
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { ProgressTrack } from "../../primitives/progress-track/progress-track";
import { KeywordSelector } from "../../primitives/keyword-selector/keyword-selector";
import { AutoCompleteInput } from "../../primitives/auto-complete-input/auto-complete-input";
import { ClinicalStudyService } from "../../services/clinical-study.service";
import { TrialWorkflowService } from "../../services/trial-workflow-service";
import { DesignModel } from "../../models/design-model";

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

    conditionMatches = signal<string[]>([]);
    conditionValue = signal<string>('');
    requiredConditions = signal<string[]>([]);
    ineligibleConditions = signal<string[]>([]);

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
}
