import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from "@angular/forms";
import { ProgressTrack } from "../../primitives/progress-track/progress-track";
import { debounceTime, distinctUntilChanged, map } from "rxjs";

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
    imports: [ ReactiveFormsModule, ProgressTrack ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class Designer {
    conditionMatches = signal<string[]>([]);

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
            map(val => [val + 'test', val + 'one', val + 'two', val + 'three'])
        ).subscribe(matches => this.conditionMatches.set(matches));
    }

    onNext() {
        console.log('Form data:', this.inputForm.value);
    }
}