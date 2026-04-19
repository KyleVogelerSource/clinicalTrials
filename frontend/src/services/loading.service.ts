import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class LoadingService {
    readonly isLoading = signal(false);
    readonly message = signal<string | null>(null);

    show(message: string | null = null): void {
        this.message.set(message);
        this.isLoading.set(true);
    }

    hide(): void {
        this.isLoading.set(false);
        this.message.set(null);
    }
}
