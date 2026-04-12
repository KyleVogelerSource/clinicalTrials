import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DebugMessageService {
  readonly message = signal<string | null>(null);

  setMessage(message: string): void {
    this.message.set(message);
  }

  clear(): void {
    this.message.set(null);
  }
}
