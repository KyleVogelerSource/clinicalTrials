import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from "@angular/core";
import { CommonModule, DatePipe } from "@angular/common";
import { Router } from "@angular/router";
import { FormsModule } from "@angular/forms";

import { TrialWorkflowService } from "../../services/trial-workflow-service";
import { BarChart, BarChartData, BarChartDataset } from "../../primitives/bar-chart/bar-chart";
import { ScatterChart, ScatterChartData } from "../../primitives/scatter-chart/scatter-chart";
import { Heatmap } from "../../primitives/heatmap/heatmap";
import { metricNames, MetricRow } from "../../models/results-model";
import { StudyTrial } from "../../models/study-trial";
import { LoadingService } from "../../services/loading.service";

interface IntersectionRow {
    name: string;
    values: number[];
}

interface ComparisonMetric {
    key: string;
    label: string;
    fn: (trial: StudyTrial) => string | number;
}

interface ComparisonRow {
    trial: StudyTrial;
    metrics: Record<string, string | number>;
}

const ALL_COMPARISON_METRICS: ComparisonMetric[] = [
    { key: 'phase',           label: 'Phase',           fn: (t) => t.phase || '—' },
    { key: 'overallStatus',   label: 'Status',          fn: (t) => t.overallStatus || '—' },
    { key: 'enrollmentCount', label: 'Enrollment',      fn: (t) => t.enrollmentCount ?? 0 },
    { key: 'startDate',       label: 'Start Date',      fn: (t) => t.startDate || '—' },
    { key: 'completionDate',  label: 'Completion Date', fn: (t) => t.completionDate || '—' },
    { key: 'sponsor',         label: 'Sponsor',         fn: (t) => t.sponsor || '—' },
    { key: 'siteCount',       label: 'Sites',           fn: (t) => t.sites?.length ?? 0 },
    { key: 'conditions',      label: 'Conditions',      fn: (t) => t.conditions?.join(', ') || '—' },
];

export const metricDescriptions: Record<string, string> = {
    "Total Enrollment": "The total number of participants planned for the study.",
    "Site Count": "The number of clinical site facilities participating in the trial.",
    "Recruitment Velocity": "The speed of enrollment measured in participants per day.",
    "Inclusion Strictness": "Word count of inclusion criteria; higher numbers imply more complex enrollment.",
    "Exclusion Strictness": "Word count of exclusion criteria; higher numbers imply more restrictive disqualifiers.",
    "Site Efficiency": "Ratio of total enrollment to site count (participants per site).",
    "Outcome Density": "Total count of primary and secondary outcome measures.",
    "Age Span": "The difference between maximum and minimum eligibility age.",
    "Min Age": "The minimum required age of participants.",
    "Max Age": "The maximum allowed age of participants.",
    "Intervention Count": "Number of unique drugs, devices, or procedures being tested.",
    "Collaborator Count": "Number of organizations partnering with the lead sponsor.",
    "Timeline Slippage": "Difference between planned and actual completion duration in days.",
    "Masking Intensity": "Number of groups (Participants, Providers, etc.) blinded from study assignments.",
    "Condition Count": "Number of diseases or conditions being addressed in the protocol."
};

