import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { ProgressTrack } from "../../primitives/progress-track/progress-track";
import { KeywordSelector } from "../../primitives/keyword-selector/keyword-selector";
import { debounceTime, distinctUntilChanged, map } from "rxjs";
import { ClinicalStudyService } from "../../services/clinical-study.service";
import { TrialResultsRequest } from "../../../../shared/src/dto/TrialResultsRequest";

// TODO: These should likely be shared enums
export enum PhaseEnum {
    PHASE_1 = 'Phase I',
    PHASE_2 = 'Phase II',
    PHASE_3 = 'Phase III',
    PHASE_4 = 'Phase IV',
}

export enum SexEnum {
    Any = 'Any',
    Male = 'Male',
    Female = 'Female'
}

export enum AllocationEnum {
    RANDOMIZED = 'Randomized',
    NON_RANDOMIZED = 'Non-Randomized',
    NA = 'N/A'
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
    router = inject(Router);

    conditionMatches = signal<string[]>([]);
    requiredConditions = signal<string[]>([]);
    ineligibleConditions = signal<string[]>([]);

    phaseOptions = Object.values(PhaseEnum);
    sexOptions = Object.values(SexEnum);
    allocationOptions = Object.values(AllocationEnum);

    inputForm = new FormGroup({
        condition: new FormControl<string>(''),
        phase: new FormControl<PhaseEnum | null>(null),
        allocationType: new FormControl<AllocationEnum>(AllocationEnum.NA),
        interventionModel: new FormControl(''),
        blindingType: new FormControl(''),
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
