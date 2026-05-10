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

    it('should clear suggestions when query is whitespace only', () => {
        component.onSearchQueryChange('test');

        component.onSearchQueryChange('   ');

        expect(component.suggestions()).toEqual([]);
    });

    it('should emit addKeyword when onSelectSuggestion is called', () => {
        const emitSpy = vi.spyOn(component.addKeyword, 'emit');
        component.onSelectSuggestion('new tag');
        expect(emitSpy).toHaveBeenCalledWith('new tag');
        expect(component.suggestions()).toEqual([]);
    });

    it('should trim selected suggestions and ignore blank selections', () => {
        const emitSpy = vi.spyOn(component.addKeyword, 'emit');

        component.onSelectSuggestion('  trimmed tag  ');
        component.onSelectSuggestion('   ');

        expect(emitSpy).toHaveBeenCalledTimes(1);
        expect(emitSpy).toHaveBeenCalledWith('trimmed tag');
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

    it('should render selected keyword tags and remove from tag button clicks', () => {
        const emitSpy = vi.spyOn(component.removeKeyword, 'emit');
        fixture.componentRef.setInput('selectedKeywords', ['diabetes', 'asthma']);
        fixture.detectChanges();

        const tags = Array.from(fixture.nativeElement.querySelectorAll('.tag') as NodeListOf<HTMLElement>);
        expect(tags.map((tag) => tag.textContent?.trim())).toEqual(['diabetes ×', 'asthma ×']);

        (tags[1].querySelector('.remove-btn') as HTMLButtonElement).click();

        expect(emitSpy).toHaveBeenCalledWith('asthma');
    });

    it('should pass input configuration to the auto-complete primitive', () => {
        fixture.componentRef.setInput('inputId', 'criteria-keywords');
        fixture.componentRef.setInput('placeholderText', 'Add keyword');
        fixture.componentRef.setInput('hintText', 'Press Enter');
        fixture.detectChanges();

        const autoControl = fixture.debugElement.query(By.directive(AutoCompleteInput)).componentInstance;
        expect(autoControl.inputId()).toBe('criteria-keywords');
        expect(autoControl.placeholderText()).toBe('Add keyword');
        expect(autoControl.hintText()).toBe('Press Enter');
    });
});
