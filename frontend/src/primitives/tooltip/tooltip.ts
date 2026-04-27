import { Component, ChangeDetectionStrategy, input, signal, ElementRef, inject, OnDestroy } from '@angular/core';

@Component({
    selector: 'app-tooltip',
    standalone: true,
    templateUrl: './tooltip.html',
    styleUrl: './tooltip.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class Tooltip implements OnDestroy {
    text = input.required<string>();

    isVisible = signal(false);
    isDownward = signal(false);
    tooltipTop = signal(0);
    tooltipLeft = signal(0);

    elementRef = inject(ElementRef);

    ngOnDestroy() {
        window.removeEventListener('scroll', this.hideTooltip, true);
    }

    showTooltip() {
        const icon = this.elementRef.nativeElement.querySelector('.help-icon');
        const rect = icon.getBoundingClientRect();
        
        const spaceAbove = rect.top;
        const tooltipHeight = 60; // Approximate
        
        if (spaceAbove < tooltipHeight + 20) {
            // Show below
            this.tooltipTop.set(rect.bottom + 8);
            this.tooltipLeft.set(rect.left + rect.width / 2);
            this.isDownward.set(true);
        } else {
            // Show above
            this.tooltipTop.set(rect.top - 8);
            this.tooltipLeft.set(rect.left + rect.width / 2);
            this.isDownward.set(false);
        }
        
        this.isVisible.set(true);
        window.addEventListener('scroll', this.hideTooltip, true);
    }

    hideTooltip = () => {
        this.isVisible.set(false);
        window.removeEventListener('scroll', this.hideTooltip, true);
    }
}
