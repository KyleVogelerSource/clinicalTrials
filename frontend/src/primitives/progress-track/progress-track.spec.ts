import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProgressTrack } from './progress-track';

describe('ProgressTrack', () => {
  let component: ProgressTrack;
  let fixture: ComponentFixture<ProgressTrack>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProgressTrack],
    }).compileComponents();

    fixture = TestBed.createComponent(ProgressTrack);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
