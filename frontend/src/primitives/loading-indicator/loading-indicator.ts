import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
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
    
    // Allows manual control for local spinners (e.g. inside a div)
    visible = input<boolean | undefined>(undefined);
    
    // If true, doesn't use the fixed full-screen overlay
    local = input<boolean>(false);

    isLoading() {
        return this.visible() !== undefined ? this.visible() : this.loadingService.isLoading();
    }
}

