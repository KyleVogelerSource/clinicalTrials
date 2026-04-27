import { Component, ChangeDetectionStrategy, input, output, ElementRef, inject, signal, forwardRef, DestroyRef } from '@angular/core';
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
    private destroyRef = inject(DestroyRef);
    
    selectedValue = signal<string | null>(null);
    isOpen = signal(false);
    hoveredOption = signal<string | null>(null);
    tooltipTop = signal<number>(0);
    tooltipLeft = signal<number>(0);
    tooltipPosition = signal<'left' | 'right'>('right');
    dropdownAlignment = signal<'left' | 'right'>('left');

    // Panel Fixed Positioning
    panelTop = signal<number>(0);
    panelLeft = signal<number>(0);
    panelWidth = signal<number>(0);
    openDirection = signal<'up' | 'down'>('down');

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
            this.calculatePanelPosition();
            window.addEventListener('scroll', this.closeOnScroll, true);
        } else {
            window.removeEventListener('scroll', this.closeOnScroll, true);
        }
        this.isOpen.update(v => !v);
    }

    private closeOnScroll = (event: Event) => {
        if (this.isOpen()) {
            // Only close if scrolling something other than our own dropdown panel
            const panel = this.elementRef.nativeElement.querySelector('.dropdown-panel');
            if (panel && panel.contains(event.target as Node)) {
                return;
            }
            this.isOpen.set(false);
            window.removeEventListener('scroll', this.closeOnScroll, true);
        }
    };

    private calculatePanelPosition() {
        const rect = this.elementRef.nativeElement.getBoundingClientRect();
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const panelMaxHeight = 250;
        
        // Alignment (Left/Right)
        if (screenWidth - rect.left < 300) {
            this.dropdownAlignment.set('right');
            this.panelLeft.set(rect.right);
        } else {
            this.dropdownAlignment.set('left');
            this.panelLeft.set(rect.left);
        }

        // Direction (Up/Down)
        const spaceBelow = screenHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        if (spaceBelow < panelMaxHeight && spaceAbove > spaceBelow) {
            this.openDirection.set('up');
            this.panelTop.set(rect.top - 2);
        } else {
            this.openDirection.set('down');
            this.panelTop.set(rect.bottom + 2);
        }

        this.panelWidth.set(Math.max(rect.width, 250));
    }

    selectOption(option: string) {
        this.selectedValue.set(option);
        this.onChange(option);
        this.onTouched();
        this.isOpen.set(false);
        window.removeEventListener('scroll', this.closeOnScroll, true);
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
