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

    elementRef = inject(ElementRef);
    
    selectedValue = signal<string | null>(null);
    isOpen = signal(false);
    hoveredOption = signal<string | null>(null);
    tooltipTop = signal<number>(0);
    tooltipLeft = signal<number>(0);

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
        this.isOpen.update(v => !v);
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
        this.tooltipLeft.set(rect.right + 10);
        this.tooltipTop.set(rect.top + (rect.height / 2));
    }
}
