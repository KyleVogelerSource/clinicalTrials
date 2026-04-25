import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
    selector: 'app-loading-indicator',
    standalone: true,
    templateUrl: './loading-indicator.html',
    styleUrl: './loading-indicator.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingIndicator {
    visible = input(false);
    message = input<string | null>(null);
}
