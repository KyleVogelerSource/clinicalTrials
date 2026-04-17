import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BarChart } from './bar-chart/bar-chart';
import { ScatterChart } from './scatter-chart/scatter-chart';

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
    ScatterController: {},
    PointElement: {},
    Tooltip: {},
    Legend: {},
    Title: {},
  };
});

describe('Chart primitives', () => {
  let getContextSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    chartDestroyMock.mockClear();
    chartConstructorMock.mockClear();
    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({} as CanvasRenderingContext2D);
  });

  afterEach(() => {
    getContextSpy.mockRestore();
  });

  describe('BarChart', () => {
    let fixture: ComponentFixture<BarChart>;

    beforeEach(async () => {
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
      TestBed.flushEffects();

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
      TestBed.flushEffects();
      chartDestroyMock.mockClear();

      fixture.componentRef.setInput('chartData', {
        labels: ['B'],
        datasets: [{ label: 'Updated', data: [2], backgroundColor: '#193F6A' }],
      });
      fixture.detectChanges();
      TestBed.flushEffects();

      expect(chartDestroyMock).toHaveBeenCalledTimes(1);

      fixture.destroy();
      expect(chartDestroyMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('ScatterChart', () => {
    let fixture: ComponentFixture<ScatterChart>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [ScatterChart],
      }).compileComponents();

      fixture = TestBed.createComponent(ScatterChart);
    });

    it('renders a scatter chart with axis labels and tooltip labels', () => {
      fixture.componentRef.setInput('chartData', {
        datasets: [{ label: 'Trials', data: [{ x: 10, y: 20 }] }],
      });
      fixture.componentRef.setInput('xAxisLabel', 'Enrollment');
      fixture.componentRef.setInput('yAxisLabel', 'Sites');
      fixture.componentRef.setInput('showLegend', true);
      fixture.detectChanges();
      TestBed.flushEffects();

      const config = chartConstructorMock.mock.calls[0]?.[1] as {
        type: string;
        options: {
          plugins: {
            legend: { display: boolean };
            tooltip: { callbacks: { label: (context: { dataset: { label?: string }; parsed: { x: number; y: number } }) => string } };
          };
          scales: {
            x: { title: { text: string } };
            y: { title: { text: string } };
          };
        };
      };

      expect(config.type).toBe('scatter');
      expect(config.options.plugins.legend.display).toBe(true);
      expect(config.options.scales.x.title.text).toBe('Enrollment');
      expect(config.options.scales.y.title.text).toBe('Sites');
      expect(config.options.plugins.tooltip.callbacks.label({
        dataset: { label: 'Trials' },
        parsed: { x: 10, y: 20 },
      })).toBe('Trials: (10, 20)');
    });

    it('destroys chart instances on rerender and destroy', () => {
      fixture.componentRef.setInput('chartData', {
        datasets: [{ label: 'Trials', data: [{ x: 1, y: 2 }] }],
      });
      fixture.detectChanges();
      TestBed.flushEffects();
      chartDestroyMock.mockClear();

      fixture.componentRef.setInput('chartData', {
        datasets: [{ label: 'Trials', data: [{ x: 3, y: 4 }] }],
      });
      fixture.detectChanges();
      TestBed.flushEffects();

      expect(chartDestroyMock).toHaveBeenCalledTimes(1);

      fixture.destroy();
      expect(chartDestroyMock).toHaveBeenCalledTimes(2);
    });
  });
});