@Component({
    selector: "app-analysis",
    templateUrl: "./analysis.html",
    styleUrl: "./analysis.css",
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        BarChart,
        ScatterChart,
        Heatmap,
        DatePipe
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class Analysis implements OnInit {
    private workflowService = inject(TrialWorkflowService);
    private router = inject(Router);
    loadingService = inject(LoadingService);

    results = this.workflowService.results;
    inputParams = this.workflowService.inputParams;
    selectedTrialIds = this.workflowService.selectedTrialIds;
    
    data = computed(() => this.results().trialResults);
    descriptions = metricDescriptions;
    
    heatmapFocus = signal<[number, number] | null>(null);

    abs(val: number): number {
        return Math.abs(val);
    }

    displayPhase = computed(() => {
        const phase = this.inputParams()?.phase;
        if (!phase || phase === 'N/A' || phase === 'NA') return 'Any Phase';
        return phase;
    });

    estimatedDuration = computed(() => {
        const d = this.data();
        if (!d || d.avgRecruitmentDays <= 0) return null;
        return d.avgRecruitmentDays;
    });

    estimatedCompletionDate = computed(() => {
        const days = this.estimatedDuration();
        if (!days) return null;
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date;
    });

    // Charts Configuration
    dataPlotX = signal(metricNames[0]);
    dataPlotY = signal(metricNames[1]);
    showTrendLine = signal(false);
    metricNamesList = metricNames;

    suggestedCorrelations = computed(() => {
        const trials = this.results().metricRows;
        if (!trials || trials.length < 2) return [];

        const metrics = this.metricNamesList;
        const correlations: {x: string, y: string, r: number}[] = [];

        // Redundant metric pairs to ignore (mathematically dependent)
        const forbiddenPairs = new Set([
            "Age Span|Max Age", "Max Age|Age Span",
            "Age Span|Min Age", "Min Age|Age Span",
            "Max Age|Min Age", "Min Age|Max Age",
            "Total Enrollment|Site Efficiency", "Site Efficiency|Total Enrollment",
            "Site Count|Site Efficiency", "Site Efficiency|Site Count"
        ]);

        for (let i = 0; i < metrics.length; i++) {
            for (let j = i + 1; j < metrics.length; j++) {
                const m1 = metrics[i];
                const m2 = metrics[j];
                
                if (forbiddenPairs.has(`${m1}|${m2}`)) continue;

                const extract1 = MetricRow.metricExtractors[m1];
                const extract2 = MetricRow.metricExtractors[m2];

                const values = trials.map(t => ({ x: extract1(t), y: extract2(t) }))
                    .filter((v): v is {x: number, y: number} => v.x !== null && v.y !== null);
                
                if (values.length < 2) continue;

                const n = values.length;
                const sumX = values.reduce((a, b) => a + b.x, 0);
                const sumY = values.reduce((a, b) => a + b.y, 0);
                const sumXY = values.reduce((a, b) => a + (b.x * b.y), 0);
                const sumX2 = values.reduce((a, b) => a + (b.x * b.x), 0);
                const sumY2 = values.reduce((a, b) => a + (b.y * b.y), 0);

                const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
                const r = denominator === 0 ? 0 : ((n * sumXY) - (sumX * sumY)) / denominator;

                correlations.push({ x: m1, y: m2, r });
            }
        }

        return correlations.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, 3);
    });

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
            labels: d.recruitmentByImpact.map((b: any) => b.label),
            datasets: [
                {
                    label: 'Avg Days',
                    data: d.recruitmentByImpact.map((b: any) => b.avgDays),
                    backgroundColor: '#193F6A',
                },
                {
                    label: 'Participants',
                    data: d.recruitmentByImpact.map((b: any) => b.participantCount),
                    backgroundColor: '#35c0c0',
                },
            ],
        };
    });

    timelineChartData = computed<BarChartData | null>(() => {
        const d = this.data();
        if (!d || !d.timelineBuckets || d.timelineBuckets.length === 0) return null;

        const labels = d.timelineBuckets.map(b => b.patientBucket);
        const userEstimate = d.avgRecruitmentDays;

        const defaultEstColor = '#193F6A';
        const defaultActColor = '#35c0c0';
        const userLineColor = '#DC344D';

        const datasets: BarChartDataset[] = [
            {
                label: 'Estimated Days',
                data: d.timelineBuckets.map(b => b.estimatedDays),
                backgroundColor: defaultEstColor,
            },
            {
                label: 'Actual Days',
                data: d.timelineBuckets.map(b => b.actualDays),
                backgroundColor: defaultActColor,
            }
        ];

        if (userEstimate > 0) {
            datasets.push({
                label: 'Your Estimate',
                type: 'line',
                data: new Array(labels.length).fill(userEstimate),
                borderColor: userLineColor,
                backgroundColor: userLineColor,
                borderWidth: 3,
                pointRadius: 0,
                tension: 0,
                order: -1
            });
        }

        return {
            labels,
            datasets
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

        const rowFactors = [
            { name: 'High Enrollment (>200)', check: (t: MetricRow) => t.totalEnrollment > 200 },
            { name: 'Multi-Site (>5)', check: (t: MetricRow) => t.siteCount > 5 },
            { name: 'Long Duration (>1yr)', check: (t: MetricRow) => t.timelineSlippage > 365 }
        ];

        const colFactors = [
            { name: 'Strict Inclusions (>10)', check: (t: MetricRow) => t.inclusionStrictness > 10 },
            { name: 'Many Interventions (>2)', check: (t: MetricRow) => t.interventionCount > 2 },
            { name: 'Many Outcomes (>5)', check: (t: MetricRow) => t.outcomeDensity > 5 },
            { name: 'Wide Age Span (>40)', check: (t: MetricRow) => (t.ageSpan ?? 0) > 40 }
        ];

        return rowFactors.map(row => {
            const rowTrials = trials.filter(t => row.check(t));
            const values = colFactors.map(col => {
                if (rowTrials.length === 0) return 0;
                const coOccurrences = rowTrials.filter(t => col.check(t)).length;
                return Math.round((coOccurrences / rowTrials.length) * 100);
            });
            return { name: row.name, values };
        });
    });

    matrixHeaders = [
        "Strict Inclusions (>10)",
        "Many Interventions (>2)",
        "Many Outcomes (>5)",
        "Wide Age Span (>40)"
    ];

    topSites = computed(() => {
        const trials = this.selectedTrialIds().map(id => (this.workflowService as any).trialCache.get(id));
        const siteData = new Map<string, { count: number, coords: [number, number] | null }>();
        
        trials.forEach((trial: any) => {
            trial?.protocolSection?.contactsLocationsModule?.locations?.forEach((loc: any) => {
                if (loc.facility) {
                    const existing = siteData.get(loc.facility);
                    const count = (existing?.count || 0) + 1;
                    const coords = existing?.coords || (loc.geoPoint?.lat ? [loc.geoPoint.lat, loc.geoPoint.lon] : null);
                    siteData.set(loc.facility, { count, coords });
                }
            });
        });

        return Array.from(siteData.entries())
            .filter(([_, data]) => data.count > 1)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 12)
            .map(([name, data]) => ({ name, count: data.count, coords: data.coords }));
    });

    benchmarks = computed(() => {
        const trials = this.results().metricRows;
        if (!trials || trials.length === 0) return [];

        const user = this.inputParams();
        const metrics = [
            { label: 'Patients', key: 'totalEnrollment', paramKey: 'userPatients', userVal: user?.userPatients ?? 0 },
            { label: 'Inclusions', key: 'inclusionStrictness', paramKey: 'userInclusions', userVal: user?.userInclusions ?? 0 },
            { label: 'Exclusions', key: 'exclusionStrictness', paramKey: 'userExclusions', userVal: user?.userExclusions ?? 0 },
            { label: 'Outcomes', key: 'outcomeDensity', paramKey: 'userOutcomes', userVal: user?.userOutcomes ?? 0 },
            { label: 'Sites', key: 'siteCount', paramKey: 'userSites', userVal: user?.userSites ?? 0 }
        ];

        return metrics.map(m => {
            const values = trials.map(t => (t as any)[m.key] as number || 0);
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length;
            const stdDev = Math.sqrt(variance);
            
            // Generate Normal Distribution Curve Points
            const curvePoints: {x: number, y: number}[] = [];
            let maxY = 0;
            
            if (stdDev > 0) {
                const min = Math.max(0, mean - 3 * stdDev);
                const max = mean + 3 * stdDev;
                const range = max - min;
                const step = range / 40;

                if (step > 0) {
                    for (let x = min; x <= max; x += step) {
                        const y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
                        curvePoints.push({ x, y });
                        if (y > maxY) maxY = y;
                    }
                }
            }

            // Secondary dataset for vertical user line
            const userLinePoints = [
                { x: m.userVal, y: 0 },
                { x: m.userVal, y: maxY || 0.1 }
            ];

            const userZScore = stdDev === 0 ? 0 : (m.userVal - mean) / stdDev;

            return {
                label: m.label,
                paramKey: m.paramKey,
                userVal: m.userVal,
                mean: Math.round(mean * 10) / 10,
                stdDev: Math.round(stdDev * 10) / 10,
                zScore: Math.round(userZScore * 100) / 100,
                chartData: {
                    datasets: [
                        {
                            label: 'Distribution',
                            data: curvePoints,
                            borderColor: '#193F6A',
                            backgroundColor: 'rgba(25, 63, 106, 0.1)',
                            pointRadius: 0,
                            showLine: curvePoints.length > 0,
                            tension: 0.4,
                            fill: true
                        },
                        {
                            label: 'User',
                            data: userLinePoints,
                            borderColor: '#088989',
                            borderWidth: 2,
                            pointRadius: 0,
                            showLine: true
                        }
                    ]
                }
            };
        });
    });

    // Comparison table logic
    readonly allComparisonMetrics = ALL_COMPARISON_METRICS;
    visibleColumnKeys = signal<string[]>(['phase', 'overallStatus', 'enrollmentCount', 'startDate', 'completionDate']);
    showColumnSelector = signal(false);
    comparisonMetrics = computed(() => ALL_COMPARISON_METRICS.filter(m => this.visibleColumnKeys().includes(m.key)));
    comparisonSearch = signal('');
    comparisonSortKey = signal('');
    comparisonSortAsc = signal(true);

    comparisonRows = computed<ComparisonRow[]>(() => {
        const search = this.comparisonSearch().toLowerCase();
        const sortKey = this.comparisonSortKey();
        const sortAsc = this.comparisonSortAsc();

        const selectedIds = new Set(this.workflowService.selectedTrialIds());
        const allTrials = this.workflowService.foundTrials();
        const trials = allTrials.filter(t => selectedIds.has(t.nctId));

        let rows: ComparisonRow[] = trials.map(trial => ({
            trial,
            metrics: Object.fromEntries(
                ALL_COMPARISON_METRICS.map(m => [m.key, m.fn(trial)])
            ),
        }));

        if (search) {
            rows = rows.filter(r => r.trial.briefTitle.toLowerCase().includes(search));
        }

        if (sortKey) {
            rows = [...rows].sort((a, b) => {
                const av = a.metrics[sortKey];
                const bv = b.metrics[sortKey];
                if (typeof av === 'number' && typeof bv === 'number') {
                    return sortAsc ? av - bv : bv - av;
                }
                return sortAsc
                    ? String(av).localeCompare(String(bv))
                    : String(bv).localeCompare(String(av));
            });
        }

        return rows;
    });

    ngOnInit(): void {
        if (this.workflowService.selectedTrialIds().length === 0) {
            this.router.navigate(['/']);
            return;
        }
        
        this.workflowService.processResultsV2();
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

    toggleColumnSelector() {
        this.showColumnSelector.update(v => !v);
    }

    toggleColumn(key: string) {
        this.visibleColumnKeys.update(keys =>
            keys.includes(key) ? keys.filter(k => k !== key) : [...keys, key]
        );
    }

    isColumnVisible(key: string): boolean {
        return this.visibleColumnKeys().includes(key);
    }

    onUpdateBenchmark(paramKey: string, value: string) {
        const val = value === '' ? null : parseInt(value);
        const params = this.inputParams();
        if (params) {
            this.workflowService.setInputs({
                ...params,
                [paramKey]: val
            });
        }
    }

    onFocusSite(coords: [number, number] | null) {
        if (coords) {
            this.heatmapFocus.set(coords);
        }
    }
}
