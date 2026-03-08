import { Component, ChangeDetectionStrategy, input, output, inject, signal } from '@angular/core';
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
    placeholderText = input<string>('');
    selectedKeywords = input<string[]>([]);

    addKeyword = output<string>();
    removeKeyword = output<string>();

    suggestions = signal<string[]>([]);

    clinicalStudyService = inject(ClinicalStudyService);

    queryControl = new FormControl('');

    constructor() {
        this.queryControl.valueChanges.pipe(
            debounceTime(300),
            distinctUntilChanged()
        ).subscribe(value => {
            if (value) {
                let keywords = this.clinicalStudyService.getSuggestedKeywords(value);
                this.suggestions.set(keywords);
            } else {
                this.suggestions.set([]);
            }
        });
    }

    onSelectSuggestion(suggestion: string) {
        if (suggestion.trim()) {
            this.addKeyword.emit(suggestion.trim());
        }
        this.queryControl.setValue('', { emitEvent: false }); // Don't trigger search again
        this.suggestions.set([]); // Force close
    }

    onRemove(keyword: string) {
        this.removeKeyword.emit(keyword);
    }

    // Close the dropdown if clicking outside the component
    onDocumentClick(event: MouseEvent) {
        this.suggestions.set([]);
    }

    // Stop propagation so clicking inside doesn't close it immediately
    onInsideClick(event: MouseEvent) {
        event.stopPropagation();
    }
}
