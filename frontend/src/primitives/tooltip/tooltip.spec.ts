import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Tooltip } from './tooltip';

describe('Tooltip', () => {
    let fixture: ComponentFixture<Tooltip>;
    let component: Tooltip;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [Tooltip],
        }).compileComponents();

        fixture = TestBed.createComponent(Tooltip);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('text', 'Test Tooltip');
        fixture.detectChanges();
    });

    it('should be created', () => {
        expect(component).toBeTruthy();
    });

    it('should show tooltip on showTooltip call and calculate position', () => {
        const icon = fixture.nativeElement.querySelector('.help-icon');
        vi.spyOn(icon, 'getBoundingClientRect').mockReturnValue({
            top: 100,
            left: 100,
            width: 20,
            height: 20,
            bottom: 120,
            right: 120
        } as DOMRect);

        expect(component.isVisible()).toBe(false);
        component.showTooltip();
        expect(component.isVisible()).toBe(true);
        expect(component.tooltipTop()).toBe(92); // 100 - 8
        expect(component.tooltipLeft()).toBe(110); // 100 + 20/2
    });

    it('should hide tooltip on hideTooltip call', () => {
        component.showTooltip();
        expect(component.isVisible()).toBe(true);
        component.hideTooltip();
        expect(component.isVisible()).toBe(false);
    });
});
