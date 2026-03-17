import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { ProgressTrack } from "../../primitives/progress-track/progress-track";
import { KeywordSelector } from "../../primitives/keyword-selector/keyword-selector";
import { AutoCompleteInput } from "../../primitives/auto-complete-input/auto-complete-input";
import { ClinicalStudyService } from "../../services/clinical-study.service";
import { TrialResultsRequest } from "../../../../shared/src/dto/TrialResultsRequest";

@Component({
    selector: "app-designer",
    templateUrl: "./designer.html",
    styleUrl: "./designer.css",
    imports: [ ReactiveFormsModule, ProgressTrack, KeywordSelector, AutoCompleteInput ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class Designer {
    clinicalStudiesService = inject(ClinicalStudyService);
    router = inject(Router);

    conditionMatches = signal<string[]>([]);
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
        const v = this.inputForm.value;
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
        this.router.navigate(['/results'], { state: { request } });
    }
}
