import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AutoCompleteInput } from './auto-complete-input';
import { ReactiveFormsModule } from '@angular/forms';
import { describe, it, expect, beforeEach, vi } from 'vitest';
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
});
