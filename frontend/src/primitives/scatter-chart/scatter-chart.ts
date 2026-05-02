import { Component, ChangeDetectionStrategy, input, effect, viewChild, ElementRef, OnDestroy, signal } from '@angular/core';
import { Chart, ScatterController, LineController, LineElement, PointElement, LinearScale, Tooltip, Legend, Title } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(ScatterController, LineController, LineElement, PointElement, LinearScale, Tooltip, Legend, Title, zoomPlugin);

export interface ScatterChartDataset {
    label: string;
    data: { x: number; y: number }[];
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    pointRadius?: number | ((context: any) => number);
    pointHoverRadius?: number;
    pointBackgroundColor?: string;
    showLine?: boolean;
    tension?: number;
    fill?: boolean;
}

export interface ScatterChartData {
    datasets: ScatterChartDataset[];
}

@Component({
    selector: 'app-scatter-chart',
    standalone: true,
    templateUrl: './scatter-chart.html',
    styleUrl: './scatter-chart.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScatterChart implements OnDestroy {
    chartData = input.required<ScatterChartData>();
    xAxisLabel = input<string>('');
    yAxisLabel = input<string>('');
    showLegend = input<boolean>(true);
    type = input<'scatter' | 'line'>('scatter');
    enableZoom = input<boolean>(true);
    showTrendLine = input<boolean>(false);
    exportPrefix = input<string>('');

    canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

    isZoomed = signal(false);
    private chart: Chart | null = null;

    constructor() {
        effect(() => {
            const data = this.chartData();
            const canvas = this.canvasRef();
            if (!canvas) return;
            this.renderChart(data, canvas.nativeElement);
        });
    }

    private computeTrendLine(points: { x: number; y: number }[]): { linePoints: { x: number; y: number }[]; r: number } {
        const n = points.length;
        const sumX = points.reduce((a, p) => a + p.x, 0);
        const sumY = points.reduce((a, p) => a + p.y, 0);
        const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
        const sumX2 = points.reduce((a, p) => a + p.x * p.x, 0);
        const sumY2 = points.reduce((a, p) => a + p.y * p.y, 0);

        const denom = n * sumX2 - sumX * sumX;
        const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
        const intercept = (sumY - slope * sumX) / n;

        const rDenom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        const r = rDenom === 0 ? 0 : (n * sumXY - sumX * sumY) / rDenom;

        const minX = Math.min(...points.map(p => p.x));
        const maxX = Math.max(...points.map(p => p.x));

        return {
            linePoints: [
                { x: minX, y: slope * minX + intercept },
                { x: maxX, y: slope * maxX + intercept },
            ],
            r,
        };
    }

    private renderChart(data: ScatterChartData, canvas: HTMLCanvasElement): void {
        this.isZoomed.set(false);
        this.chart?.destroy();

        let chartData = data;
        if (this.showTrendLine() && data.datasets.length > 0) {
            const points = data.datasets[0].data.filter(p => p.x != null && p.y != null);
            if (points.length >= 2) {
                const { linePoints, r } = this.computeTrendLine(points);
                chartData = {
                    datasets: [
                        ...data.datasets,
                        {
                            label: `Trend (r = ${r.toFixed(2)})`,
                            type: 'line' as any,
                            data: linePoints,
                            borderColor: '#DC344D',
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            pointRadius: 0,
                            borderDash: [5, 5],
                        } as any,
                    ],
                };
            }
        }

        this.chart = new Chart(canvas, {
            type: this.type(),
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 24
                    }
                },
                elements: {
                    line: {
                        tension: 0.4
                    },
                    point: {
                        radius: this.type() === 'line' ? 0 : 3
                    }
                },
                plugins: {
                    legend: {
                        display: this.showLegend() && data.datasets.length > 0,
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset.label || '';
                                return `${label}: (${context.parsed.x}, ${context.parsed.y})`;
                            },
                        },
                    },
                    zoom: {
                        pan: {
                            enabled: this.enableZoom(),
                            mode: 'xy',
                            modifierKey: 'ctrl',
                            onPanComplete: () => this.isZoomed.set(true),
                        },
                        zoom: {
                            wheel: { 
                                enabled: this.enableZoom(),
                                modifierKey: 'ctrl'
                            },
                            pinch: { enabled: this.enableZoom() },
                            drag: {
                                enabled: this.enableZoom(),
                                modifierKey: 'shift',
                            },
                            mode: 'xy',
                            onZoomComplete: () => this.isZoomed.set(true),
                        },
                    },
                },
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        title: {
                            display: !!this.xAxisLabel(),
                            text: this.xAxisLabel(),
                            color: '#555',
                            font: { weight: 'bold' },
                        },
                    },
                    y: {
                        type: 'linear',
                        beginAtZero: true,
                        min: 0,
                        title: {
                            display: !!this.yAxisLabel(),
                            text: this.yAxisLabel(),
                            color: '#555',
                            font: { weight: 'bold' },
                        },
                    },
                },
            },
        });
    }

    resetZoom(): void {
        (this.chart as any)?.resetZoom();
        this.isZoomed.set(false);
    }

    exportPng(): void {
        if (!this.chart) return;
        
        const date = new Date().toISOString().split('T')[0];
        const prefix = this.exportPrefix();
        const filename = `${prefix} Chart ${date}.png`;

        const link = document.createElement('a');
        link.download = filename;
        link.href = this.chart.toBase64Image();
        link.click();
    }

    exportCsv(): void {
        const date = new Date().toISOString().split('T')[0];
        const prefix = this.exportPrefix();
        const filename = `${prefix} Data ${date}.csv`;

        const data = this.chartData();
        const rows: string[] = ['Dataset,X,Y'];
        data.datasets.forEach(dataset => {
            dataset.data.forEach(point => {
                rows.push([dataset.label, point.x, point.y].join(','));
            });
        });
        const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    ngOnDestroy(): void {
        this.chart?.destroy();
    }
}
