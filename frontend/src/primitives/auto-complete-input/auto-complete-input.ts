import { Component, ChangeDetectionStrategy, input, output, ElementRef, inject, linkedSignal, signal, effect, OnDestroy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
    selector: 'app-auto-complete-input',
    standalone: true,
    imports: [ReactiveFormsModule],
    templateUrl: './auto-complete-input.html',
    styleUrl: './auto-complete-input.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '(document:click)': 'onDocumentClick($event)'
    }
})
export class AutoCompleteInput implements OnDestroy {
    inputId = input<string>('');
    placeholderText = input<string>('');
    suggestions = input.required<string[]>();
    clearOnSelect = input<boolean>(true);
    value = input<string>('');

    searchQueryChange = output<string>();
    itemSelected = output<string>();

    elementRef = inject(ElementRef);
    queryControl = new FormControl('');
    isOpen = signal(false);

    ngOnDestroy() {
        window.removeEventListener('scroll', this.closeOnScroll, true);
    }

    private closeOnScroll = (event: Event) => {
        if (this.isOpen()) {
            const panel = this.elementRef.nativeElement.querySelector('.suggestions-list');
            if (panel && panel.contains(event.target as Node)) {
                return;
            }
            this.isOpen.set(false);
            window.removeEventListener('scroll', this.closeOnScroll, true);
        }
    };

    // Sync input value to control
    private valueSync = effect(() => {
        const val = this.value();
        if (val !== this.queryControl.value) {
            this.queryControl.setValue(val, { emitEvent: false });
        }
    });

    private openStateSync = effect(() => {
        if (this.isOpen()) {
            window.addEventListener('scroll', this.closeOnScroll, true);
        } else {
            window.removeEventListener('scroll', this.closeOnScroll, true);
        }
    });

    highlightedIndex = linkedSignal({
        source: this.suggestions,
        computation: () => -1
    });

    constructor() {
        this.queryControl.valueChanges.pipe(
            debounceTime(300),
            distinctUntilChanged()
        ).subscribe(value => {
            this.searchQueryChange.emit(value || '');
            this.isOpen.set(true);
        });
    }

    onFocus() {
        this.isOpen.set(true);
        this.searchQueryChange.emit(this.queryControl.value || '');
    }

    onKeyDown(event: KeyboardEvent) {
        const count = this.suggestions().length;

        if (count > 0 && this.isOpen()) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.highlightedIndex.update(i => i + 1 >= count ? -1 : i + 1);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.highlightedIndex.update(i => i <= 0 ? count - 1 : i - 1);
            } else if (event.key === 'Enter') {
                event.preventDefault();
                const index = this.highlightedIndex();
                if (index >= 0) {
                    this.onSelectSuggestion(this.suggestions()[index]);
                } else if (this.queryControl.value) {
                    this.onSelectSuggestion(this.queryControl.value);
                }
            } else if (event.key === 'Escape') {
                this.isOpen.set(false);
            }
        } else if (event.key === 'Enter' && this.queryControl.value) {
             event.preventDefault();
             this.onSelectSuggestion(this.queryControl.value);
        }
    }

    onSelectSuggestion(suggestion: string) {
        const value = suggestion.trim();
        if (value) {
            this.itemSelected.emit(value);
        }
        
        if (this.clearOnSelect()) {
            this.queryControl.setValue('', { emitEvent: false });
        } else {
            this.queryControl.setValue(value, { emitEvent: false });
        }
        
        this.isOpen.set(false);
        this.highlightedIndex.set(-1);
    }

    onBlur() {
        const val = this.queryControl.value?.trim();
        if (val) {
            this.itemSelected.emit(val);
            if (this.clearOnSelect()) {
                this.queryControl.setValue('', { emitEvent: false });
            }
        }
        this.isOpen.set(false);
    }

    onDocumentClick(event: MouseEvent) {
        if (!this.elementRef.nativeElement.contains(event.target)) {
            this.isOpen.set(false);
        }
    }
}
