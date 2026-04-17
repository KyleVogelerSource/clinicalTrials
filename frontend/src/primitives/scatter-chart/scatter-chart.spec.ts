import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScatterChart } from './scatter-chart';

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
    ScatterController: {},
    PointElement: {},
    LinearScale: {},
    Tooltip: {},
    Legend: {},
    Title: {},
  };
});

describe('ScatterChart', () => {
  let fixture: ComponentFixture<ScatterChart>;

  beforeEach(async () => {
    chartDestroyMock.mockClear();
    chartConstructorMock.mockClear();

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

    const config = chartConstructorMock.mock.calls[0]?.[1] as any;

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
    chartDestroyMock.mockClear();

    fixture.componentRef.setInput('chartData', {
      datasets: [{ label: 'Trials', data: [{ x: 3, y: 4 }] }],
    });
    fixture.detectChanges();

    expect(chartDestroyMock).toHaveBeenCalledTimes(1);

    fixture.destroy();
    expect(chartDestroyMock).toHaveBeenCalledTimes(2);
  });
});
