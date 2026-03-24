import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
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
export class Selection implements OnInit {
    router = inject(Router);
    workflowService = inject(TrialWorkflowService);
    clinicalStudyService = inject(ClinicalStudyService);

    // Proxy signals from the service
    foundTrials = this.workflowService.foundTrials;
    filterWords = this.workflowService.filterWords;
    fromDate = this.workflowService.fromDate;
    toDate = this.workflowService.toDate;

    expandedTrialId = signal<string | null>(null);

    ngOnInit() {
        // Initialize foundTrials with mock data if empty
        if (this.workflowService.foundTrials().length === 0) {
            this.workflowService.foundTrials.set(this.clinicalStudyService.getMockTrials());
        }
    }

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
        this.router.navigate(['/results']);
    }
}
