import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
    selector: 'app-tooltip',
    standalone: true,
    templateUrl: './tooltip.html',
    styleUrl: './tooltip.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class Tooltip {
    text = input.required<string>();
}
