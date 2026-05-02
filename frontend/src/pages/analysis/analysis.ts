import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from "@angular/core";
import { CommonModule, DatePipe } from "@angular/common";
import { Router } from "@angular/router";
import { FormsModule } from "@angular/forms";

import { TrialWorkflowService } from "../../services/trial-workflow-service";
import { BarChart, BarChartData, BarChartDataset } from "../../primitives/bar-chart/bar-chart";
import { ScatterChart, ScatterChartData } from "../../primitives/scatter-chart/scatter-chart";
import { CustomSelect } from "../../primitives/custom-select/custom-select";
import { MultiSelect, MultiSelectOption } from "../../primitives/multi-select/multi-select";
import { Heatmap } from "../../primitives/heatmap/heatmap";
import { Tooltip } from "../../primitives/tooltip/tooltip";
import { metricNames, MetricRow } from "../../models/results-model";
import { StudyTrial } from "../../models/study-trial";
import { LoadingService } from "../../services/loading.service";

interface IntersectionRow {
    name: string;
    values: number[];
}

export interface MatrixOperators {
    highEnrollment: '>' | '<';
    multiSite: '>' | '<';
    longDuration: '>' | '<';
    manyArms: '>' | '<';
    strictInclusions: '>' | '<';
    manyInterventions: '>' | '<';
    manyOutcomes: '>' | '<';
    wideAgeSpan: '>' | '<';
}

export interface MatrixThresholds {
    highEnrollment: number;
    multiSite: number;
    longDuration: number;
    manyArms: number;
    strictInclusions: number;
    manyInterventions: number;
    manyOutcomes: number;
    wideAgeSpan: number;
    operators: MatrixOperators;
}

interface ComparisonMetric {
    key: string;
    label: string;
    fn: (trial: StudyTrial) => string | number;
}

interface ComparisonRow {
    trial: StudyTrial;
    metrics: Record<string, string | number>;
    isRanked?: boolean;
    rank?: number;
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
    "Condition Count": "Number of diseases or conditions being addressed in the protocol.",
    "Arm Count": "The number of arms or interventions in the study design."
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
        CustomSelect,
        MultiSelect,
        Heatmap,
        Tooltip,
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

    private hasAutoSelected = false;
    private hasAutoSelectedMatrix = false;

    constructor() {
        effect(() => {
            const correlations = this.suggestedCorrelations();
            if (correlations.length > 0 && !this.hasAutoSelected) {
                const top = correlations[0];
                this.dataPlotX.set(top.x);
                this.dataPlotY.set(top.y);
                this.hasAutoSelected = true;
            }
        }, { allowSignalWrites: true });

        effect(() => {
            const trials = this.results().metricRows;
            if (trials.length > 0 && !this.hasAutoSelectedMatrix) {
                this.matrixThresholds.set({
                    highEnrollment: this.calculateMedian(trials.map(t => t.totalEnrollment)),
                    multiSite: this.calculateMedian(trials.map(t => t.siteCount)),
                    longDuration: this.calculateMedian(trials.map(t => t.timelineSlippage)),
                    manyArms: this.calculateMedian(trials.map(t => t.armCount)),
                    strictInclusions: this.calculateMedian(trials.map(t => t.inclusionStrictness)),
                    manyInterventions: this.calculateMedian(trials.map(t => t.interventionCount)),
                    manyOutcomes: this.calculateMedian(trials.map(t => t.outcomeDensity)),
                    wideAgeSpan: this.calculateMedian(trials.map(t => t.ageSpan)),
                    operators: {
                        highEnrollment: '>',
                        multiSite: '>',
                        longDuration: '>',
                        manyArms: '>',
                        strictInclusions: '>',
                        manyInterventions: '>',
                        manyOutcomes: '>',
                        wideAgeSpan: '>'
                    }
                });
                this.hasAutoSelectedMatrix = true;
            }
        }, { allowSignalWrites: true });
    }

