import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from "@angular/core";
import { CommonModule, DecimalPipe, DatePipe } from "@angular/common";
import { Router } from "@angular/router";

import { TrialWorkflowService } from "../../services/trial-workflow-service";
import { BarChart, BarChartData } from "../../primitives/bar-chart/bar-chart";
import { ScatterChart, ScatterChartData } from "../../primitives/scatter-chart/scatter-chart";
import { Heatmap } from "../../primitives/heatmap/heatmap";
import { LoadingIndicator } from "../../primitives/loading-indicator/loading-indicator";
import { metricNames, MetricRow } from "../../models/results-model";
import { StudyTrial } from "../../models/study-trial";

interface IntersectionRow {
    name: string;
    values: number[];
}

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
    selector: "app-analysis",
    templateUrl: "./analysis.html",
    styleUrl: "./analysis.css",
    standalone: true,
    imports: [
        CommonModule,
        BarChart,
        ScatterChart,
        Heatmap,
        LoadingIndicator,
        DatePipe
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class Analysis implements OnInit {
    private workflowService = inject(TrialWorkflowService);
    private router = inject(Router);

    results = this.workflowService.results;
    inputParams = this.workflowService.inputParams;
    selectedTrialIds = this.workflowService.selectedTrialIds;
    
    data = computed(() => this.results().trialResults);
    
    abs(val: number): number {
        return Math.abs(val);
    }

    // Charts Configuration
    dataPlotX = signal(metricNames[0]);
    dataPlotY = signal(metricNames[1]);
    metricNamesList = metricNames;

    viabilityColor = computed(() => {
        const score = this.data()?.overallScore ?? 0;
        if (score >= 80) return 'status-completed';
        if (score >= 60) return 'status-active';
        return 'status-terminated';
    });

    recruitmentChartData = computed<BarChartData | null>(() => {
        const d = this.data();
        if (!d || !d.recruitmentByImpact) return null;
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
        if (!d || !d.timelineBuckets || d.timelineBuckets.length === 0) return null;
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
                    backgroundColor: '#35c0c0',
                },
            ],
        };
    });

    dataPlotData = computed<ScatterChartData | null>(() => {
        const metrics = this.results().metricRows;
        if (!metrics) return null;
        
        const getX = MetricRow.metricExtractors[this.dataPlotX()];
        const getY = MetricRow.metricExtractors[this.dataPlotY()];

        const dataSet = metrics.map(r => {
           const x = getX(r);
           const y = getY(r);
           if (x === null || y === null) return null;
           return { x, y };
        }).filter((point): point is {x:number, y:number} => point !== null);

        return {
            datasets: [{
                label: `${this.dataPlotX()} vs ${this.dataPlotY()}`,
                data: dataSet,
                backgroundColor: '#088989'
            }]
        };
    });

    heatmapPoints = computed(() => this.results().siteLocations);

    intersectionMatrix = computed<IntersectionRow[]>(() => {
        const trials = this.results().metricRows;
        if (!trials || trials.length === 0) return [];

        const selectedMetrics = [
            "Total Enrollment",
            "Site Count",
            "Recruitment Velocity",
            "Inclusion Strictness",
            "Exclusion Strictness",
            "Outcome Density",
            "Age Span",
            "Intervention Count",
            "Condition Count"
        ];

        return selectedMetrics.map(rowMetric => {
            const rowValues = selectedMetrics.map(colMetric => {
                if (rowMetric === colMetric) return 100;
                
                const extractorRow = MetricRow.metricExtractors[rowMetric];
                const extractorCol = MetricRow.metricExtractors[colMetric];

                const coOccurrences = trials.filter(t => {
                    const valR = extractorRow(t);
                    const valC = extractorCol(t);
                    return valR !== null && valR > 0 && valC !== null && valC > 0;
                }).length;

                return Math.round((coOccurrences / trials.length) * 100);
            });
            return { name: rowMetric, values: rowValues };
        });
    });

    matrixHeaders = [
        "Total Enrollment",
        "Site Count",
        "Recruitment Velocity",
        "Inclusion Strictness",
        "Exclusion Strictness",
        "Outcome Density",
        "Age Span",
        "Intervention Count",
        "Condition Count"
    ];

    topSites = computed(() => {
        const trials = this.selectedTrialIds().map(id => (this.workflowService as any).trialCache.get(id));
        const siteCounts = new Map<string, number>();
        
        trials.forEach((trial: any) => {
            trial?.protocolSection?.contactsLocationsModule?.locations?.forEach((loc: any) => {
                if (loc.facility) {
                    siteCounts.set(loc.facility, (siteCounts.get(loc.facility) || 0) + 1);
                }
            });
        });

        return Array.from(siteCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));
    });

    benchmarks = computed(() => {
        const trials = this.results().metricRows;
        if (!trials || trials.length === 0) return [];

        const user = this.inputParams();
        const metrics = [
            { label: 'Patients', key: 'totalEnrollment', userVal: user?.userPatients ?? 0 },
            { label: 'Inclusions', key: 'inclusionStrictness', userVal: user?.userInclusions ?? 0 },
            { label: 'Exclusions', key: 'exclusionStrictness', userVal: user?.userExclusions ?? 0 },
            { label: 'Outcomes', key: 'outcomeDensity', userVal: user?.userOutcomes ?? 0 },
            { label: 'Sites', key: 'siteCount', userVal: user?.userSites ?? 0 }
        ];

        return metrics.map(m => {
            const values = trials.map(t => (t as any)[m.key] as number || 0);
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length;
            const stdDev = Math.sqrt(variance);
            
            // Generate Normal Distribution Curve Points
            const points: {x: number, y: number}[] = [];
            
            // Safety Check: If stdDev is 0, we can't draw a normal curve
            if (stdDev > 0) {
                const min = Math.max(0, mean - 3 * stdDev);
                const max = mean + 3 * stdDev;
                const range = max - min;
                const step = range / 40;

                if (step > 0) {
                    for (let x = min; x <= max; x += step) {
                        const y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
                        points.push({ x, y });
                    }
                }
            }

            const userZScore = stdDev === 0 ? 0 : (m.userVal - mean) / stdDev;

            return {
                label: m.label,
                userVal: m.userVal,
                mean: Math.round(mean * 10) / 10,
                stdDev: Math.round(stdDev * 10) / 10,
                zScore: Math.round(userZScore * 100) / 100,
                chartData: {
                    datasets: [
                        {
                            label: 'Distribution',
                            data: points,
                            borderColor: '#193F6A',
                            backgroundColor: 'rgba(25, 63, 106, 0.1)',
                            pointRadius: 0,
                            showLine: points.length > 0,
                            tension: 0.4,
                            fill: true
                        }
                    ]
                }
            };
        });
    });

    // Comparison table logic
    readonly comparisonMetrics = COMPARISON_METRICS;
    comparisonSearch = signal('');
    comparisonSortKey = signal('');
    comparisonSortAsc = signal(true);

    comparisonRows = computed<ComparisonRow[]>(() => {
        const search = this.comparisonSearch().toLowerCase();
        const phase = this.workflowService.inputParams()?.phase ?? '';
        const sortKey = this.comparisonSortKey();
        const sortAsc = this.comparisonSortAsc();
        
        const selectedIds = new Set(this.workflowService.selectedTrialIds());
        const allTrials = this.workflowService.foundTrials();
        const trials = allTrials.filter(t => selectedIds.has(t.nctId));

        let rows: ComparisonRow[] = trials.map(trial => ({
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

    ngOnInit(): void {
        if (this.workflowService.selectedTrialIds().length === 0) {
            this.router.navigate(['/']);
        }
    }

    onBack() {
        this.router.navigate(['/']);
    }

    onPrint() {
        window.print();
    }

    onExport() {
        const json = JSON.stringify(this.data(), null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `feasibility-report-${new Date().getTime()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

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
}
