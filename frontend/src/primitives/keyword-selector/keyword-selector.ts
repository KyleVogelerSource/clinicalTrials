import { Component, ChangeDetectionStrategy, input, output, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ClinicalStudyService } from "../../services/clinical-study.service";

@Component({
    selector: 'app-keyword-selector',
    imports: [ReactiveFormsModule],
    templateUrl: './keyword-selector.html',
    styleUrl: './keyword-selector.css',
    changeDetection: ChangeDetectionStrategy.OnPush
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
            }
        });
    }

    onSelectSuggestion(suggestion: string) {
        this.addKeyword.emit(suggestion);
        this.queryControl.setValue('');
    }

    onRemove(keyword: string) {
        this.removeKeyword.emit(keyword);
    }
}
