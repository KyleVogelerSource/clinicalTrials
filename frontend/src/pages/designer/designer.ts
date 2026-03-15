import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from "@angular/forms";
import { ProgressTrack } from "../../primitives/progress-track/progress-track";
import { KeywordSelector } from "../../primitives/keyword-selector/keyword-selector";
import { debounceTime, distinctUntilChanged, map } from "rxjs";
import { ClinicalStudyService } from "../../services/clinical-study.service";

export enum SexEnum {
    Any = 'Any',
    Male = 'Male',
    Female = 'Female'
}

@Component({
    selector: "app-designer",
    templateUrl: "./designer.html",
    styleUrl: "./designer.css",
    imports: [ ReactiveFormsModule, ProgressTrack, KeywordSelector ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class Designer {
    clinicalStudiesService = inject(ClinicalStudyService);

    conditionMatches = signal<string[]>([]);
    requiredConditions = signal<string[]>([]);
    ineligibleConditions = signal<string[]>([]);

    phaseOptions = this.clinicalStudiesService.getPhases();
    allocationOptions = this.clinicalStudiesService.getAllocations();
    interventionOptions = this.clinicalStudiesService.getInterventionModels();
    blindingOptions = this.clinicalStudiesService.getMaskingTypes();
    sexOptions = Object.values(SexEnum);

    inputForm = new FormGroup({
        condition: new FormControl<string>('', [Validators.required]),
        phase: new FormControl<string | null>(null, [Validators.required]),
        allocationType: new FormControl<string | null>(null, [Validators.required]),
        interventionModel: new FormControl<string | null>(null, [Validators.required]),
        blindingType: new FormControl<string | null>(null, [Validators.required]),
        minAge: new FormControl<number | null>(null, [Validators.min(0), Validators.max(150)]),
        maxAge: new FormControl<number | null>(null, [Validators.min(0), Validators.max(150)]),
        sex: new FormControl<SexEnum>(SexEnum.Any),
        // hidden fields
        required: new FormControl<string[]>([]),
        ineligible: new FormControl<string[]>([]),
    });

    constructor() {
        this.inputForm.controls.condition.valueChanges.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            map(val => this.clinicalStudiesService.getMatchingConditions(val))
        ).subscribe(matches => this.conditionMatches.set(matches));
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
        console.log('Form data:', this.inputForm.value);
    }
}
