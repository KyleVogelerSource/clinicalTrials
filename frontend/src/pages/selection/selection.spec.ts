import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { TrialWorkflowService } from '../../services/trial-workflow-service';
import { vi } from 'vitest';
import { PermissionService } from '../../services/permission.service';

import { Selection } from './selection';

describe('Selection', () => {
  let component: Selection;
  let fixture: ComponentFixture<Selection>;
  let mockRouter: any;
  let mockWorkflowService: any;
  let mockAuthService: any;
  let mockPermissionService: any;
  let benchmarkPermission: WritableSignal<boolean>;
  let exportPermission: WritableSignal<boolean>;

  beforeEach(async () => {
    mockRouter = {
      navigate: vi.fn(),
    };
    mockWorkflowService = {
      inputParams: signal({
        condition: 'Type 2 Diabetes',
        phase: 'Phase 3',
        allocationType: 'Randomized',
        interventionModel: 'Parallel Assignment',
        blindingType: 'Double',
        minAge: 18,
        maxAge: 65,
        sex: 'Female',
        required: ['Hypertension'],
        ineligible: ['Heart Failure'],
      }),
      foundTrials: signal([
        {
          nctId: 'NCT00000001',
          briefTitle: 'A Study of New Treatment for Diabetes',
          conditions: ['Type 2 Diabetes'],
          enrollmentCount: 150,
          location: 'Boston, USA',
          startDate: '2023-01-01',
          completionDate: '2025-12-31',
          sponsor: 'PharmaCorp',
          phase: 'Phase 3',
          description: 'Mock summary',
          sites: ['Massachusetts General Hospital'],
        },
      ]),
      filterWords: signal([]),
      fromDate: signal(''),
      toDate: signal(''),
      importNotice: signal('Imported criteria from criteria.json.'),
      selectedTrialIds: signal([]),
      processResults: vi.fn(),
      setImportNotice: vi.fn(function (message: string | null) {
        mockWorkflowService.importNotice.set(message);
      }),
    };
    mockAuthService = {
      isLoggedIn: vi.fn().mockReturnValue(true),
    };
    benchmarkPermission = signal(true);
    exportPermission = signal(true);
    mockPermissionService = {
      watch: vi.fn((action: string) => {
        if (action === 'trial_benchmarking') {
          return benchmarkPermission.asReadonly();
        }
        if (action === 'search_criteria_export') {
          return exportPermission.asReadonly();
        }
        return signal(false).asReadonly();
      }),
    };

    await TestBed.configureTestingModule({
      imports: [Selection],
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: TrialWorkflowService, useValue: mockWorkflowService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: PermissionService, useValue: mockPermissionService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Selection);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('checks export and compare permissions on init', () => {
    expect(mockPermissionService.watch).toHaveBeenCalledWith('search_criteria_export');
    expect(mockPermissionService.watch).toHaveBeenCalledWith('trial_benchmarking');
  });

  it('shows the export button in the refine step', () => {
    const exportButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
    ).find(button => button.textContent?.trim() === 'Export');

    expect(exportButton).toBeTruthy();
  });

  it('shows the import confirmation banner in the refine step', () => {
    expect(fixture.nativeElement.textContent).toContain('Imported criteria from criteria.json.');
  });

  it('dismisses the import confirmation banner', () => {
    component.dismissImportNotice();
    fixture.detectChanges();

    expect(mockWorkflowService.setImportNotice).toHaveBeenCalledWith(null);
    expect(fixture.nativeElement.textContent).not.toContain('Imported criteria from criteria.json.');
  });

  it('exports the current workflow criteria as JSON', () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:criteria');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.fn();
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: clickSpy,
    } as unknown as HTMLAnchorElement);

    component.onExportCriteria();

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:criteria');

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    createElementSpy.mockRestore();
  });

  it('hides export when the user lacks export permission', async () => {
    exportPermission.set(false);

    fixture = TestBed.createComponent(Selection);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    const exportButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
    ).find(button => button.textContent?.trim() === 'Export');

    expect(exportButton).toBeUndefined();
  });

  it('does not export when there are no workflow criteria', () => {
    mockWorkflowService.inputParams.set(null);
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:criteria');

    component.onExportCriteria();

    expect(createObjectURLSpy).not.toHaveBeenCalled();
    createObjectURLSpy.mockRestore();
  });
});
