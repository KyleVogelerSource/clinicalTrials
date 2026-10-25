import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { LoadingIndicator } from './loading-indicator';

describe('LoadingIndicator', () => {
  let fixture: ComponentFixture<LoadingIndicator>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadingIndicator],
    }).compileComponents();

    fixture = TestBed.createComponent(LoadingIndicator);
  });

  it('does not render the loading container when hidden', () => {
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.loading-container')).toBeNull();
  });

  it('renders the spinner and message when visible with a message', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('message', 'Loading benchmark results');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.spinner')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.loading-message')?.textContent.trim()).toBe(
      'Loading benchmark results'
    );
  });

  it('renders only the spinner when visible without a message', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('message', null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.spinner')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.loading-message')).toBeNull();
  });
});
