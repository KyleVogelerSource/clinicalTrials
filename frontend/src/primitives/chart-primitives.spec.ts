import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BarChart } from './bar-chart/bar-chart';
import { ScatterChart } from './scatter-chart/scatter-chart';

describe('Chart primitives', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function spyOnAnchorDownloads() {
    const anchors: HTMLAnchorElement[] = [];
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        vi.spyOn(element, 'click').mockImplementation(() => undefined);
        anchors.push(element as HTMLAnchorElement);
      }
      return element;
    });
    return anchors;
  }

  function stubObjectUrls() {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn().mockReturnValue('blob:chart-data'),
      revokeObjectURL: vi.fn(),
    });
  }

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

    it('exports the current chart as a PNG', () => {
      const anchors = spyOnAnchorDownloads();
      const component = fixture.componentInstance as unknown as {
        chart: { toBase64Image: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
        exportPng: () => void;
      };
      component.chart = { toBase64Image: vi.fn().mockReturnValue('data:image/png;base64,abc'), destroy: vi.fn() };
      fixture.componentRef.setInput('exportPrefix', 'Recruitment');

      component.exportPng();

      expect(anchors[0].download).toMatch(/^Recruitment Chart \d{4}-\d{2}-\d{2}\.png$/);
      expect(anchors[0].href).toBe('data:image/png;base64,abc');
      expect(anchors[0].click).toHaveBeenCalled();
    });

    it('skips PNG export when no chart has been rendered', () => {
      const anchors = spyOnAnchorDownloads();
      const component = fixture.componentInstance;

      component.exportPng();

      expect(anchors).toHaveLength(0);
    });

    it('exports chart data as CSV', () => {
      const anchors = spyOnAnchorDownloads();
      stubObjectUrls();
      const component = fixture.componentInstance;
      fixture.componentRef.setInput('exportPrefix', 'Timeline');
      fixture.componentRef.setInput('chartData', {
        labels: ['Small', 'Large'],
        datasets: [
          { label: 'Estimated', data: [10, 20], backgroundColor: '#088989' },
          { label: 'Actual', data: [12], backgroundColor: '#193F6A' },
        ],
      });

      component.exportCsv();

      expect(anchors[0].download).toMatch(/^Timeline Data \d{4}-\d{2}-\d{2}\.csv$/);
      expect(anchors[0].href).toBe('blob:chart-data');
      expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:chart-data');
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

    it('computes a trend line and correlation for numeric points', () => {
      const component = fixture.componentInstance as unknown as {
        computeTrendLine: (points: { x: number; y: number }[]) => { linePoints: { x: number; y: number }[]; r: number };
      };

      const result = component.computeTrendLine([
        { x: 1, y: 2 },
        { x: 2, y: 4 },
        { x: 3, y: 6 },
      ]);

      expect(result.linePoints).toEqual([
        { x: 1, y: 2 },
        { x: 3, y: 6 },
      ]);
      expect(result.r).toBeCloseTo(1);
    });

    it('handles vertical and flat trend-line inputs without dividing by zero', () => {
      const component = fixture.componentInstance as unknown as {
        computeTrendLine: (points: { x: number; y: number }[]) => { linePoints: { x: number; y: number }[]; r: number };
      };

      const vertical = component.computeTrendLine([
        { x: 2, y: 1 },
        { x: 2, y: 3 },
      ]);
      const flat = component.computeTrendLine([
        { x: 1, y: 4 },
        { x: 3, y: 4 },
      ]);

      expect(vertical.linePoints).toEqual([
        { x: 2, y: 2 },
        { x: 2, y: 2 },
      ]);
      expect(vertical.r).toBe(0);
      expect(flat.linePoints).toEqual([
        { x: 1, y: 4 },
        { x: 3, y: 4 },
      ]);
      expect(flat.r).toBe(0);
    });

    it('resets zoom state through the current chart instance', () => {
      const component = fixture.componentInstance as unknown as {
        chart: { resetZoom: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
        isZoomed: { set: (value: boolean) => void; (): boolean };
        resetZoom: () => void;
      };
      const resetZoom = vi.fn();
      component.chart = { resetZoom, destroy: vi.fn() };
      component.isZoomed.set(true);

      component.resetZoom();

      expect(resetZoom).toHaveBeenCalledTimes(1);
      expect(component.isZoomed()).toBe(false);
    });

    it('exports the scatter chart as a PNG', () => {
      const anchors = spyOnAnchorDownloads();
      const component = fixture.componentInstance as unknown as {
        chart: { toBase64Image: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
        exportPng: () => void;
      };
      component.chart = { toBase64Image: vi.fn().mockReturnValue('data:image/png;base64,scatter'), destroy: vi.fn() };
      fixture.componentRef.setInput('exportPrefix', 'Scatter');

      component.exportPng();

      expect(anchors[0].download).toMatch(/^Scatter Chart \d{4}-\d{2}-\d{2}\.png$/);
      expect(anchors[0].href).toBe('data:image/png;base64,scatter');
      expect(anchors[0].click).toHaveBeenCalled();
    });

    it('skips scatter PNG export when no chart has been rendered', () => {
      const anchors = spyOnAnchorDownloads();
      const component = fixture.componentInstance;

      component.exportPng();

      expect(anchors).toHaveLength(0);
    });

    it('renders zoom controls based on zoom state and input', async () => {
      const component = fixture.componentInstance as unknown as {
        isZoomed: { set: (value: boolean) => void };
      };
      fixture.componentRef.setInput('chartData', {
        datasets: [{ label: 'Trials', data: [{ x: 1, y: 2 }] }],
      });
      fixture.componentRef.setInput('enableZoom', false);
      fixture.detectChanges();
      await fixture.whenStable();
      component.isZoomed.set(true);
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Reset');
      expect(text).not.toContain('Ctrl + Scroll to zoom');
    });

    it('exports scatter points as CSV', () => {
      const anchors = spyOnAnchorDownloads();
      stubObjectUrls();
      const component = fixture.componentInstance;
      fixture.componentRef.setInput('exportPrefix', 'Scatter');
      fixture.componentRef.setInput('chartData', {
        datasets: [
          {
            label: 'Trials',
            data: [
              { x: 10, y: 20 },
              { x: 15, y: 25 },
            ],
          },
        ],
      });

      component.exportCsv();

      expect(anchors[0].download).toMatch(/^Scatter Data \d{4}-\d{2}-\d{2}\.csv$/);
      expect(anchors[0].href).toBe('blob:chart-data');
      expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:chart-data');
    });
  });
});
