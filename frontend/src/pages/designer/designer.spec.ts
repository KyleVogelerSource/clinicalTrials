import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Designer } from './designer';
import { ClinicalStudyService } from '../../services/clinical-study.service';
import { TrialWorkflowService } from '../../services/trial-workflow-service';
import { AuthService } from '../../services/auth.service';
import { SavedSearchService } from '../../services/saved-search.service';
import { vi } from 'vitest';
import { PermissionService } from '../../services/permission.service';
import { WritableSignal, signal } from '@angular/core';

describe('Designer', () => {
    let component: Designer;
    let fixture: ComponentFixture<Designer>;
    let mockClinicalStudyService: any;
    let mockWorkflowService: any;
    let mockRouter: any;
    let mockAuthService: any;
    let mockSavedSearchService: any;
    let mockPermissionService: any;
    let storageState: Record<string, string>;
    let importPermission: WritableSignal<boolean>;

    beforeEach(async () => {
        storageState = {};
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            value: {
                getItem: vi.fn((key: string) => storageState[key] ?? null),
                setItem: vi.fn((key: string, value: string) => {
                    storageState[key] = value;
                }),
                removeItem: vi.fn((key: string) => {
                    delete storageState[key];
                }),
            },
        });
        globalThis.localStorage.removeItem('designer_import_help_dismissed');
        mockClinicalStudyService = {
            getMatchingConditions: vi.fn().mockReturnValue(['test_test', 'test_one']),
            getSuggestedKeywords: vi.fn().mockReturnValue([]),
            getPhases: vi.fn().mockReturnValue(['Phase 1', 'Phase 2', 'Phase 3']),
            getAllocations: vi.fn().mockReturnValue(['N/A', 'Randomized', 'Non-Randomized']),
            getInterventionModels: vi.fn().mockReturnValue(['Single Group Assignment', 'Parallel Assignment']),
            getMaskingTypes: vi.fn().mockReturnValue(['None (Open Label)', 'Single', 'Double', 'Triple', 'Quadruple']),
            getSexes: vi.fn().mockReturnValue(['All', 'Female', 'Male']),
            getDefaultPhase: vi.fn().mockReturnValue('Phase 1'),
            getDefaultAllocation: vi.fn().mockReturnValue('N/A'),
            getDefaultMaskingType: vi.fn().mockReturnValue('None (Open Label)'),
            getDefaultSex: vi.fn().mockReturnValue('All')
        };
        mockWorkflowService = {
            inputParams: signal(null),
            setInputs: vi.fn(),
            setImportNotice: vi.fn(),
            searchTrials: vi.fn(),
        };
        mockRouter = {
            navigate: vi.fn(),
        };
        importPermission = signal(true);
        mockAuthService = {
            isLoggedIn: vi.fn().mockReturnValue(true),
        };
        mockPermissionService = {
            watch: vi.fn(() => importPermission.asReadonly()),
        };
        mockSavedSearchService = {
            create: vi.fn().mockReturnValue(of({})),
        };

        await TestBed.configureTestingModule({
            imports: [Designer, ReactiveFormsModule],
            providers: [
                { provide: ClinicalStudyService, useValue: mockClinicalStudyService },
                { provide: TrialWorkflowService, useValue: mockWorkflowService },
                { provide: Router, useValue: mockRouter },
                { provide: AuthService, useValue: mockAuthService },
                { provide: PermissionService, useValue: mockPermissionService },
                { provide: SavedSearchService, useValue: mockSavedSearchService },
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(Designer);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should initialize with default values', () => {
        expect(component.inputForm.get('sex')?.value).toBe('All');
        expect(component.inputForm.get('allocationType')?.value).toBe('N/A');
    });

    it('renders the import control with a distinct import style', () => {
        const importButton = fixture.nativeElement.querySelector('label.import-button');

        expect(importButton).toBeTruthy();
        expect(importButton.classList.contains('btn-import')).toBe(true);
        expect(importButton.getAttribute('for')).toBe('criteriaImport');
    });

    it('checks the import permission action on init', () => {
        expect(mockPermissionService.watch).toHaveBeenCalledWith('search_criteria_import');
    });

    it('hides the import control when the user lacks import permission', async () => {
        importPermission.set(false);

        fixture = TestBed.createComponent(Designer);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();

        expect(fixture.nativeElement.querySelector('label.import-button')).toBeNull();
    });

    it('does not attempt import when permission is denied', async () => {
        importPermission.set(false);
        const file = {
            name: 'criteria.json',
            text: vi.fn().mockResolvedValue('{}'),
        };

        await component.onImportFile({
            target: {
                files: [file],
                value: 'criteria.json',
            },
        } as unknown as Event);

        expect(file.text).not.toHaveBeenCalled();
        expect(mockWorkflowService.setInputs).not.toHaveBeenCalled();
    });

    it('should search matching conditions when query changes', async () => {
        component.onConditionSearch('test');
        expect(mockClinicalStudyService.getMatchingConditions).toHaveBeenCalledWith('test');
        expect(component.conditionMatches()).toEqual(['test_test', 'test_one']);
    });

    it('should add a required condition', () => {
        component.onAddRequired('diabetes');
        expect(component.requiredConditions()).toContain('diabetes');
        expect(component.inputForm.controls.required.value).toContain('diabetes');
    });

    it('should remove a required condition', () => {
        component.requiredConditions.set(['diabetes', 'hypertension']);
        component.onRemoveRequired('diabetes');
        expect(component.requiredConditions()).toEqual(['hypertension']);
        expect(component.inputForm.controls.required.value).toEqual(['hypertension']);
    });

    it('should add an ineligible condition', () => {
        component.onAddIneligible('asthma');
        expect(component.ineligibleConditions()).toContain('asthma');
        expect(component.inputForm.controls.ineligible.value).toContain('asthma');
    });

    it('should remove an ineligible condition', () => {
        component.ineligibleConditions.set(['asthma', 'cancer']);
        component.onRemoveIneligible('asthma');
        expect(component.ineligibleConditions()).toEqual(['cancer']);
        expect(component.inputForm.controls.ineligible.value).toEqual(['cancer']);
    });

    it('should disable next button when form is invalid', () => {
        component.inputForm.controls.minAge.setValue(200); // invalid
        fixture.detectChanges();
        const nextButton = fixture.nativeElement.querySelector('.btn-primary');
        expect(nextButton.disabled).toBe(true);
    });

    it('should enable next button when form is valid', () => {
        component.inputForm.controls.condition.setValue('Diabetes');
        component.inputForm.controls.minAge.setValue(18);
        component.inputForm.controls.maxAge.setValue(65);
        fixture.detectChanges();
        const nextButton = fixture.nativeElement.querySelector('.btn-primary');
        expect(nextButton.disabled).toBe(false);
    });

    it('restores all saved designer values from workflow state', () => {
        mockWorkflowService.inputParams.set({
            condition: 'Diabetes',
            phase: 'Phase 3',
            allocationType: 'Randomized',
            interventionModel: 'Parallel Assignment',
            blindingType: 'Double',
            minAge: 18,
            maxAge: 65,
            sex: 'Female',
            required: ['Hypertension'],
            ineligible: ['Heart Failure'],
        });

        fixture = TestBed.createComponent(Designer);
        component = fixture.componentInstance;
        fixture.detectChanges();

        expect(component.inputForm.getRawValue()).toEqual({
            condition: 'Diabetes',
            phase: 'Phase 3',
            allocationType: 'Randomized',
            interventionModel: 'Parallel Assignment',
            blindingType: 'Double',
            minAge: 18,
            maxAge: 65,
            sex: 'Female',
            required: ['Hypertension'],
            ineligible: ['Heart Failure'],
        });
    });

    it('includes allocation and blinding when saving a search', () => {
        component.inputForm.setValue({
            condition: 'Diabetes',
            phase: 'Phase 3',
            allocationType: 'Randomized',
            interventionModel: 'Parallel Assignment',
            blindingType: 'Double',
            minAge: 18,
            maxAge: 65,
            sex: 'Female',
            required: ['Hypertension'],
            ineligible: ['Heart Failure'],
        });
        component.saveForm.setValue({
            name: 'Saved Diabetes Search',
            description: 'Focused search',
            visibility: 'private',
        });

        component.onSaveSearch();

        expect(mockSavedSearchService.create).toHaveBeenCalledWith({
            name: 'Saved Diabetes Search',
            description: 'Focused search',
            visibility: 'private',
            criteriaJson: {
                condition: 'Diabetes',
                phase: 'Phase 3',
                allocationType: 'Randomized',
                interventionModel: 'Parallel Assignment',
                blindingType: 'Double',
                minAge: 18,
                maxAge: 65,
                sex: 'Female',
                requiredConditions: ['Hypertension'],
                ineligibleConditions: ['Heart Failure'],
            },
        });
    });

    it('surfaces save conflicts from the backend', () => {
        mockSavedSearchService.create.mockReturnValue(throwError(() => ({ status: 409 })));
        component.inputForm.patchValue({ condition: 'Diabetes' });
        component.saveForm.setValue({
            name: 'Duplicate Search',
            description: null,
            visibility: 'private',
        });

        component.onSaveSearch();

        expect(component.saveStatus()).toBe('error');
        expect(component.saveErrorMessage()).toBe('An equivalent search is already saved.');
    });

    it('shows import in the input step without an export button', () => {
        const importButton = fixture.nativeElement.querySelector('label.import-button');
        const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
        const exportButton = buttons.find(button => button.textContent?.trim() === 'Export');

        expect(importButton).toBeTruthy();
        expect(exportButton).toBeUndefined();
    });

    it('imports JSON criteria into the designer form', async () => {
        const file = {
            name: 'criteria.json',
            text: vi.fn().mockResolvedValue(JSON.stringify({
                criteria: {
                    condition: 'Diabetes',
                    phase: 'phase 3',
                    allocationType: 'randomized',
                    interventionModel: 'parallel assignment',
                    blindingType: 'double',
                    minAge: 18,
                    maxAge: 65,
                    sex: 'female',
                    required: ['Hypertension'],
                    ineligible: ['Heart Failure'],
                },
            })),
        };

        await component.onImportFile({
            target: {
                files: [file],
                value: 'criteria.json',
            },
        } as unknown as Event);

        expect(component.inputForm.getRawValue()).toEqual({
            condition: 'Diabetes',
            phase: 'Phase 3',
            allocationType: 'Randomized',
            interventionModel: 'Parallel Assignment',
            blindingType: 'Double',
            minAge: 18,
            maxAge: 65,
            sex: 'Female',
            required: ['Hypertension'],
            ineligible: ['Heart Failure'],
        });
        expect(mockWorkflowService.setInputs).toHaveBeenCalledWith({
            condition: 'Diabetes',
            phase: 'Phase 3',
            allocationType: 'Randomized',
            interventionModel: 'Parallel Assignment',
            blindingType: 'Double',
            minAge: 18,
            maxAge: 65,
            sex: 'Female',
            required: ['Hypertension'],
            ineligible: ['Heart Failure'],
        });
        expect(mockWorkflowService.searchTrials).toHaveBeenCalled();
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/selection']);
        expect(component.importStatus()).toBe('success');
    });

    it('shows an error for invalid import files', async () => {
        await component.onImportFile({
            target: {
                files: [{
                    name: 'criteria.json',
                    text: vi.fn().mockResolvedValue('{not valid json'),
                }],
                value: 'criteria.json',
            },
        } as unknown as Event);

        expect(component.importStatus()).toBe('error');
        expect(component.importMessage()).toBe('Could not import criteria file. Use a valid JSON export.');
    });

    it('dismisses the first-time import/export help', () => {
        expect(component.showImportHelp()).toBe(true);

        component.onDismissImportHelp();

        expect(component.showImportHelp()).toBe(false);
        expect(globalThis.localStorage.getItem('designer_import_help_dismissed')).toBe('true');
    });

    it('keeps the first-time import/export help dismissed across reloads', () => {
        globalThis.localStorage.setItem('designer_import_help_dismissed', 'true');

        fixture = TestBed.createComponent(Designer);
        component = fixture.componentInstance;
        fixture.detectChanges();

        expect(component.showImportHelp()).toBe(false);
    });
});
