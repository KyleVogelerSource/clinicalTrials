import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    OnInit,
    signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ProgressTrack } from '../../primitives/progress-track/progress-track';
import { BarChart, BarChartData } from '../../primitives/bar-chart/bar-chart';
import { ResultsApiService } from '../../services/results-api.service';
import { TrialResultsResponse } from '../../../../shared/src/dto/TrialResultsResponse';
import { TrialWorkflowService } from '../../services/trial-workflow-service';

type LoadState = 'loading' | 'loaded' | 'error';

@Component({
    selector: 'app-results',
    standalone: true,
    imports: [ProgressTrack, BarChart],
    templateUrl: './results.html',
    styleUrl: './results.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Results implements OnInit {
    private router = inject(Router);
    private apiService = inject(ResultsApiService);
    private workflowService = inject(TrialWorkflowService);

    loadState = signal<LoadState>('loading');
    data = signal<TrialResultsResponse | null>(null);
    errorMessage = signal<string>('');

    terminationChartData = computed<BarChartData | null>(() => {
        const d = this.data();
        if (!d) return null;
        return {
            labels: d.terminationReasons.map(r => r.reason),
            datasets: [{
                label: '# of Trials',
                data: d.terminationReasons.map(r => r.count),
                backgroundColor: '#088989',
            }],
        };
    });

    recruitmentChartData = computed<BarChartData | null>(() => {
        const d = this.data();
        if (!d) return null;
        return {
            labels: d.recruitmentByImpact.map(b => b.label),
            datasets: [
                {
                    label: 'Avg Days',
                    data: d.recruitmentByImpact.map(b => b.avgDays),
                    backgroundColor: '#193F6A',
                },
                {
                    label: 'Participants',
                    data: d.recruitmentByImpact.map(b => b.participantCount),
                    backgroundColor: '#35c0c0',
                },
            ],
        };
    });

    timelineChartData = computed<BarChartData | null>(() => {
        const d = this.data();
        if (!d) return null;
        return {
            labels: d.timelineBuckets.map(b => b.patientBucket),
            datasets: [
                {
                    label: 'Estimated Days',
                    data: d.timelineBuckets.map(b => b.estimatedDays),
                    backgroundColor: '#193F6A',
                },
                {
                    label: 'Actual Days',
                    data: d.timelineBuckets.map(b => b.actualDays),
                    backgroundColor: '#088989',
                },
            ],
        };
    });

    ngOnInit(): void {
        const request = this.workflowService.getForResults();

        if (!request) {
            this.router.navigate(['/designer']);
            return;
        }

        this.apiService.getResults(request).subscribe({
            next: (response) => {
                this.data.set(response);
                this.loadState.set('loaded');
            },
            error: () => {
                this.errorMessage.set('Failed to load results. Please try again.');
                this.loadState.set('error');
            },
        });
    }

    onBack(): void {
        this.router.navigate(['/designer']);
    }
}
