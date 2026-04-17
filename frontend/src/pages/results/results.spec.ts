import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { Results } from './results';
import { TrialWorkflowService } from '../../services/trial-workflow-service';
import { ResultsApiService } from '../../services/results-api.service';
import { ResultsModel } from '../../models/results-model';
import { mockTrialResultsResponse } from '../../services/mock-trial-results';
import { AuthService } from '../../services/auth.service';
import { PermissionService } from '../../services/permission.service';

describe('Results', () => {
    let component: Results;
    let fixture: ComponentFixture<Results>;
    let mockRouter: { navigate: ReturnType<typeof vi.fn> };
    let mockWorkflowService: any;
    let mockAuthService: any;
    let mockPermissionService: any;
    let exportPermission: WritableSignal<boolean>;

    beforeEach(async () => {
        const resultsModel = new ResultsModel();
        resultsModel.trialResults = mockTrialResultsResponse;

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
            foundTrials: signal([]),
            selectedTrialIds: signal([]),
            processResults: vi.fn(),
        };
        mockAuthService = {
            isLoggedIn: vi.fn().mockReturnValue(true),
        };
        exportPermission = signal(true);
        mockPermissionService = {
            watch: vi.fn(() => exportPermission.asReadonly()),
        };

        TestBed.overrideComponent(Results, {
            set: {
                template: `
                    @if (canExportCriteria() && hasCriteriaToExport()) {
                        <button type="button" (click)="onExportCriteria()">Export</button>
                    }
                `,
            },
        });

        await TestBed.configureTestingModule({
            imports: [Results],
            providers: [
                { provide: Router, useValue: mockRouter },
                { provide: TrialWorkflowService, useValue: mockWorkflowService },
                { provide: ResultsApiService, useValue: { getResults: vi.fn() } },
                { provide: AuthService, useValue: mockAuthService },
                { provide: PermissionService, useValue: mockPermissionService },
            ],
        }).compileComponents();

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
});
