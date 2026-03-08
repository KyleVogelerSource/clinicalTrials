import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-progress-track',
  standalone: true,
  templateUrl: './progress-track.html',
  styleUrl: './progress-track.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProgressTrack {
  activeStep = input<number>(1);

  steps = [
    { id: 1, label: 'Input' },
    { id: 2, label: 'Refine' },
    { id: 3, label: 'Results' }
  ];
}
