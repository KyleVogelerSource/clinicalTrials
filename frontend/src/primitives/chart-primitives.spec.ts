import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BarChart } from './bar-chart/bar-chart';
import { ScatterChart } from './scatter-chart/scatter-chart';

describe('Chart primitives', () => {
  describe('BarChart', () => {
    let fixture: ComponentFixture<BarChart>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [BarChart],
      }).compileComponents();

      fixture = TestBed.createComponent(BarChart);
    });

    it('invokes renderChart after inputs and canvas are available', () => {
      const component = fixture.componentInstance;
      const renderChartSpy = vi.spyOn(component as never, 'renderChart' as never) as ReturnType<typeof vi.fn>;
      renderChartSpy.mockImplementation(() => undefined);

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

      expect(renderChartSpy).toHaveBeenCalledWith(
        {
          labels: ['A', 'B'],
          datasets: [
            { label: 'Days', data: [1, 2], backgroundColor: '#088989' },
            { label: 'Participants', data: [3, 4], backgroundColor: '#193F6A' },
          ],
        },
        expect.any(HTMLCanvasElement)
      );
    });

    it('destroys an existing chart on component teardown', () => {
      const component = fixture.componentInstance as unknown as {
        chart: { destroy: ReturnType<typeof vi.fn> };
        ngOnDestroy: () => void;
      };
      const destroySpy = vi.fn();
      component.chart = { destroy: destroySpy };

      fixture.destroy();

      expect(destroySpy).toHaveBeenCalledTimes(1);
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

    it('invokes renderChart after inputs and canvas are available', () => {
      const component = fixture.componentInstance;
      const renderChartSpy = vi.spyOn(component as never, 'renderChart' as never) as ReturnType<typeof vi.fn>;
      renderChartSpy.mockImplementation(() => undefined);

      fixture.componentRef.setInput('chartData', {
        datasets: [{ label: 'Trials', data: [{ x: 10, y: 20 }] }],
      });
      fixture.componentRef.setInput('xAxisLabel', 'Enrollment');
      fixture.componentRef.setInput('yAxisLabel', 'Sites');
      fixture.componentRef.setInput('showLegend', true);
      fixture.detectChanges();
      TestBed.flushEffects();

      expect(renderChartSpy).toHaveBeenCalledWith(
        {
          datasets: [{ label: 'Trials', data: [{ x: 10, y: 20 }] }],
        },
        expect.any(HTMLCanvasElement)
      );
    });

    it('destroys an existing chart on component teardown', () => {
      const component = fixture.componentInstance as unknown as {
        chart: { destroy: ReturnType<typeof vi.fn> };
        ngOnDestroy: () => void;
      };
      const destroySpy = vi.fn();
      component.chart = { destroy: destroySpy };

      fixture.destroy();

      expect(destroySpy).toHaveBeenCalledTimes(1);
    });
  });
});
