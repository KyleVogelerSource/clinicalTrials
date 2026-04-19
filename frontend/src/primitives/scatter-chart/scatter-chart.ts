import { Component, ChangeDetectionStrategy, input, effect, viewChild, ElementRef, OnDestroy } from '@angular/core';
import { Chart, ScatterController, PointElement, LinearScale, Tooltip, Legend, Title } from 'chart.js';

Chart.register(ScatterController, PointElement, LinearScale, Tooltip, Legend, Title);

export interface ScatterChartDataset {
    label: string;
    data: { x: number; y: number }[];
    backgroundColor?: string;
    borderColor?: string;
    pointRadius?: number;
    pointHoverRadius?: number;
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

    canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

    private chart: Chart | null = null;

    constructor() {
        effect(() => {
            const data = this.chartData();
            const canvas = this.canvasRef();
            if (!canvas) return;
            this.renderChart(data, canvas.nativeElement);
        });
    }

    private renderChart(data: ScatterChartData, canvas: HTMLCanvasElement): void {
        this.chart?.destroy();
        this.chart = new Chart(canvas, {
            type: 'scatter',
            data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
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

    exportPng(): void {
        if (!this.chart) return;
        const link = document.createElement('a');
        link.download = 'scatter-chart.png';
        link.href = this.chart.toBase64Image();
        link.click();
    }

    exportCsv(): void {
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
        link.download = 'scatter-chart.csv';
        link.click();
        URL.revokeObjectURL(url);
    }

    ngOnDestroy(): void {
        this.chart?.destroy();
    }
}
