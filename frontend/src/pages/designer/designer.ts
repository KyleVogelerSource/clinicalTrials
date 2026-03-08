import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from "@angular/forms";
import { ProgressTrack } from "../../primitives/progress-track/progress-track";
import { KeywordSelector } from "../../primitives/keyword-selector/keyword-selector";
import { debounceTime, distinctUntilChanged, map } from "rxjs";
import { ClinicalStudyService } from "../../services/clinical-study.service";

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

    conditionMatches = signal<string[]>([]);
    keywords = signal<string[]>([]);

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
        sex: new FormControl<SexEnum>(SexEnum.Any)
    });

    constructor() {
        this.inputForm.controls.condition.valueChanges.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            map(val => this.clinicalStudiesService.getMatchingConditions(val))
        ).subscribe(matches => this.conditionMatches.set(matches));
    }

    onAddKeyword(tag: string) {
        if (!this.keywords().includes(tag)) {
            this.keywords.update(tags => [...tags, tag]);
        }
    }

    onRemoveKeyword(tag: string) {
        this.keywords.update(tags => tags.filter(t => t !== tag));
    }

    onNext() {
        console.log('Form data:', this.inputForm.value, 'Keywords:', this.keywords());
    }
}
