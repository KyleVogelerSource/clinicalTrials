import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ReactiveFormsModule, FormGroup, FormControl } from "@angular/forms";
import { ProgressTrack } from "../../primitives/progress-track/progress-track";

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
    phaseOptions = Object.values(PhaseEnum);
    sexOptions = Object.values(SexEnum);
    allocationOptions = Object.values(AllocationEnum);

    inputForm = new FormGroup({
        condition: new FormControl<string>(''),
        phase: new FormControl<PhaseEnum | null>(null),
        allocationType: new FormControl<AllocationEnum | null>(null),
        interventionModel: new FormControl(''),
        blindingType: new FormControl(''),
        minAge: new FormControl<number | null>(null),
        maxAge: new FormControl<number | null>(null),
        sex: new FormControl<SexEnum>(SexEnum.Any)
    });

    onNext() {
        console.log('Form data:', this.inputForm.value);
    }
}