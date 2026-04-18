import { ChangeDetectionStrategy, Component, computed, inject, signal, effect } from '@angular/core';
import { ProgressTrack } from '../../primitives/progress-track/progress-track';
import { KeywordSelector } from '../../primitives/keyword-selector/keyword-selector';
import { Router } from '@angular/router';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { TrialWorkflowService } from '../../services/trial-workflow-service';
import { PermissionService } from '../../services/permission.service';
import { StudyTrial } from '../../models/study-trial';
import { buildDesignerExportJson } from '../../services/designer-criteria-file.service';
import { ACTION_NAMES } from '@shared/auth/action-names';

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
    permissionService = inject(PermissionService);

    private lastFoundTrialsKey = '';
    private shouldAutoSelectForCurrentResults = true;

    // Proxy signals from the service
    foundTrials = this.workflowService.foundTrials;
    filterWords = this.workflowService.filterWords;
    fromDate = this.workflowService.fromDate;
    toDate = this.workflowService.toDate;
    importNotice = this.workflowService.importNotice;

    expandedTrialId = signal<string | null>(null);
    selectedTrialIds = this.workflowService.selectedTrialIds;
    canCompareTrials = this.permissionService.watch(ACTION_NAMES.trialBenchmarking);
    hasCriteriaToExport = computed(() => this.workflowService.inputParams() !== null);
    canExportCriteria = this.permissionService.watch(ACTION_NAMES.searchCriteriaExport);

    DISPLAY_THRESHOLD = 1000;

    smartSuggestions = computed(() => {
        const trials = this.filteredTrials();
        const currentKeywords = this.workflowService.filterWords().map(kw => kw.toLowerCase());

        
        if (trials.length === 0) return [];

        const wordCounts = new Map<string, number>();
        const stopWords = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'and', 'or', 'is', 'are', 'was', 'were', 'study', 'trial', 'evaluation', 'new', 'treatment', 'novel']);

        trials.forEach(trial => {
            // Extract from title and conditions
            const text = (trial.briefTitle + ' ' + trial.conditions.join(' ')).toLowerCase();
            const words = text.match(/\b\w{3,}\b/g) || [];
            
            // Unique words per trial to count frequency across trials
            const uniqueWords = new Set(words);
            uniqueWords.forEach(word => {
                if (!stopWords.has(word) && !currentKeywords.includes(word)) {
                    wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
                }
            });
        });

        // Filter and sort: must appear in > 1 trial (unless only few trials total), and not lead to 0 results
        // For simplicity, we just take top 5 most frequent that meet a minimum count.
        return Array.from(wordCounts.entries())
            .filter(([_, count]) => count > 1) // Only suggest if it helps group at least 2 trials
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);
    });

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

    compareDisabled = computed(() => {
        const count = this.selectedTrialIds().length;
        return count < 2 || count > 5;
    });

    constructor() {
        // Automatically select all if filtered count is below threshold
        effect(() => {
            const foundTrialsKey = this.foundTrials().map(trial => trial.nctId).join('|');
            if (foundTrialsKey !== this.lastFoundTrialsKey) {
                this.lastFoundTrialsKey = foundTrialsKey;
                this.shouldAutoSelectForCurrentResults = true;
            }

            const filtered = this.filteredTrials();
            const currentSelected = this.selectedTrialIds();

            if (filtered.length < this.DISPLAY_THRESHOLD) {
                const filteredIds = filtered.map(t => t.nctId);
                // Auto-select only once for a given result set.
                if (this.shouldAutoSelectForCurrentResults && currentSelected.length === 0 && filteredIds.length > 0) {
                     this.selectedTrialIds.set(filteredIds);
                     this.shouldAutoSelectForCurrentResults = false;
                }
            } else {
                // If over threshold, clear selection as table is hidden and filtering is required
                if (currentSelected.length > 0) {
                    this.selectedTrialIds.set([]);
                }

                this.shouldAutoSelectForCurrentResults = true;
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

    dismissImportNotice() {
        this.workflowService.setImportNotice(null);
    }

    onNext() {
        this.workflowService.processResults();
        this.router.navigate(['/results']);
    }

    onExportCriteria() {
        if (!this.canExportCriteria()) {
            return;
        }

        const criteria = this.workflowService.inputParams();
        if (!criteria) {
            return;
        }

        const blob = new Blob([buildDesignerExportJson(criteria)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'clinicaltrials-search-criteria.json';
        link.click();
        URL.revokeObjectURL(url);
    }

    onCompare() {
        if (!this.canCompareTrials()) {
            return;
        }

        this.router.navigate(['/compare']);
    }
}
