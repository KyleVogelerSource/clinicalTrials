import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ProgressTrack } from '../../primitives/progress-track/progress-track';
import { KeywordSelector } from '../../primitives/keyword-selector/keyword-selector';
import { Router } from '@angular/router';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';

interface MockTrial {
    nctId: string;
    briefTitle: string;
    conditions: string[];
    enrollmentCount: number;
    location: string;
    startDate: string;
    completionDate: string;
    sponsor: string;
}

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

    filterWords = signal<string[]>([]);
    fromDate = signal<string>('');
    toDate = signal<string>('');

    trials = signal<MockTrial[]>([
        {
            nctId: 'NCT00000001',
            briefTitle: 'A Study of New Treatment for Diabetes',
            conditions: ['Type 2 Diabetes'],
            enrollmentCount: 150,
            location: 'Boston, USA',
            startDate: '2023-01-01',
            completionDate: '2025-12-31',
            sponsor: 'PharmaCorp'
        },
        {
            nctId: 'NCT00000002',
            briefTitle: 'Evaluation of Diet on Heart Health',
            conditions: ['Heart Disease', 'Hypertension'],
            enrollmentCount: 500,
            location: 'New York, USA',
            startDate: '2022-06-15',
            completionDate: '2024-06-15',
            sponsor: 'HealthInst'
        },
        {
            nctId: 'NCT00000003',
            briefTitle: 'Safety and Efficacy of Drug X in Asthma',
            conditions: ['Asthma'],
            enrollmentCount: 250,
            location: 'San Francisco, USA',
            startDate: '2021-03-10',
            completionDate: '2023-03-10',
            sponsor: 'BioTech Solutions'
        },
        {
            nctId: 'NCT00000004',
            briefTitle: 'Phase III Trial of New Alzheimer Treatment',
            conditions: ['Alzheimer Disease'],
            enrollmentCount: 1200,
            location: 'London, UK',
            startDate: '2024-01-01',
            completionDate: '2028-12-31',
            sponsor: 'GlobalPharma'
        }
    ]);

    onAddKeyword(keyword: string) {
        this.filterWords.update(keywords => [...keywords, keyword]);
    }

    onRemoveKeyword(keyword: string) {
        this.filterWords.update(keywords => keywords.filter(k => k !== keyword));
    }

    onFromDateChange(event: Event) {
        const input = event.target as HTMLInputElement;
        this.fromDate.set(input.value);
    }

    onToDateChange(event: Event) {
        const input = event.target as HTMLInputElement;
        this.toDate.set(input.value);
    }

    viewSites(trial: MockTrial) {
        console.log('Viewing sites for:', trial.nctId);
    }

    onPrevious() {
        this.router.navigate(['/designer']);
    }

    onNext() {
        this.router.navigate(['/results']);
    }
}
