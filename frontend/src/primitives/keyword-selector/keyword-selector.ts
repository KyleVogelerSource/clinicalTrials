import { Component, ChangeDetectionStrategy, input, output, inject, signal } from '@angular/core';
import { ClinicalStudyService } from "../../services/clinical-study.service";
import { AutoCompleteInput } from "../auto-complete-input/auto-complete-input";

@Component({
    selector: 'app-keyword-selector',
    standalone: true,
    imports: [AutoCompleteInput],
    templateUrl: './keyword-selector.html',
    styleUrl: './keyword-selector.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class KeywordSelector {
    inputId = input<string>('');
    placeholderText = input<string>('');
    selectedKeywords = input<string[]>([]);

    addKeyword = output<string>();
    removeKeyword = output<string>();

    suggestions = signal<string[]>([]);

    clinicalStudyService = inject(ClinicalStudyService);

    onSearchQueryChange(query: string) {
        if (query && query.trim().length > 0) {
            const keywords = this.clinicalStudyService.getSuggestedKeywords(query);
            this.suggestions.set(keywords);
        } else {
            this.suggestions.set([]);
        }
    }

    onSelectSuggestion(suggestion: string) {
        if (suggestion.trim()) {
            this.addKeyword.emit(suggestion.trim());
        }
        this.suggestions.set([]);
    }

    onRemove(keyword: string) {
        this.removeKeyword.emit(keyword);
    }
}
