import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AutoCompleteInput } from './auto-complete-input';
import { ReactiveFormsModule } from '@angular/forms';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { By } from '@angular/platform-browser';

@Component({
    standalone: true,
    imports: [AutoCompleteInput],
    template: `
        <app-auto-complete-input 
            [value]="val()" 
            [suggestions]="[]">
        </app-auto-complete-input>
    `
})
class TestHost {
    val = signal('');
}

describe('AutoCompleteInput', () => {
    let fixture: ComponentFixture<TestHost>;
    let host: TestHost;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHost, AutoCompleteInput, ReactiveFormsModule]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHost);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should sync the initial value input to the input element', () => {
        host.val.set('Diabetes');
        fixture.detectChanges();
        
        const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
        expect(input.value).toBe('Diabetes');
    });

    it('should update the input element when the value input changes', () => {
        host.val.set('Asthma');
        fixture.detectChanges();
        
        const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
        expect(input.value).toBe('Asthma');

        host.val.set('Hypertension');
        fixture.detectChanges();
        expect(input.value).toBe('Hypertension');
    });

    it('should not override the input value when suggestions change', () => {
        host.val.set('Heart Disease');
        fixture.detectChanges();
        
        const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
        expect(input.value).toBe('Heart Disease');

        fixture.detectChanges();
        expect(input.value).toBe('Heart Disease');
    });

    it('should emit searchQueryChange on input', async () => {
        const component = fixture.debugElement.query(By.directive(AutoCompleteInput)).componentInstance;
        const emitSpy = vi.spyOn(component.searchQueryChange, 'emit');
        
        const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
        input.value = 'abc';
        input.dispatchEvent(new Event('input'));
        
        await new Promise(resolve => setTimeout(resolve, 350));
        expect(emitSpy).toHaveBeenCalledWith('abc');
    });

    it('should navigate suggestions with keyboard', () => {
        const debugEl = fixture.debugElement.query(By.directive(AutoCompleteInput));
        const component = debugEl.componentInstance;
        
        component.suggestions = signal(['apple', 'banana']);
        component.isOpen.set(true);
        fixture.detectChanges();

        const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
        
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        expect(component.highlightedIndex()).toBe(0);

        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        expect(component.highlightedIndex()).toBe(1);

        const emitSpy = vi.spyOn(component.itemSelected, 'emit');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(emitSpy).toHaveBeenCalledWith('banana');
    });

    it('should navigate upward, escape, and submit typed values with the keyboard', () => {
        const debugEl = fixture.debugElement.query(By.directive(AutoCompleteInput));
        const component = debugEl.componentInstance;
        component.suggestions = signal(['apple', 'banana']);
        component.isOpen.set(true);
        fixture.detectChanges();

        const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        expect(component.highlightedIndex()).toBe(1);

        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(component.isOpen()).toBe(false);

        component.queryControl.setValue(' typed value ', { emitEvent: false });
        const emitSpy = vi.spyOn(component.itemSelected, 'emit');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(emitSpy).toHaveBeenCalledWith('typed value');
    });

    it('should retain selected value when clearOnSelect is false', () => {
        const debugEl = fixture.debugElement.query(By.directive(AutoCompleteInput));
        const component = debugEl.componentInstance;
        component.clearOnSelect = signal(false);
        const emitSpy = vi.spyOn(component.itemSelected, 'emit');

        component.onSelectSuggestion(' asthma ');

        expect(emitSpy).toHaveBeenCalledWith('asthma');
        expect(component.queryControl.value).toBe('asthma');
        expect(component.isOpen()).toBe(false);
        expect(component.highlightedIndex()).toBe(-1);
    });

    it('should emit trimmed blur values and clear by default', () => {
        const debugEl = fixture.debugElement.query(By.directive(AutoCompleteInput));
        const component = debugEl.componentInstance;
        const emitSpy = vi.spyOn(component.itemSelected, 'emit');
        component.queryControl.setValue(' diabetes ', { emitEvent: false });
        component.isOpen.set(true);
        component.isFocused.set(true);

        component.onBlur();

        expect(emitSpy).toHaveBeenCalledWith('diabetes');
        expect(component.queryControl.value).toBe('');
        expect(component.isOpen()).toBe(false);
        expect(component.isFocused()).toBe(false);
    });

    it('should close when clicking outside but not inside', () => {
        const debugEl = fixture.debugElement.query(By.directive(AutoCompleteInput));
        const component = debugEl.componentInstance;
        component.isOpen.set(true);

        component.onDocumentClick(new MouseEvent('click'));
        expect(component.isOpen()).toBe(false);

        component.isOpen.set(true);
        component.onDocumentClick(new MouseEvent('click', { bubbles: true }));
        const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
        component.isOpen.set(true);
        component.onDocumentClick({ target: input } as unknown as MouseEvent);
        expect(component.isOpen()).toBe(true);
    });

    it('should close on document scroll outside the suggestions panel and remove listener on destroy', () => {
        const debugEl = fixture.debugElement.query(By.directive(AutoCompleteInput));
        const component = debugEl.componentInstance;
        const addSpy = vi.spyOn(window, 'addEventListener');
        const removeSpy = vi.spyOn(window, 'removeEventListener');
        component.suggestions = signal(['apple']);
        component.isOpen.set(true);
        fixture.detectChanges();
        TestBed.flushEffects();

        expect(addSpy).toHaveBeenCalledWith('scroll', expect.any(Function), true);
        component['closeOnScroll']({ target: document.body } as unknown as Event);

        expect(component.isOpen()).toBe(false);
        component.ngOnDestroy();
        expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function), true);
    });
});
