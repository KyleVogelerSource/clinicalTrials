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
import { ScatterChart } from '../../primitives/scatter-chart/scatter-chart';
import { Heatmap } from '../../primitives/heatmap/heatmap';
import { ResultsApiService } from '../../services/results-api.service';
import { TrialWorkflowService } from '../../services/trial-workflow-service';
import { StudyTrial } from '../../models/study-trial';
import { metricNames, MetricRow } from '../../models/results-model';

interface ComparisonMetric {
    key: string;
    label: string;
    fn: (trial: StudyTrial, phase: string) => boolean;
}

interface ComparisonRow {
    trial: StudyTrial;
    metrics: Record<string, boolean>;
}

const COMPARISON_METRICS: ComparisonMetric[] = [
    {
        key: 'phaseMatch',
        label: 'Phase Match',
        fn: (t, phase) => {
            if (!phase) return false;
            const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
            return normalize(t.phase) === normalize(phase);
        }
    },
    {
        key: 'highEnrollment',
        label: 'High Enrollment',
        fn: (t) => t.enrollmentCount >= 200,
    },
    {
        key: 'hasStartDate',
        label: 'Has Start Date',
        fn: (t) => !!t.startDate,
    },
    {
        key: 'hasEndDate',
        label: 'Completion Date',
        fn: (t) => !!t.completionDate,
    },
    {
        key: 'hasDescription',
        label: 'Has Description',
        fn: (t) => t.description.trim().length > 0,
    },
];

@Component({
    selector: 'app-results',
    standalone: true,
    imports: [ProgressTrack, BarChart, ScatterChart, Heatmap],
    templateUrl: './results.html',
    styleUrl: './results.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Results implements OnInit {
    private router = inject(Router);
    private apiService = inject(ResultsApiService);
    private workflowService = inject(TrialWorkflowService);

    model = this.workflowService.results;
    data = computed(() => this.workflowService.results().trialResults);

    // heatmap
    heatmapData = computed(() => {
        const locations = this.model().siteLocations;
        if (!locations) return null;
        return locations;
    });

    // DataPlot
    dataPlotX = signal<string>(metricNames[0]);
    dataPlotY = signal<string>(metricNames[1]);
    dataPlotData = computed(() => {
        const metrics = this.model().metricRows;
        if (!metrics) return null;
        
        const getX = MetricRow.metricExtractors[this.dataPlotX()];
        const getY = MetricRow.metricExtractors[this.dataPlotY()];
        if (!getX || !getY) return null;

        const dataSet = metrics.map(row => {
            const x = getX(row);
            const y = getY(row);
            if (x == null || y == null) return null;
            return { x, y };
        }).filter(point => point !== null);

        return {
            datasets: [{
                label: this.dataPlotX() + ' vs ' + this.dataPlotY(),
                data: dataSet
            }]
        };
    });

    // Comparison table
    readonly comparisonMetrics = COMPARISON_METRICS;
    comparisonSearch = signal('');
    comparisonSortKey = signal('');
    comparisonSortAsc = signal(true);

    private selectedTrials = computed(() => {
        const ids = new Set(this.workflowService.selectedTrialIds());
        const all = this.workflowService.foundTrials();
        return ids.size > 0 ? all.filter(t => ids.has(t.nctId)) : all;
    });

    comparisonRows = computed<ComparisonRow[]>(() => {
        const search = this.comparisonSearch().toLowerCase();
        const phase = this.workflowService.inputParams()?.phase ?? '';
        const sortKey = this.comparisonSortKey();
        const sortAsc = this.comparisonSortAsc();

        let rows: ComparisonRow[] = this.selectedTrials().map(trial => ({
            trial,
            metrics: Object.fromEntries(
                COMPARISON_METRICS.map(m => [m.key, m.fn(trial, phase)])
            ),
        }));

        if (search) {
            rows = rows.filter(r => r.trial.briefTitle.toLowerCase().includes(search));
        }

        if (sortKey) {
            rows = [...rows].sort((a, b) => {
                const av = a.metrics[sortKey] ? 1 : 0;
                const bv = b.metrics[sortKey] ? 1 : 0;
                return sortAsc ? bv - av : av - bv;
            });
        }

        return rows;
    });

    onComparisonSearch(event: Event) {
        this.comparisonSearch.set((event.target as HTMLInputElement).value);
    }

    onComparisonSort(key: string) {
        if (this.comparisonSortKey() === key) {
            this.comparisonSortAsc.update(v => !v);
        } else {
            this.comparisonSortKey.set(key);
            this.comparisonSortAsc.set(true);
        }
    }

    terminationChartData = computed<BarChartData | null>(() => {
        const d = this.model();
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
        if (!this.workflowService.inputParams()) {
            this.router.navigate(['/designer']);
            return;
        }

        if (!this.data()) {
            this.workflowService.processResults();
        }
    }

    onBack(): void {
        this.router.navigate(['/designer']);
    }
}
