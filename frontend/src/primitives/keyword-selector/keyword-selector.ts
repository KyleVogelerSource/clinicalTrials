import { Component, ChangeDetectionStrategy, input, output, inject, signal, ElementRef } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ClinicalStudyService } from "../../services/clinical-study.service";

@Component({
    selector: 'app-keyword-selector',
    standalone: true,
    imports: [ReactiveFormsModule],
    templateUrl: './keyword-selector.html',
    styleUrl: './keyword-selector.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '(document:click)': 'onDocumentClick($event)'
    }
})
export class KeywordSelector {
    inputId = input<string>('');
    placeholderText = input<string>('');
    selectedKeywords = input<string[]>([]);

    addKeyword = output<string>();
    removeKeyword = output<string>();

    suggestions = signal<string[]>([]);
    highlightedIndex = signal<number>(-1);

    clinicalStudyService = inject(ClinicalStudyService);
    elementRef = inject(ElementRef);

    queryControl = new FormControl('');

    constructor() {
        this.queryControl.valueChanges.pipe(
            debounceTime(300),
            distinctUntilChanged()
        ).subscribe(value => {
            this.search(value);
        });
    }

    private search(value: string | null) {
        if (value && value.trim().length > 0) {
            let keywords = this.clinicalStudyService.getSuggestedKeywords(value);
            this.suggestions.set(keywords);
            this.highlightedIndex.set(-1); // Reset highlight when results change
        } else {
            this.suggestions.set([]);
            this.highlightedIndex.set(-1);
        }
    }

    onKeyDown(event: KeyboardEvent) {
        const count = this.suggestions().length;

        if (count > 0) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.highlightedIndex.update(i => {
                    if (i == -1)
                        return 0;

                    return (i + 1 >= count ? -1 : i + 1);
                });
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.highlightedIndex.update(i => {
                    if (i == -1)
                        return count - 1;

                    return (i <= 0 ? -1 : i - 1);
                });
            } else if (event.key === 'Enter') {
                const index = this.highlightedIndex();
                if (index >= 0) {
                    event.preventDefault();
                    this.onSelectSuggestion(this.suggestions()[index]);
                }
            }
        }
        
        if (event.key === 'Escape') {
            this.onEscape();
        }
    }

    onSelectSuggestion(suggestion: string) {
        if (suggestion.trim()) {
            this.addKeyword.emit(suggestion.trim());
        }
        this.queryControl.setValue('', { emitEvent: false });
        this.suggestions.set([]);
        this.highlightedIndex.set(-1);
    }

    onRemove(keyword: string) {
        this.removeKeyword.emit(keyword);
    }

    onFocus() {
        this.search(this.queryControl.value);
    }

    onEscape() {
        this.suggestions.set([]);
        this.highlightedIndex.set(-1);
    }

    onDocumentClick(event: MouseEvent) {
        if (!this.elementRef.nativeElement.contains(event.target)) {
            this.suggestions.set([]);
            this.highlightedIndex.set(-1);
        }
    }
}
