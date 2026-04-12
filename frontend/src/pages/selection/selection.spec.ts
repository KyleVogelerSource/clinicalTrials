import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../services/auth.service';

import { Selection } from './selection';

describe('Selection', () => {
  let component: Selection;
  let fixture: ComponentFixture<Selection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Selection],
      providers: [
        {
          provide: AuthService,
          useValue: {
            isLoggedIn: () => true,
            hasAction: () => of(true),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Selection);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
