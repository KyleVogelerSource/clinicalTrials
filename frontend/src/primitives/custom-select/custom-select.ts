import { Component, ChangeDetectionStrategy, input, output, ElementRef, inject, signal, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
    selector: 'app-custom-select',
    standalone: true,
    templateUrl: './custom-select.html',
    styleUrl: './custom-select.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => CustomSelect),
            multi: true
        }
    ],
    host: {
        '(document:click)': 'onDocumentClick($event)'
    }
})
export class CustomSelect implements ControlValueAccessor {
    inputId = input<string>('');
    options = input.required<string[]>();
    descriptions = input<Record<string, string>>({});
    placeholder = input<string>('Select an option...');
    width = input<string>('100%');

    elementRef = inject(ElementRef);
    
    selectedValue = signal<string | null>(null);
    isOpen = signal(false);
    hoveredOption = signal<string | null>(null);
    tooltipTop = signal<number>(0);
    tooltipLeft = signal<number>(0);
    tooltipPosition = signal<'left' | 'right'>('right');
    dropdownAlignment = signal<'left' | 'right'>('left');

    // ControlValueAccessor methods
    onChange: any = () => {};
    onTouched: any = () => {};

    writeValue(value: string | null): void {
        this.selectedValue.set(value);
    }

    registerOnChange(fn: any): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: any): void {
        this.onTouched = fn;
    }

    setDisabledState?(isDisabled: boolean): void {
        // Handle disabled state if needed
    }

    toggleDropdown() {
        if (!this.isOpen()) {
            this.calculateDropdownAlignment();
        }
        this.isOpen.update(v => !v);
    }

    private calculateDropdownAlignment() {
        const rect = this.elementRef.nativeElement.getBoundingClientRect();
        const screenWidth = window.innerWidth;
        // If less than 300px available to the right of component start, align dropdown to right (expand left)
        if (screenWidth - rect.left < 300) {
            this.dropdownAlignment.set('right');
        } else {
            this.dropdownAlignment.set('left');
        }
    }

    selectOption(option: string) {
        this.selectedValue.set(option);
        this.onChange(option);
        this.onTouched();
        this.isOpen.set(false);
    }

    onDocumentClick(event: MouseEvent) {
        if (!this.elementRef.nativeElement.contains(event.target)) {
            this.isOpen.set(false);
        }
    }

    onOptionHover(option: string | null, event?: MouseEvent) {
        this.hoveredOption.set(option);
        if (option && event) {
            this.updateTooltipPosition(event.currentTarget as HTMLElement);
        }
    }

    onPanelScroll(event: Event) {
        const panel = event.currentTarget as HTMLElement;
        const hoveredLi = panel.querySelector('.option-item:hover') as HTMLElement;
        if (hoveredLi) {
            this.updateTooltipPosition(hoveredLi);
        } else {
            this.hoveredOption.set(null);
        }
    }

    private updateTooltipPosition(element: HTMLElement) {
        const rect = element.getBoundingClientRect();
        const screenWidth = window.innerWidth;
        const tooltipWidth = 240; // max-width + padding allowance

        if (rect.right + tooltipWidth > screenWidth) {
            // Not enough room on right, flip to left of the item
            this.tooltipPosition.set('left');
            this.tooltipLeft.set(rect.left - 10);
        } else {
            this.tooltipPosition.set('right');
            this.tooltipLeft.set(rect.right + 10);
        }
        
        this.tooltipTop.set(rect.top + (rect.height / 2));
    }
}