    private calculateMedian(values: number[]): number {
        if (values.length === 0) return 0;
        const filtered = values.filter(v => v !== null && v !== undefined);
        if (filtered.length === 0) return 0;
        const sorted = [...filtered].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
        }
        return Math.round(sorted[mid]);
    }

    abs(val: number): number {
        return Math.abs(val);
    }

    displayPhase = computed(() => {
        const phase = this.inputParams()?.phase;
        if (!phase || phase.length === 0) return 'Any Phase';
        if (phase.includes('N/A') || phase.includes('NA')) return 'Any Phase';
        return phase.join(', ');
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

    estimatedSites = computed(() => {
        const d = this.data();
        const input = this.inputParams();
        if (!d || !d.timelineBuckets || d.timelineBuckets.length === 0 || !input) return null;

        const target = input.userPatients ?? 0;
        // Find the bucket that contains our target enrollment
        const bucket = d.timelineBuckets.find((b: any) => {
            const label = b.patientBucket;
            if (label.endsWith('+')) {
                const min = parseInt(label.replace('+', ''));
                return target >= min;
            }
            const [min, max] = label.split('-').map((v: string) => parseInt(v));
            return target >= min && target < max;
        });

        return bucket ? (bucket as any).avgSites : (d.timelineBuckets[d.timelineBuckets.length - 1] as any).avgSites;
    });

    // Charts Configuration
    dataPlotX = signal("Site Count");
    dataPlotY = signal("Recruitment Velocity");
    showTrendLine = signal(true);
    excludeOutliers = signal(false);
    showAllCorrelations = signal(false);
    metricNamesList = metricNames;

    readonly designInputs = [
        "Site Count",
        "Inclusion Strictness",
        "Exclusion Strictness",
        "Outcome Density",
        "Age Span",
        "Intervention Count",
        "Collaborator Count",
        "Masking Intensity",
        "Condition Count",
        "Arm Count",
        "Min Age",
        "Max Age"
    ];

    readonly performanceOutputs = [
        "Recruitment Velocity",
        "Site Efficiency",
        "Timeline Slippage",
        "Total Enrollment"
    ];

    projectionMode = signal<'timeline' | 'sites'>('timeline');

    matrixThresholds = signal<MatrixThresholds>({
        highEnrollment: 200,
        multiSite: 5,
        longDuration: 365,
        manyArms: 2,
        strictInclusions: 10,
        manyInterventions: 2,
        manyOutcomes: 5,
        wideAgeSpan: 40,
        operators: {
            highEnrollment: '>',
            multiSite: '>',
            longDuration: '>',
            manyArms: '>',
            strictInclusions: '>',
            manyInterventions: '>',
            manyOutcomes: '>',
            wideAgeSpan: '>'
        }
    });

    suggestedCorrelations = computed(() => {
        const trials = this.results().metricRows;
        if (!trials || trials.length < 2) return [];

        const correlations: {x: string, y: string, r: number, rHat: number}[] = [];

        // Redundant metric pairs to ignore (mathematically dependent)
        const forbiddenPairs = new Set([
            "Age Span|Max Age", "Max Age|Age Span",
            "Age Span|Min Age", "Min Age|Age Span",
            "Max Age|Min Age", "Min Age|Max Age",
            "Total Enrollment|Site Efficiency", "Site Efficiency|Total Enrollment",
            "Site Count|Site Efficiency", "Site Efficiency|Site Count"
        ]);

        const calculateR = (pts: {x: number, y: number}[]) => {
            const n = pts.length;
            if (n < 2) return 0;
            const sumX = pts.reduce((a, b) => a + b.x, 0);
            const sumY = pts.reduce((a, b) => a + b.y, 0);
            const sumXY = pts.reduce((a, b) => a + (b.x * b.y), 0);
            const sumX2 = pts.reduce((a, b) => a + (b.x * b.x), 0);
            const sumY2 = pts.reduce((a, b) => a + (b.y * b.y), 0);

            const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
            return denominator === 0 ? 0 : ((n * sumXY) - (sumX * sumY)) / denominator;
        };

        const calculateBounds = (values: number[]) => {
            const sorted = [...values].sort((a, b) => a - b);
            const n = sorted.length;
            if (n < 4) return { min: -Infinity, max: Infinity };

            const q1 = sorted[Math.floor(n * 0.25)];
            const q3 = sorted[Math.floor(n * 0.75)];
            let iqr = q3 - q1;

            const multiplier = 6.0;
            const range = sorted[n - 1] - sorted[0];
            const floor = range * 0.05; 
            if (iqr < floor) iqr = floor;

            const p99 = sorted[Math.floor(n * 0.99)];
            return { 
                min: q1 - multiplier * iqr, 
                max: Math.max(q3 + multiplier * iqr, p99) 
            };
        };

        // Only pair Design Inputs (X) with Performance Outputs (Y)
        for (const inputMetric of this.designInputs) {
            for (const outputMetric of this.performanceOutputs) {
                
                if (forbiddenPairs.has(`${inputMetric}|${outputMetric}`)) continue;

                const extract1 = MetricRow.metricExtractors[inputMetric];
                const extract2 = MetricRow.metricExtractors[outputMetric];

                const values = trials.map(t => ({ x: extract1(t), y: extract2(t) }))
                    .filter((v): v is {x: number, y: number} => v.x !== null && v.y !== null);
                
                if (values.length < 2) continue;

                const r = calculateR(values);

                // Calculate r-hat (outliers excluded)
                let rHat = r;
                if (values.length > 3) {
                    const xBounds = calculateBounds(values.map(v => v.x));
                    const yBounds = calculateBounds(values.map(v => v.y));
                    const filtered = values.filter(v => 
                        v.x >= xBounds.min && v.x <= xBounds.max && 
                        v.y >= yBounds.min && v.y <= yBounds.max
                    );
                    if (filtered.length >= 2) {
                        rHat = calculateR(filtered);
                    }
                }

                correlations.push({ x: inputMetric, y: outputMetric, r, rHat });
            }
        }

        return correlations.sort((a, b) => Math.max(Math.abs(b.r), Math.abs(b.rHat)) - Math.max(Math.abs(a.r), Math.abs(a.rHat)));
    });

    visibleCorrelations = computed(() => {
        const all = this.suggestedCorrelations();
        if (this.showAllCorrelations()) return all;
        return all.filter(c => Math.abs(c.r) >= 0.1);
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
        const estValue = this.estimatedDuration() ?? 0;
        const user = this.inputParams();
        const userTarget = user?.userDuration ?? 0;

        const defaultEstColor = '#193F6A';
        const defaultActColor = '#35c0c0';
        const cardinalLineColor = '#DC344D';
        const userLineColor = '#088989';

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

        if (estValue > 0) {
            datasets.push({
                label: 'Cardinal Estimate',
                type: 'line',
                data: new Array(labels.length).fill(estValue),
                borderColor: cardinalLineColor,
                backgroundColor: 'transparent',
                borderWidth: 3,
                pointRadius: 0,
                tension: 0,
                order: -1,
                isTargetLine: true
            } as any);
        }

        if (userTarget > 0) {
            datasets.push({
                label: 'User Target',
                type: 'line',
                data: new Array(labels.length).fill(userTarget),
                borderColor: userLineColor,
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 0,
                tension: 0,
                order: -1,
                isTargetLine: true
            } as any);
        }

        return {
            labels,
            datasets
        };
    });

    siteChartData = computed<BarChartData | null>(() => {
        const d = this.data();
        if (!d || !d.timelineBuckets || d.timelineBuckets.length === 0) return null;

        const labels = d.timelineBuckets.map(b => b.patientBucket);
        const estValue = this.estimatedSites() ?? 0;
        const user = this.inputParams();
        const userTarget = user?.userSites ?? 0;

        const defaultColor = '#193F6A';
        const cardinalLineColor = '#DC344D';
        const userLineColor = '#088989';

        const datasets: BarChartDataset[] = [
            {
                label: 'Avg Sites',
                data: d.timelineBuckets.map((b: any) => b.avgSites),
                backgroundColor: defaultColor,
            }
        ];

        if (estValue > 0) {
            datasets.push({
                label: 'Cardinal Estimate',
                type: 'line',
                data: new Array(labels.length).fill(estValue),
                borderColor: cardinalLineColor,
                backgroundColor: 'transparent',
                borderWidth: 3,
                pointRadius: 0,
                tension: 0,
                order: -1,
                isTargetLine: true
            } as any);
        }

        if (userTarget > 0) {
            datasets.push({
                label: 'User Target',
                type: 'line',
                data: new Array(labels.length).fill(userTarget),
                borderColor: userLineColor,
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 0,
                tension: 0,
                order: -1,
                isTargetLine: true
            } as any);
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

        let dataSet = metrics.map(r => {
           const x = getX(r);
           const y = getY(r);
           if (x === null || y === null) return null;
           return { x, y };
        }).filter((point): point is {x:number, y:number} => point !== null);

        if (this.excludeOutliers() && dataSet.length > 3) {
            const calculateBounds = (values: number[]) => {
                const sorted = [...values].sort((a, b) => a - b);
                const n = sorted.length;
                if (n < 4) return { min: -Infinity, max: Infinity };

                const q1 = sorted[Math.floor(n * 0.25)];
                const q3 = sorted[Math.floor(n * 0.75)];
                let iqr = q3 - q1;

                // Use a more generous multiplier (6.0 for "Far Out" outliers)
                // and ensure we don't chop off the top 1% of data unless it's truly extreme.
                const multiplier = 6.0;
                const range = sorted[n - 1] - sorted[0];
                const floor = range * 0.05;
                if (iqr < floor) iqr = floor;

                const p99 = sorted[Math.floor(n * 0.99)];
                return { 
                    min: q1 - multiplier * iqr, 
                    max: Math.max(q3 + multiplier * iqr, p99) 
                };
            };
            const xBounds = calculateBounds(dataSet.map(d => d.x));
            const yBounds = calculateBounds(dataSet.map(d => d.y));

            dataSet = dataSet.filter(d => 
                d.x >= xBounds.min && d.x <= xBounds.max && 
                d.y >= yBounds.min && d.y <= yBounds.max
            );
        }

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
        const thresh = this.matrixThresholds();
        const ops = thresh.operators;

        const check = (val: number, threshold: number, op: '>' | '<') => 
            op === '>' ? val > threshold : val < threshold;

        const rowFactors = [
            { name: `Enrollment ${ops.highEnrollment} ${thresh.highEnrollment}`, check: (t: MetricRow) => check(t.totalEnrollment, thresh.highEnrollment, ops.highEnrollment) },
            { name: `Site Count ${ops.multiSite} ${thresh.multiSite}`, check: (t: MetricRow) => check(t.siteCount, thresh.multiSite, ops.multiSite) },
            { name: `Duration ${ops.longDuration} ${thresh.longDuration}d`, check: (t: MetricRow) => check(t.timelineSlippage, thresh.longDuration, ops.longDuration) },
            { name: `Arm Count ${ops.manyArms} ${thresh.manyArms}`, check: (t: MetricRow) => check(t.armCount, thresh.manyArms, ops.manyArms) }
        ];

        const colFactors = [
            { name: `Inclusions ${ops.strictInclusions} ${thresh.strictInclusions}`, check: (t: MetricRow) => check(t.inclusionStrictness, thresh.strictInclusions, ops.strictInclusions) },
            { name: `Interventions ${ops.manyInterventions} ${thresh.manyInterventions}`, check: (t: MetricRow) => check(t.interventionCount, thresh.manyInterventions, ops.manyInterventions) },
            { name: `Outcomes ${ops.manyOutcomes} ${thresh.manyOutcomes}`, check: (t: MetricRow) => check(t.outcomeDensity, thresh.manyOutcomes, ops.manyOutcomes) },
            { name: `Age Span ${ops.wideAgeSpan} ${thresh.wideAgeSpan}`, check: (t: MetricRow) => check(t.ageSpan ?? 0, thresh.wideAgeSpan, ops.wideAgeSpan) }
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

    matrixHeaders = computed(() => {
        const thresh = this.matrixThresholds();
        const ops = thresh.operators;
        return [
            `Inclusions ${ops.strictInclusions} ${thresh.strictInclusions}`,
            `Interventions ${ops.manyInterventions} ${thresh.manyInterventions}`,
            `Outcomes ${ops.manyOutcomes} ${thresh.manyOutcomes}`,
            `Age Span ${ops.wideAgeSpan} ${thresh.wideAgeSpan}`
        ];
    });

    topSites = computed(() => this.results().topSites);

    benchmarks = computed(() => {
        const trials = this.results().metricRows;
        if (!trials || trials.length === 0) return [];

        const user = this.inputParams();
        const metrics = [
            { label: 'Patients', key: 'totalEnrollment', paramKey: 'userPatients', userVal: user?.userPatients ?? 0 },
            { label: 'Inclusions', key: 'inclusionStrictness', paramKey: 'userInclusions', userVal: user?.userInclusions ?? 0 },
            { label: 'Exclusions', key: 'exclusionStrictness', paramKey: 'userExclusions', userVal: user?.userExclusions ?? 0 },
            { label: 'Outcomes', key: 'outcomeDensity', paramKey: 'userOutcomes', userVal: user?.userOutcomes ?? 0 },
            { label: 'Sites', key: 'siteCount', paramKey: 'userSites', userVal: user?.userSites ?? 0 },
            { label: 'Arms', key: 'armCount', paramKey: 'userArms', userVal: user?.userArms ?? 0 }
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
                            label: 'Proposed',
                            data: userLinePoints,
                            borderColor: '#088989',
                            borderWidth: 3,
                            pointRadius: (context: any) => context.dataIndex === 1 ? 4 : 0,
                            pointBackgroundColor: '#088989',
                            showLine: true
                        }
                    ]
                }
            };
        });
    });

    // Comparison table logic
    readonly allComparisonMetrics = ALL_COMPARISON_METRICS;
    readonly columnOptions: MultiSelectOption[] = ALL_COMPARISON_METRICS.map(m => ({ label: m.label, value: m.key }));
    
    visibleColumnKeys = signal<string[]>(['phase', 'overallStatus', 'enrollmentCount', 'startDate', 'completionDate']);
    comparisonMetrics = computed(() => ALL_COMPARISON_METRICS.filter(m => this.visibleColumnKeys().includes(m.key)));
    comparisonSearch = signal('');
    comparisonSortKey = signal('');
    comparisonSortAsc = signal(true);
    showOnlySimilarTrials = signal(false);

    comparisonRows = computed<ComparisonRow[]>(() => {
        const search = this.comparisonSearch().toLowerCase();
        const sortKey = this.comparisonSortKey();
        const sortAsc = this.comparisonSortAsc();
        const onlySimilar = this.showOnlySimilarTrials();
        
        const rankedTrials = this.data()?.rankedTrials || [];
        const rankMap = new Map<string, number>(rankedTrials.map(rt => [rt.trial.nctId, rt.rank]));

        const selectedIds = new Set(this.workflowService.selectedTrialIds());
        const allTrials = this.workflowService.foundTrials();
        const trials = allTrials.filter(t => selectedIds.has(t.nctId));

        let rows: ComparisonRow[] = trials.map(trial => ({
            trial,
            metrics: Object.fromEntries(
                ALL_COMPARISON_METRICS.map(m => [m.key, m.fn(trial)])
            ),
            isRanked: rankMap.has(trial.nctId),
            rank: rankMap.get(trial.nctId)
        }));

        if (onlySimilar) {
            rows = rows.filter(r => r.isRanked);
        }

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
        } else {
            // Default sort: Ranked trials first, then by rank, then unranked
            rows = [...rows].sort((a, b) => {
                if (a.isRanked && !b.isRanked) return -1;
                if (!a.isRanked && b.isRanked) return 1;
                if (a.isRanked && b.isRanked) return (a.rank || 0) - (b.rank || 0);
                return a.trial.briefTitle.localeCompare(b.trial.briefTitle);
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

    onUpdateMatrixThreshold(key: string, value: string) {
        const val = value === '' ? 0 : Math.max(0, parseInt(value));
        this.matrixThresholds.update(prev => ({
            ...prev,
            [key]: val
        }));
    }

    toggleMatrixOperator(key: keyof MatrixOperators) {
        this.matrixThresholds.update(prev => ({
            ...prev,
            operators: {
                ...prev.operators,
                [key]: prev.operators[key] === '>' ? '<' : '>'
            }
        }));
    }
}
