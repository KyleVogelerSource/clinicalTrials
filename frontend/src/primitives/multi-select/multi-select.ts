import { Component, ChangeDetectionStrategy, input, ElementRef, inject, signal, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface MultiSelectOption {
    label: string;
    value: string;
    class?: string;
}

@Component({
    selector: 'app-multi-select',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './multi-select.html',
    styleUrl: './multi-select.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => MultiSelect),
            multi: true
        }
    ],
    host: {
        '(document:click)': 'onDocumentClick($event)'
    }
})
export class MultiSelect implements ControlValueAccessor {
    inputId = input<string>('');
    options = input.required<MultiSelectOption[]>();
    placeholder = input<string>('Select options...');
    width = input<string>('100%');

    elementRef = inject(ElementRef);
    
    selectedValues = signal<string[]>([]);
    isOpen = signal(false);
    dropdownAlignment = signal<'left' | 'right'>('left');

    // Panel Fixed Positioning
    panelTop = signal<number>(0);
    panelLeft = signal<number>(0);
    panelWidth = signal<number>(0);
    openDirection = signal<'up' | 'down'>('down');

    // ControlValueAccessor methods
    onChange: any = () => {};
    onTouched: any = () => {};

    writeValue(value: string[] | null): void {
        this.selectedValues.set(value || []);
    }

    registerOnChange(fn: any): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: any): void {
        this.onTouched = fn;
    }

    toggleDropdown() {
        if (!this.isOpen()) {
            this.calculatePanelPosition();
            // Use setTimeout to avoid capturing the scroll event that might be triggered by 
            // the click itself (e.g. if the browser or test tool auto-scrolls to the element)
            setTimeout(() => {
                if (this.isOpen()) {
                    window.addEventListener('scroll', this.closeOnScroll, true);
                }
            }, 0);
        } else {
            window.removeEventListener('scroll', this.closeOnScroll, true);
        }
        this.isOpen.update(v => !v);
    }

    private closeOnScroll = (event: Event) => {
        if (this.isOpen()) {
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
        
        if (screenWidth - rect.left < 250) {
            this.dropdownAlignment.set('right');
            this.panelLeft.set(rect.right);
        } else {
            this.dropdownAlignment.set('left');
            this.panelLeft.set(rect.left);
        }

        const spaceBelow = screenHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        if (spaceBelow < panelMaxHeight && spaceAbove > spaceBelow) {
            this.openDirection.set('up');
            this.panelTop.set(rect.top - 2);
        } else {
            this.openDirection.set('down');
            this.panelTop.set(rect.bottom + 2);
        }

        this.panelWidth.set(Math.max(rect.width, 200));
    }

    toggleOption(value: string, event: Event) {
        // Prevent event from bubbling if it came from the checkbox change
        if (event.type === 'change') {
            event.stopPropagation();
        }

        const current = this.selectedValues();
        let next: string[];
        
        if (current.includes(value)) {
            next = current.filter(v => v !== value);
        } else {
            next = [...current, value];
        }
        
        this.selectedValues.set(next);
        this.onChange(next);
        this.onTouched();
    }

    isSelected(value: string): boolean {
        return this.selectedValues().includes(value);
    }

    getTriggerText(): string {
        const count = this.selectedValues().length;
        if (count === 0) return this.placeholder();
        if (count === 1) {
            const val = this.selectedValues()[0];
            const opt = this.options().find(o => o.value === val);
            return opt ? opt.label : this.placeholder();
        }
        return `${this.placeholder()} (${count})`;
    }

    onDocumentClick(event: MouseEvent) {
        if (!this.elementRef.nativeElement.contains(event.target)) {
            this.isOpen.set(false);
        }
    }
}
