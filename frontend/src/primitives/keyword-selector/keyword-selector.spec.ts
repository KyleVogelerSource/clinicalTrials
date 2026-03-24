import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KeywordSelector } from './keyword-selector';
import { ClinicalStudyService } from '../../services/clinical-study.service';
import { vi } from 'vitest';
import { By } from '@angular/platform-browser';
import { AutoCompleteInput } from '../auto-complete-input/auto-complete-input';

describe('KeywordSelector', () => {
    let component: KeywordSelector;
    let fixture: ComponentFixture<KeywordSelector>;
    let mockClinicalStudyService: any;

    beforeEach(async () => {
        mockClinicalStudyService = {
            getSuggestedKeywords: vi.fn().mockReturnValue(['test (tag)', 'test (category)'])
        };

        await TestBed.configureTestingModule({
            imports: [KeywordSelector],
            providers: [
                { provide: ClinicalStudyService, useValue: mockClinicalStudyService }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(KeywordSelector);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should update suggestions when onSearchQueryChange is called', () => {
        component.onSearchQueryChange('test');
        expect(mockClinicalStudyService.getSuggestedKeywords).toHaveBeenCalledWith('test');
        expect(component.suggestions()).toEqual(['test (tag)', 'test (category)']);
    });

    it('should clear suggestions when query is empty', () => {
        component.onSearchQueryChange('test');
        expect(component.suggestions().length).toBeGreaterThan(0);

        component.onSearchQueryChange('');
        expect(component.suggestions()).toEqual([]);
    });

    it('should emit addKeyword when onSelectSuggestion is called', () => {
        const emitSpy = vi.spyOn(component.addKeyword, 'emit');
        component.onSelectSuggestion('new tag');
        expect(emitSpy).toHaveBeenCalledWith('new tag');
        expect(component.suggestions()).toEqual([]);
    });

    it('should emit removeKeyword when onRemove is called', () => {
        const emitSpy = vi.spyOn(component.removeKeyword, 'emit');
        component.onRemove('old tag');
        expect(emitSpy).toHaveBeenCalledWith('old tag');
    });

    it('should pass suggestions to app-auto-complete-input', () => {
        component.suggestions.set(['sugar', 'salt']);
        fixture.detectChanges();
        
        const autoControl = fixture.debugElement.query(By.directive(AutoCompleteInput));
        expect(autoControl.componentInstance.suggestions()).toEqual(['sugar', 'salt']);
    });
});
