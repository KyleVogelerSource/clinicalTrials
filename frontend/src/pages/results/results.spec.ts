import { Component, Input, NO_ERRORS_SCHEMA, signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { Results } from './results';
import { TrialWorkflowService } from '../../services/trial-workflow-service';
import { ResultsApiService } from '../../services/results-api.service';
import { ResultsModel } from '../../models/results-model';
import { mockTrialResultsResponse } from '../../services/mock-trial-results';
import { PermissionService } from '../../services/permission.service';
import { LoadingService } from '../../services/loading.service';
import { HeatPoint } from '../../primitives/heatmap/heatmap';

@Component({
    selector: 'app-progress-track',
    template: '<div data-testid="progress-track">{{ activeStep }}</div>',
})
class ProgressTrackStub {
    @Input() activeStep = 0;
}

@Component({
    selector: 'app-bar-chart',
    template: '<div data-testid="bar-chart">{{ xAxisLabel }}|{{ yAxisLabel }}</div>',
})
class BarChartStub {
    @Input() chartData: unknown;
    @Input() xAxisLabel = '';
    @Input() yAxisLabel = '';
    @Input() grouped = false;
}

@Component({
    selector: 'app-scatter-chart',
    template: '<div data-testid="scatter-chart">{{ xAxisLabel }}|{{ yAxisLabel }}</div>',
})
class ScatterChartStub {
    @Input() chartData: unknown;
    @Input() xAxisLabel = '';
    @Input() yAxisLabel = '';
}

@Component({
    selector: 'app-heatmap',
    template: '<div data-testid="heatmap">{{ points.length }}</div>',
})
class HeatmapStub {
    @Input() points: HeatPoint[] = [];
}

@Component({
    selector: 'app-loading-indicator',
    template: '<div data-testid="loading-indicator">Analyzing clinical trials data</div>',
})
class LoadingIndicatorStub {
    @Input() visible = false;
    @Input() local = false;
}

describe('Results', () => {
    let component: Results;
    let fixture: ComponentFixture<Results>;
    let mockRouter: { navigate: ReturnType<typeof vi.fn> };
    let mockWorkflowService: any;
    let mockPermissionService: any;
    let mockResultsApiService: any;
    let mockLoadingService: any;
    let exportPermission: WritableSignal<boolean>;

    beforeEach(async () => {
        const resultsModel = new ResultsModel();
        resultsModel.trialResults = mockTrialResultsResponse;
        resultsModel.terminationReasons = [
            { reason: 'Completed', count: 4 },
            { reason: 'Terminated', count: 1 },
        ];
        resultsModel.siteLocations = [{ latitude: 42.36, longitude: -71.05 }];
        resultsModel.metricRows = [{
            id: 'NCT100',
            totalEnrollment: 120,
            siteCount: 5,
            recruitmentVelocity: 1.5,
            inclusionStrictness: 12,
            siteEfficiency: 24,
            outcomeDensity: 3,
            ageSpan: 40,
            minAge: 18,
            maxAge: 58,
            interventionCount: 2,
            collaboratorCount: 1,
            timelineSlippage: 14,
            maskingIntensity: 2,
            geographicSpread: 1,
            conditionCount: 2,
        }];

        mockLoadingService = {
            isLoading: signal(false),
            message: signal(''),
            show: vi.fn((msg: string) => {
                mockLoadingService.isLoading.set(true);
                mockLoadingService.message.set(msg);
            }),
            hide: vi.fn(() => {
                mockLoadingService.isLoading.set(false);
                mockLoadingService.message.set('');
            }),
        };

        mockRouter = {
            navigate: vi.fn(),
        };
        mockWorkflowService = {
            inputParams: signal({
                condition: 'Type 2 Diabetes',
                phase: 'Phase 3',
                allocationType: 'Randomized',
                interventionModel: 'Parallel Assignment',
                blindingType: 'Double',
                minAge: 18,
                maxAge: 65,
                sex: 'Female',
                required: ['Hypertension'],
                ineligible: ['Heart Failure'],
            }),
            results: signal(resultsModel),
            foundTrials: signal([
                {
                    nctId: 'NCT100',
                    briefTitle: 'Diabetes Trial',
                    conditions: ['Type 2 Diabetes'],
                    enrollmentCount: 120,
                    location: 'Boston, USA',
                    startDate: '2024-01-01',
                    completionDate: '2024-06-01',
                    sponsor: 'NIH',
                    phase: 'Phase 3',
                    description: 'A detailed trial summary.',
                    sites: ['Boston Medical Center'],
                },
            ]),
            selectedTrialIds: signal(['NCT100']),
            processResults: vi.fn(() => {
                mockLoadingService.show('Analyzing clinical trials data...');
            }),
        };
        exportPermission = signal(true);
        mockPermissionService = {
            watch: vi.fn(() => exportPermission.asReadonly()),
        };
        mockResultsApiService = {
            getResults: vi.fn(),
        };

        await TestBed.configureTestingModule({
            imports: [Results],
            schemas: [NO_ERRORS_SCHEMA],
            providers: [
                { provide: Router, useValue: mockRouter },
                { provide: TrialWorkflowService, useValue: mockWorkflowService },
                { provide: ResultsApiService, useValue: mockResultsApiService },
                { provide: PermissionService, useValue: mockPermissionService },
                { provide: LoadingService, useValue: mockLoadingService },
            ],
        })
            .overrideComponent(Results, {
                set: {
                    imports: [ProgressTrackStub, BarChartStub, ScatterChartStub, HeatmapStub, LoadingIndicatorStub],
                },
            })
            .compileComponents();

        fixture = TestBed.createComponent(Results);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('shows the export button in the results step', () => {
        const buttons = Array.from(
            fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
        );
        const exportButton = buttons.find(button => button.textContent?.trim() === 'Export');
        const importButton = buttons.find(button => button.textContent?.trim() === 'Import');

        expect(exportButton).toBeTruthy();
        expect(importButton).toBeUndefined();
    });

    it('checks the export permission action on init', () => {
        expect(mockPermissionService.watch).toHaveBeenCalledWith('search_criteria_export');
    });

    it('renders the loaded-state sections from the real template', () => {
        expect(fixture.nativeElement.textContent).toContain('Overview');
        expect(fixture.nativeElement.textContent).toContain('Recruitment Velocity');
        expect(fixture.nativeElement.textContent).toContain('Expected Timeline');
        expect(fixture.nativeElement.textContent).toContain('Heatmap');
        expect(fixture.nativeElement.textContent).toContain('Data Plot');
        expect(fixture.nativeElement.textContent).toContain('Comparison Table');
        expect(fixture.nativeElement.querySelectorAll('[data-testid="bar-chart"]').length).toBe(3);
        expect(fixture.nativeElement.querySelector('[data-testid="scatter-chart"]')).toBeTruthy();
        expect(fixture.nativeElement.querySelector('[data-testid="heatmap"]')).toBeTruthy();
    });

    it('exports the current workflow criteria as JSON', () => {
        const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:criteria');
        const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        const clickSpy = vi.fn();
        const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue({
            href: '',
            download: '',
            click: clickSpy,
        } as unknown as HTMLAnchorElement);

        component.onExportCriteria();

        expect(createObjectURLSpy).toHaveBeenCalled();
        expect(clickSpy).toHaveBeenCalled();
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:criteria');

        createObjectURLSpy.mockRestore();
        revokeObjectURLSpy.mockRestore();
        createElementSpy.mockRestore();
    });

    it('hides export when the user lacks export permission', () => {
        exportPermission.set(false);

        fixture = TestBed.createComponent(Results);
        component = fixture.componentInstance;
        fixture.detectChanges();

        const buttons = Array.from(
            fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
        );
        const exportButton = buttons.find(button => button.textContent?.trim() === 'Export');

        expect(exportButton).toBeUndefined();
    });

    it('filters and sorts the comparison table rows', () => {
        component.comparisonSearch.set('diabetes');
        fixture.detectChanges();

        expect(component.comparisonRows()).toHaveLength(1);
        expect(component.comparisonRows()[0].metrics['phaseMatch']).toBe(true);
        expect(component.comparisonRows()[0].metrics['highEnrollment']).toBe(false);
        expect(component.comparisonRows()[0].metrics['hasDescription']).toBe(true);

        component.onComparisonSort('hasDescription');
        expect(component.comparisonSortKey()).toBe('hasDescription');
        expect(component.comparisonSortAsc()).toBe(true);

        component.onComparisonSort('hasDescription');
        expect(component.comparisonSortAsc()).toBe(false);
    });

    it('updates the comparison search from the input event', () => {
        component.onComparisonSearch({
            target: { value: 'heart failure' },
        } as unknown as Event);

        expect(component.comparisonSearch()).toBe('heart failure');
    });

    it('navigates back to designer when there are no workflow inputs', () => {
        mockWorkflowService.inputParams.set(null);

        fixture = TestBed.createComponent(Results);
        component = fixture.componentInstance;
        fixture.detectChanges();

        expect(mockRouter.navigate).toHaveBeenCalledWith(['/designer']);
    });

    it('does not export when there are no workflow criteria', () => {
        mockWorkflowService.inputParams.set(null);
        const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:criteria');

        component.onExportCriteria();

        expect(createObjectURLSpy).not.toHaveBeenCalled();
        createObjectURLSpy.mockRestore();
    });

    it('navigates back to designer when onBack is called', () => {
        component.onBack();

        expect(mockRouter.navigate).toHaveBeenCalledWith(['/designer']);
    });
});
