import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LoadingService } from '../../services/loading.service';

@Component({
    selector: 'app-loading-indicator',
    standalone: true,
    templateUrl: './loading-indicator.html',
    styleUrl: './loading-indicator.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingIndicator {
    loadingService = inject(LoadingService);
}
