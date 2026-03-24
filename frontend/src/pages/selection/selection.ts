import { ChangeDetectionStrategy, Component, computed, inject, signal, effect } from '@angular/core';
import { ProgressTrack } from '../../primitives/progress-track/progress-track';
import { KeywordSelector } from '../../primitives/keyword-selector/keyword-selector';
import { Router } from '@angular/router';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { TrialWorkflowService } from '../../services/trial-workflow-service';
import { ClinicalStudyService, StudyTrial } from '../../services/clinical-study.service';

@Component({
    selector: 'app-selection',
    templateUrl: './selection.html',
    styleUrl: './selection.css',
    standalone: true,
    imports: [ProgressTrack, KeywordSelector, CommonModule, DecimalPipe, DatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class Selection {
    router = inject(Router);
    workflowService = inject(TrialWorkflowService);

    // Proxy signals from the service
    foundTrials = this.workflowService.foundTrials;
    filterWords = this.workflowService.filterWords;
    fromDate = this.workflowService.fromDate;
    toDate = this.workflowService.toDate;

    expandedTrialId = signal<string | null>(null);
    selectedTrialIds = this.workflowService.selectedTrialIds;

    DISPLAY_THRESHOLD = 1000;

    filteredTrials = computed<StudyTrial[]>(() => {
        const keywords = this.workflowService.filterWords();
        const from = this.workflowService.fromDate();
        const to = this.workflowService.toDate();
        const trials = this.workflowService.foundTrials() as StudyTrial[];

        return trials.filter(trial => {
            // Date range filter
            if (from && trial.startDate < from) return false;
            if (to && trial.startDate > to) return false;

            // Keyword filter — trial must match ALL keywords
            if (keywords.length > 0) {
                const text = (trial.briefTitle + ' ' + trial.conditions.join(' ')).toLowerCase();
                if (!keywords.every(kw => text.includes(kw.toLowerCase()))) return false;
            }

            return true;
        });
    });

    isAllSelected = computed(() => {
        const filtered = this.filteredTrials();
        const selected = this.selectedTrialIds();
        if (filtered.length === 0) return false;
        return filtered.every(trial => selected.includes(trial.nctId));
    });

    constructor() {
        // Automatically select all if filtered count is below threshold
        effect(() => {
            const filtered = this.filteredTrials();
            const currentSelected = this.selectedTrialIds();

            if (filtered.length < this.DISPLAY_THRESHOLD) {
                const filteredIds = filtered.map(t => t.nctId);
                // If selection is empty, auto-select all
                if (currentSelected.length === 0 && filteredIds.length > 0) {
                     this.selectedTrialIds.set(filteredIds);
                }
            } else {
                // If over threshold, clear selection as table is hidden and filtering is required
                if (currentSelected.length > 0) {
                    this.selectedTrialIds.set([]);
                }
            }
        });
    }

    isTrialSelected(id: string): boolean {
        return this.selectedTrialIds().includes(id);
    }

    toggleTrialSelection(id: string) {
        this.selectedTrialIds.update(ids => {
            if (ids.includes(id)) {
                return ids.filter(i => i !== id);
            } else {
                return [...ids, id];
            }
        });
    }

    toggleAllSelection() {
        if (this.isAllSelected()) {
            const filteredIds = this.filteredTrials().map(t => t.nctId);
            this.selectedTrialIds.update(ids => ids.filter(id => !filteredIds.includes(id)));
        } else {
            const filteredIds = this.filteredTrials().map(t => t.nctId);
            this.selectedTrialIds.update(ids => {
                const newIds = new Set([...ids, ...filteredIds]);
                return Array.from(newIds);
            });
        }
    }

    onAddKeyword(keyword: string) {
        this.workflowService.filterWords.update(keywords => [...keywords, keyword]);
    }

    onRemoveKeyword(keyword: string) {
        this.workflowService.filterWords.update(keywords => keywords.filter(k => k !== keyword));
    }

    onFromDateChange(event: Event) {
        const input = event.target as HTMLInputElement;
        this.workflowService.fromDate.set(input.value);
    }

    onToDateChange(event: Event) {
        const input = event.target as HTMLInputElement;
        this.workflowService.toDate.set(input.value);
    }

    toggleTrialExpansion(trialId: string) {
        this.expandedTrialId.update(current => current === trialId ? null : trialId);
    }

    onPrevious() {
        this.router.navigate(['/designer']);
    }

    onNext() {
        this.workflowService.processResults();
        this.router.navigate(['/results']);
    }
}
