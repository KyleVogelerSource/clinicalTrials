import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Designer } from './designer';
import { ClinicalStudyService } from '../../services/clinical-study.service';
import { vi } from 'vitest';

describe('Designer', () => {
    let component: Designer;
    let fixture: ComponentFixture<Designer>;
    let mockClinicalStudyService: any;

    beforeEach(async () => {
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

        await TestBed.configureTestingModule({
            imports: [Designer, ReactiveFormsModule],
            providers: [
                { provide: ClinicalStudyService, useValue: mockClinicalStudyService }
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
});
