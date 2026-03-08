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
        } else {
            this.suggestions.set([]);
        }
    }

    onSelectSuggestion(suggestion: string) {
        if (suggestion.trim()) {
            this.addKeyword.emit(suggestion.trim());
        }
        this.queryControl.setValue('', { emitEvent: false });
        this.suggestions.set([]);
    }

    onRemove(keyword: string) {
        this.removeKeyword.emit(keyword);
    }

    onFocus() {
        this.search(this.queryControl.value);
    }

    onEscape() {
        this.suggestions.set([]);
    }

    onDocumentClick(event: MouseEvent) {
        // If the click was outside this specific component instance, close its suggestions
        if (!this.elementRef.nativeElement.contains(event.target)) {
            this.suggestions.set([]);
        }
    }
}
