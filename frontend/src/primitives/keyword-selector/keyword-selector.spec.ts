import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ElementRef } from '@angular/core';
import { KeywordSelector } from './keyword-selector';
import { ClinicalStudyService } from '../../services/clinical-study.service';
import { vi } from 'vitest';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('KeywordSelector', () => {
    let component: KeywordSelector;
    let fixture: ComponentFixture<KeywordSelector>;
    let mockClinicalStudyService: any;

    beforeEach(async () => {
        mockClinicalStudyService = {
            getSuggestedKeywords: vi.fn().mockReturnValue(['test (tag)', 'test (category)'])
        };

        await TestBed.configureTestingModule({
            imports: [KeywordSelector, ReactiveFormsModule],
            providers: [
                { provide: ClinicalStudyService, useValue: mockClinicalStudyService },
                { provide: ElementRef, useValue: { nativeElement: document.createElement('div') } }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(KeywordSelector);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should search when query value changes', async () => {
        component.queryControl.setValue('test');
        await sleep(350); // debounce time is 300
        expect(mockClinicalStudyService.getSuggestedKeywords).toHaveBeenCalledWith('test');
        expect(component.suggestions()).toEqual(['test (tag)', 'test (category)']);
    });

    it('should clear suggestions when query is empty', async () => {
        component.queryControl.setValue('test');
        await sleep(350);
        expect(component.suggestions().length).toBeGreaterThan(0);

        component.queryControl.setValue('');
        await sleep(350);
        expect(component.suggestions()).toEqual([]);
    });

    it('should emit addKeyword when a suggestion is selected', () => {
        const emitSpy = vi.spyOn(component.addKeyword, 'emit');
        component.onSelectSuggestion('new tag');
        expect(emitSpy).toHaveBeenCalledWith('new tag');
        expect(component.queryControl.value).toBe('');
        expect(component.suggestions()).toEqual([]);
    });

    it('should emit removeKeyword when onRemove is called', () => {
        const emitSpy = vi.spyOn(component.removeKeyword, 'emit');
        component.onRemove('old tag');
        expect(emitSpy).toHaveBeenCalledWith('old tag');
    });

    it('should navigate suggestions with ArrowDown and ArrowUp', () => {
        component.suggestions.set(['a', 'b', 'c']);
        component.highlightedIndex.set(-1);

        const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
        component.onKeyDown(downEvent);
        expect(component.highlightedIndex()).toBe(0);

        component.onKeyDown(downEvent);
        expect(component.highlightedIndex()).toBe(1);

        const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
        component.onKeyDown(upEvent);
        expect(component.highlightedIndex()).toBe(0);
    });

    it('should select highlighted suggestion on Enter', () => {
        const emitSpy = vi.spyOn(component.addKeyword, 'emit');
        component.suggestions.set(['a', 'b', 'c']);
        component.highlightedIndex.set(1);

        const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
        component.onKeyDown(enterEvent);
        expect(emitSpy).toHaveBeenCalledWith('b');
    });

    it('should clear suggestions on Escape', () => {
        component.suggestions.set(['a', 'b']);
        component.onEscape();
        expect(component.suggestions()).toEqual([]);
        expect(component.highlightedIndex()).toBe(-1);
    });
});
