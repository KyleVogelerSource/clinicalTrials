import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BarChart } from './bar-chart';

const chartDestroyMock = vi.fn();
const chartConstructorMock = vi.fn();

vi.mock('chart.js', () => {
  class FakeChart {
    static register = vi.fn();
    destroy = chartDestroyMock;

    constructor(canvas: HTMLCanvasElement, config: unknown) {
      chartConstructorMock(canvas, config);
    }
  }

  return {
    Chart: FakeChart,
    BarController: {},
    BarElement: {},
    CategoryScale: {},
    LinearScale: {},
    Tooltip: {},
    Legend: {},
    Title: {},
  };
});

describe('BarChart', () => {
  let fixture: ComponentFixture<BarChart>;

  beforeEach(async () => {
    chartDestroyMock.mockClear();
    chartConstructorMock.mockClear();

    await TestBed.configureTestingModule({
      imports: [BarChart],
    }).compileComponents();

    fixture = TestBed.createComponent(BarChart);
  });

  it('renders a bar chart with axis labels and grouped legend support', () => {
    fixture.componentRef.setInput('chartData', {
      labels: ['A', 'B'],
      datasets: [
        { label: 'Days', data: [1, 2], backgroundColor: '#088989' },
        { label: 'Participants', data: [3, 4], backgroundColor: '#193F6A' },
      ],
    });
    fixture.componentRef.setInput('xAxisLabel', 'Phase');
    fixture.componentRef.setInput('yAxisLabel', 'Count');
    fixture.detectChanges();

    expect(chartConstructorMock).toHaveBeenCalledWith(
      expect.any(HTMLCanvasElement),
      expect.objectContaining({
        type: 'bar',
        options: expect.objectContaining({
          plugins: {
            legend: { display: true },
          },
          scales: expect.objectContaining({
            x: expect.objectContaining({
              title: expect.objectContaining({ text: 'Phase', display: true }),
            }),
            y: expect.objectContaining({
              title: expect.objectContaining({ text: 'Count', display: true }),
              beginAtZero: true,
            }),
          }),
        }),
      })
    );
  });

  it('destroys the current chart before rendering a new one and on component destroy', () => {
    fixture.componentRef.setInput('chartData', {
      labels: ['A'],
      datasets: [{ label: 'Only', data: [1], backgroundColor: '#088989' }],
    });
    fixture.detectChanges();
    chartDestroyMock.mockClear();

    fixture.componentRef.setInput('chartData', {
      labels: ['B'],
      datasets: [{ label: 'Updated', data: [2], backgroundColor: '#193F6A' }],
    });
    fixture.detectChanges();

    expect(chartDestroyMock).toHaveBeenCalledTimes(1);

    fixture.destroy();
    expect(chartDestroyMock).toHaveBeenCalledTimes(2);
  });
});
