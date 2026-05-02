import {
    Component,
    ChangeDetectionStrategy,
    input,
    effect,
    viewChild,
    ElementRef,
    OnDestroy,
} from '@angular/core';
import {
    Chart,
    BarController,
    BarElement,
    LineController,
    LineElement,
    PointElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
    Title,
} from 'chart.js';

Chart.register(
    BarController, 
    BarElement, 
    LineController, 
    LineElement, 
    PointElement, 
    CategoryScale, 
    LinearScale, 
    Tooltip, 
    Legend, 
    Title
);

export interface BarChartDataset {
    label: string;
    data: number[];
    backgroundColor: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    type?: 'bar' | 'line';
    pointRadius?: number;
    tension?: number;
    order?: number;
    isTargetLine?: boolean;
    borderDash?: number[];
}

export interface BarChartData {
    labels: string[];
    datasets: BarChartDataset[];
}

@Component({
    selector: 'app-bar-chart',
    standalone: true,
    templateUrl: './bar-chart.html',
    styleUrl: './bar-chart.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarChart implements OnDestroy {
    chartData = input.required<BarChartData>();
    xAxisLabel = input<string>('');
    yAxisLabel = input<string>('');
    grouped = input<boolean>(false);

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

    private renderChart(data: BarChartData, canvas: HTMLCanvasElement): void {
        this.chart?.destroy();
        this.chart = new Chart(canvas, {
            type: 'bar',
            data: data as any,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: data.datasets.length > 1 },
                },
                scales: {
                    x: {
                        title: {
                            display: !!this.xAxisLabel(),
                            text: this.xAxisLabel(),
                            color: '#555',
                        },
                    },
                    y: {
                        title: {
                            display: !!this.yAxisLabel(),
                            text: this.yAxisLabel(),
                            color: '#555',
                        },
                        beginAtZero: true,
                    },
                },
            },
            plugins: [
                {
                    id: 'fullWidthTargetLine',
                    afterDraw: (chart) => {
                        const { ctx, chartArea: { left, right }, scales: { y } } = chart;
                        chart.data.datasets.forEach((dataset: any) => {
                            if (dataset.isTargetLine && dataset.data.length > 0) {
                                const val = dataset.data[0];
                                const yPos = y.getPixelForValue(val);
                                
                                ctx.save();
                                ctx.beginPath();
                                ctx.lineWidth = dataset.borderWidth || 3;
                                ctx.strokeStyle = dataset.borderColor || '#DC344D';
                                ctx.setLineDash(dataset.borderDash || []);
                                ctx.moveTo(left, yPos);
                                ctx.lineTo(right, yPos);
                                ctx.stroke();
                                ctx.restore();
                            }
                        });
                    }
                }
            ]
        });
    }

    exportPng(): void {
        if (!this.chart) return;
        const link = document.createElement('a');
        link.download = 'bar-chart.png';
        link.href = this.chart.toBase64Image();
        link.click();
    }

    exportCsv(): void {
        const data = this.chartData();
        const rows: string[] = [['Label', ...data.datasets.map(d => d.label)].join(',')];
        data.labels.forEach((label, i) => {
            rows.push([label, ...data.datasets.map(d => d.data[i] ?? '')].join(','));
        });
        this.downloadText(rows.join('\n'), 'bar-chart.csv', 'text/csv');
    }

    private downloadText(content: string, filename: string, type: string): void {
        const blob = new Blob([content], { type });
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
