import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SavedSearches } from './saved-searches';
import { AuthService } from '../../services/auth.service';
import { ClinicalStudyService } from '../../services/clinical-study.service';
import { SavedSearchService } from '../../services/saved-search.service';
import { TrialWorkflowService } from '../../services/trial-workflow-service';
import { vi } from 'vitest';
import { PermissionService } from '../../services/permission.service';
import { signal, WritableSignal } from '@angular/core';

describe('SavedSearches', () => {
  let component: SavedSearches;
  let fixture: ComponentFixture<SavedSearches>;
  let mockAuthService: any;
  let mockClinicalStudyService: any;
  let mockSavedSearchService: any;
  let mockWorkflowService: any;
  let mockRouter: any;
  let createResponses: any[];
  let mockPermissionService: any;
  let importPermission: WritableSignal<boolean>;
  let exportPermission: WritableSignal<boolean>;

  beforeEach(async () => {
    createResponses = [];
    mockAuthService = {
      isLoggedIn: vi.fn().mockReturnValue(true),
    };
    importPermission = signal(true);
    exportPermission = signal(true);
    mockPermissionService = {
      watch: vi.fn((action: string) => {
        if (action === 'search_criteria_import') {
          return importPermission.asReadonly();
        }
        if (action === 'search_criteria_export') {
          return exportPermission.asReadonly();
        }
        return signal(false).asReadonly();
      }),
    };
    mockClinicalStudyService = {
      getDefaultPhase: vi.fn().mockReturnValue('Phase 1'),
      getPhases: vi.fn().mockReturnValue(['Phase 1', 'Phase 2', 'Phase 3']),
      getDefaultAllocation: vi.fn().mockReturnValue('N/A'),
      getAllocations: vi.fn().mockReturnValue(['N/A', 'Randomized']),
      getInterventionModels: vi.fn().mockReturnValue(['Single Group Assignment', 'Parallel Assignment']),
      getDefaultMaskingType: vi.fn().mockReturnValue('None (Open Label)'),
      getMaskingTypes: vi.fn().mockReturnValue(['None (Open Label)', 'Double']),
      getDefaultSex: vi.fn().mockReturnValue('All'),
      getSexes: vi.fn().mockReturnValue(['All', 'Female', 'Male']),
    };
    mockSavedSearchService = {
      listMine: vi.fn().mockReturnValue(of([])),
      listSharedWithMe: vi.fn().mockReturnValue(of([])),
      create: vi.fn((request) => {
        createResponses.push(request);
        return of({
          id: createResponses.length,
          ownerUserId: 1,
          ownerUsername: 'alice',
          createdAt: '2026-04-16T00:00:00.000Z',
          updatedAt: '2026-04-16T00:00:00.000Z',
          permissions: { isOwner: true, canView: true, canRun: true, canEdit: true },
          lastKnownCount: null,
          lastRunAt: null,
          ...request,
        });
      }),
      update: vi.fn(),
      delete: vi.fn().mockReturnValue(of(void 0)),
    };
    mockWorkflowService = {
      setInputs: vi.fn(),
    };
    mockRouter = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [SavedSearches],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: PermissionService, useValue: mockPermissionService },
        { provide: ClinicalStudyService, useValue: mockClinicalStudyService },
        { provide: SavedSearchService, useValue: mockSavedSearchService },
        { provide: TrialWorkflowService, useValue: mockWorkflowService },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SavedSearches);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('opens a saved search in dashboard with the full saved criteria', () => {
    component['openInDashboard']({
      id: 1,
      ownerUserId: 1,
      ownerUsername: 'alice',
      name: 'Phase 3 Diabetes',
      description: null,
      visibility: 'private',
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z',
      permissions: { isOwner: true, canView: true, canRun: true, canEdit: true },
      criteriaJson: {
        condition: 'Diabetes',
        phase: 'Phase 3',
        allocationType: 'Randomized',
        interventionModel: 'Parallel Assignment',
        blindingType: 'Double',
        minAge: 18,
        maxAge: 65,
        sex: 'Female',
      },
    });
expect(mockWorkflowService.setInputs).toHaveBeenCalledWith(expect.objectContaining({
  condition: 'Diabetes',
  phase: ['Phase 3'],
  allocationType: ['Randomized'],
  interventionModel: ['Parallel Assignment'],
  blindingType: ['Double'],
  minAge: 18,
  maxAge: 65,
}));
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
  });

  it('checks import and export permissions on init', () => {
    expect(mockPermissionService.watch).toHaveBeenCalledWith('search_criteria_import');
    expect(mockPermissionService.watch).toHaveBeenCalledWith('search_criteria_export');
  });

  it('shows the logged-out state without loading saved searches', () => {
    mockAuthService.isLoggedIn.mockReturnValue(false);
    mockSavedSearchService.listMine.mockClear();

    fixture = TestBed.createComponent(SavedSearches);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component['authorized']()).toBe(false);
    expect(component['loading']()).toBe(false);
    expect(mockSavedSearchService.listMine).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Please log in to view saved searches.');
  });

  it('shows an error when owned saved searches fail to load', () => {
    mockSavedSearchService.listMine.mockReturnValue(throwError(() => new Error('load failed')));

    fixture = TestBed.createComponent(SavedSearches);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component['loading']()).toBe(false);
    expect(component['errorMessage']()).toBe('Failed to load your saved searches.');
  });

  it('falls back to an empty shared list when shared saved searches fail to load', () => {
    mockSavedSearchService.listMine.mockReturnValue(of([]));
    mockSavedSearchService.listSharedWithMe.mockReturnValue(throwError(() => new Error('shared failed')));

    fixture = TestBed.createComponent(SavedSearches);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component['loading']()).toBe(false);
    expect(component['sharedWithMe']()).toEqual([]);
  });

  it('renders owned and shared saved-search cards with descriptions and counts', async () => {
    mockSavedSearchService.listMine.mockReturnValue(of([
      {
        id: 11,
        ownerUserId: 1,
        ownerUsername: 'alice',
        name: 'Owned Diabetes',
        description: 'Tracks recruiting phase 3 diabetes studies',
        visibility: 'shared',
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z',
        permissions: { isOwner: true, canView: true, canRun: true, canEdit: true },
        lastKnownCount: 14,
        lastRunAt: '2026-04-16T00:00:00.000Z',
        criteriaJson: { condition: 'Diabetes' },
      },
    ]));
    mockSavedSearchService.listSharedWithMe.mockReturnValue(of([
      {
        id: 12,
        ownerUserId: 2,
        ownerUsername: 'bob',
        name: 'Shared Asthma',
        description: 'Pulmonary studies from Bob',
        visibility: 'shared',
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z',
        permissions: { isOwner: false, canView: true, canRun: true, canEdit: false },
        lastKnownCount: null,
        lastRunAt: null,
        criteriaJson: { condition: 'Asthma' },
      },
    ]));

    fixture = TestBed.createComponent(SavedSearches);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Owned Diabetes (14)');
    expect(text).toContain('Tracks recruiting phase 3 diabetes studies');
    expect(text).toContain('Shared Asthma (0)');
    expect(text).toContain('Owner: bob');
    expect(text).toContain('Pulmonary studies from Bob');
    expect(text).not.toContain('No saved searches yet.');
    expect(text).not.toContain('No shared searches available.');
  });

  it('renders visibility menu options and pending delete text', async () => {
    component['mine'].set([
      {
        id: 13,
        ownerUserId: 1,
        ownerUsername: 'alice',
        name: 'Visibility Search',
        description: null,
        visibility: 'shared',
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z',
        permissions: { isOwner: true, canView: true, canRun: true, canEdit: true },
        lastKnownCount: null,
        lastRunAt: null,
        criteriaJson: { condition: 'Diabetes' },
      },
    ]);
    component['visibilityMenuId'].set(13);
    component['deletePendingId'].set(13);
    fixture.detectChanges();
    await fixture.whenStable();

    const menu = fixture.nativeElement.querySelector('.visibility-menu') as HTMLElement;
    const activeOption = fixture.nativeElement.querySelector('.visibility-menu .active') as HTMLElement;
    const deleteButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
    ).find(button => button.textContent?.includes('Deleting...'));

    expect(menu).not.toBeNull();
    expect(menu.textContent).toContain('Private');
    expect(menu.textContent).toContain('Shared');
    expect(activeOption.textContent).toContain('Shared');
    expect(deleteButton).toBeTruthy();
    expect(deleteButton?.disabled).toBe(true);
  });

  it('renders import success and error status messages', () => {
    component['importStatus'].set('success');
    component['importMessage'].set('Imported 1 saved search.');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Imported 1 saved search.');

    component['importStatus'].set('error');
    component['importMessage'].set('Could not import saved searches.');
    fixture.detectChanges();

    const message = fixture.nativeElement.querySelector('.state-message.error-message') as HTMLElement;
    expect(message.textContent).toContain('Could not import saved searches.');
  });

  it('falls back to dashboard defaults when older saved searches lack newer fields', () => {
    component['openInDashboard']({
      id: 2,
      ownerUserId: 1,
      ownerUsername: 'alice',
      name: 'Legacy Search',
      description: null,
      visibility: 'private',
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z',
      permissions: { isOwner: true, canView: true, canRun: true, canEdit: true },
      criteriaJson: {
        condition: 'Diabetes',
        phase: 'Phase 2',
      },
    });

    expect(mockWorkflowService.setInputs).toHaveBeenCalledWith(expect.objectContaining({
      condition: 'Diabetes',
      phase: ['Phase 2'],
      allocationType: [],
      blindingType: [],
    }));
  });

  it('maps normalized lowercase saved-search criteria to dashboard select values', () => {
    component['openInDashboard']({
      id: 6,
      ownerUserId: 1,
      ownerUsername: 'alice',
      name: 'Normalized Search',
      description: null,
      visibility: 'private',
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z',
      permissions: { isOwner: true, canView: true, canRun: true, canEdit: true },
      criteriaJson: {
        condition: 'diabetes type 2',
        phase: 'phase 3',
        allocationType: 'randomized',
        interventionModel: 'parallel assignment',
        blindingType: 'double',
        sex: 'female',
      },
    });
expect(mockWorkflowService.setInputs).toHaveBeenCalledWith(expect.objectContaining({
  condition: 'diabetes type 2',
  phase: ['Phase 3'],
  allocationType: ['Randomized'],
  interventionModel: ['Parallel Assignment'],
  blindingType: ['Double'],
  minAge: null,
  maxAge: null,
}));
  });

  it('deletes an owned saved search after confirmation', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    component['mine'].set([
      {
        id: 3,
        ownerUserId: 1,
        ownerUsername: 'alice',
        name: 'Delete Me',
        description: null,
        visibility: 'private',
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z',
        permissions: { isOwner: true, canView: true, canRun: true, canEdit: true },
        criteriaJson: { condition: 'Diabetes' },
      },
    ]);

    component['deleteSearch'](component['mine']()[0]);

    expect(mockSavedSearchService.delete).toHaveBeenCalledWith(3);
    expect(component['mine']()).toEqual([]);
    expect(component['deletePendingId']()).toBeNull();
    confirmSpy.mockRestore();
  });

  it('does not delete when confirmation is cancelled', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const record = {
      id: 4,
      ownerUserId: 1,
      ownerUsername: 'alice',
      name: 'Keep Me',
      description: null,
      visibility: 'private' as const,
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z',
      permissions: { isOwner: true, canView: true, canRun: true, canEdit: true },
      criteriaJson: { condition: 'Diabetes' },
    };

    component['deleteSearch'](record);

    expect(mockSavedSearchService.delete).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('shows an error when delete fails', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockSavedSearchService.delete.mockReturnValue(throwError(() => new Error('delete failed')));
    const record = {
      id: 5,
      ownerUserId: 1,
      ownerUsername: 'alice',
      name: 'Broken Delete',
      description: null,
      visibility: 'private' as const,
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z',
      permissions: { isOwner: true, canView: true, canRun: true, canEdit: true },
      criteriaJson: { condition: 'Diabetes' },
    };

    component['deleteSearch'](record);

    expect(component['errorMessage']()).toBe('Failed to delete saved search.');
    expect(component['deletePendingId']()).toBeNull();
    confirmSpy.mockRestore();
  });

  it('toggles visibility menu and skips no-op visibility updates', () => {
    const record = {
      id: 8,
      ownerUserId: 1,
      ownerUsername: 'alice',
      name: 'Private Search',
      description: null,
      visibility: 'private' as const,
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z',
      permissions: { isOwner: true, canView: true, canRun: true, canEdit: true },
      criteriaJson: { condition: 'Diabetes' },
    };

    component['toggleVisibilityMenu'](8);
    expect(component['visibilityMenuId']()).toBe(8);
    component['toggleVisibilityMenu'](8);
    expect(component['visibilityMenuId']()).toBeNull();

    component['setVisibility'](record, 'private');
    expect(mockSavedSearchService.update).not.toHaveBeenCalled();
  });

  it('updates visibility and handles update failures', () => {
    const record = {
      id: 9,
      ownerUserId: 1,
      ownerUsername: 'alice',
      name: 'Private Search',
      description: null,
      visibility: 'private' as const,
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z',
      permissions: { isOwner: true, canView: true, canRun: true, canEdit: true },
      criteriaJson: { condition: 'Diabetes' },
    };
    component['mine'].set([record]);
    mockSavedSearchService.update.mockReturnValueOnce(of({ ...record, visibility: 'shared' }));

    component['setVisibility'](record, 'shared');

    expect(mockSavedSearchService.update).toHaveBeenCalledWith(9, {
      name: 'Private Search',
      description: null,
      criteriaJson: { condition: 'Diabetes' },
      visibility: 'shared',
    });
    expect(component['mine']()[0].visibility).toBe('shared');
    expect(component['visibilityUpdating']()).toBeNull();

    mockSavedSearchService.update.mockReturnValueOnce(throwError(() => new Error('update failed')));
    component['setVisibility']({ ...record, id: 10 }, 'shared');

    expect(component['errorMessage']()).toBe('Failed to update visibility.');
    expect(component['visibilityUpdating']()).toBeNull();
  });

  it('exports an individual owned saved search as JSON', () => {
    const record = {
      id: 7,
      ownerUserId: 1,
      ownerUsername: 'alice',
      name: 'Export Me',
      description: 'saved',
      visibility: 'private' as const,
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z',
      permissions: { isOwner: true, canView: true, canRun: true, canEdit: true },
      criteriaJson: { condition: 'Diabetes' },
    };
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:saved');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.fn();
    const anchor = {
      href: '',
      download: '',
      click: clickSpy,
    } as unknown as HTMLAnchorElement;
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(anchor);

    component['exportSearch'](record);

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(anchor.download).toBe('export-me.json');
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:saved');
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    createElementSpy.mockRestore();
  });

  it('does not export when the user lacks export permission', () => {
    exportPermission.set(false);
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:saved');
    const record = {
      id: 7,
      ownerUserId: 1,
      ownerUsername: 'alice',
      name: 'Export Me',
      description: 'saved',
      visibility: 'private' as const,
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z',
      permissions: { isOwner: true, canView: true, canRun: true, canEdit: true },
      criteriaJson: { condition: 'Diabetes' },
    };

    component['exportSearch'](record);

    expect(createObjectURLSpy).not.toHaveBeenCalled();
    createObjectURLSpy.mockRestore();
  });

  it('hides the header import control when import permission is denied', async () => {
    importPermission.set(false);

    fixture = TestBed.createComponent(SavedSearches);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('label[for="savedSearchImport"]')).toBeNull();
  });

  it('hides per-record export controls when export permission is denied', async () => {
    exportPermission.set(false);
    mockSavedSearchService.listMine.mockReturnValue(of([
      {
        id: 7,
        ownerUserId: 1,
        ownerUsername: 'alice',
        name: 'Export Me',
        description: null,
        visibility: 'private',
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z',
        permissions: { isOwner: true, canView: true, canRun: true, canEdit: true },
        criteriaJson: { condition: 'Diabetes' },
      },
    ]));

    fixture = TestBed.createComponent(SavedSearches);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const exportButtons = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
    ).filter(button => button.textContent?.trim() === 'Export');

    expect(exportButtons).toHaveLength(0);
  });

  it('imports saved searches from JSON and creates new records', async () => {
    await component['importSavedSearches']({
      target: {
        files: [{
          name: 'saved-searches.json',
          text: vi.fn().mockResolvedValue(JSON.stringify({
            searches: [
              {
                name: 'Imported One',
                description: 'first',
                visibility: 'private',
                criteriaJson: { condition: 'Diabetes' },
              },
              {
                name: 'Imported Two',
                description: null,
                visibility: 'shared',
                criteriaJson: { condition: 'Hypertension' },
              },
            ],
          })),
        }],
        value: 'saved-searches.json',
      },
    } as unknown as Event);

    expect(mockSavedSearchService.create).toHaveBeenCalledTimes(2);
    expect(component['importStatus']()).toBe('success');
    expect(component['importMessage']()).toBe('Imported 2 saved searches.');
  });

  it('does not import when the user lacks import permission', async () => {
    importPermission.set(false);

    await component['importSavedSearches']({
      target: {
        files: [{
          name: 'saved-searches.json',
          text: vi.fn().mockResolvedValue(JSON.stringify({ searches: [] })),
        }],
        value: 'saved-searches.json',
      },
    } as unknown as Event);

    expect(mockSavedSearchService.create).not.toHaveBeenCalled();
  });

  it('imports a designer-criteria export as one new saved search', async () => {
    await component['importSavedSearches']({
      target: {
        files: [{
          name: 'criteria.json',
          text: vi.fn().mockResolvedValue(JSON.stringify({
            format: 'clinicaltrials-designer-criteria',
            version: 1,
            criteria: {
              condition: 'Diabetes Mellitus, Type 2',
              phase: 'Phase 1',
              allocationType: 'Randomized',
              interventionModel: 'Parallel Assignment',
              blindingType: 'Single',
              minAge: null,
              maxAge: null,
              sex: 'All',
              required: [],
              ineligible: [],
            },
          })),
        }],
        value: 'criteria.json',
      },
    } as unknown as Event);

    expect(mockSavedSearchService.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Diabetes Mellitus, Type 2 (Phase 1)',
      visibility: 'private',
      criteriaJson: expect.objectContaining({
        condition: 'Diabetes Mellitus, Type 2',
        phase: 'Phase 1',
        allocationType: 'Randomized',
        interventionModel: 'Parallel Assignment',
      }),
    }));
    expect(component['importStatus']()).toBe('success');
    expect(component['importMessage']()).toBe('Imported 1 saved search.');
  });

  it('shows an error when saved-search import file is invalid', async () => {
    await component['importSavedSearches']({
      target: {
        files: [{
          name: 'saved-searches.json',
          text: vi.fn().mockResolvedValue('{bad json'),
        }],
        value: 'saved-searches.json',
      },
    } as unknown as Event);

    expect(component['importStatus']()).toBe('error');
    expect(component['importMessage']()).toBe('Could not import saved searches. Use a valid saved-search JSON export.');
  });

  it('reports duplicate saved-search imports explicitly', async () => {
    mockSavedSearchService.create.mockReturnValue(throwError(() => ({ status: 409 })));

    await component['importSavedSearches']({
      target: {
        files: [{
          name: 'criteria.json',
          text: vi.fn().mockResolvedValue(JSON.stringify({
            format: 'clinicaltrials-designer-criteria',
            version: 1,
            criteria: {
              condition: 'Diabetes Mellitus, Type 2',
              phase: 'Phase 1',
            },
          })),
        }],
        value: 'criteria.json',
      },
    } as unknown as Event);

    expect(component['importStatus']()).toBe('error');
    expect(component['importMessage']()).toBe('Skipped 1 search because an equivalent saved search already exists.');
  });

  it('reports mixed successful, duplicate, and failed imports', async () => {
    mockSavedSearchService.create
      .mockReturnValueOnce(of({ id: 1 }))
      .mockReturnValueOnce(throwError(() => ({ status: 409 })))
      .mockReturnValueOnce(throwError(() => ({ status: 500 })));
    const target = {
      files: [{
        name: 'saved-searches.json',
        text: vi.fn().mockResolvedValue(JSON.stringify({
          searches: [
            { name: 'Imported One', description: null, visibility: 'private', criteriaJson: { condition: 'Diabetes' } },
            { name: 'Duplicate One', description: null, visibility: 'private', criteriaJson: { condition: 'Diabetes' } },
            { name: 'Broken One', description: null, visibility: 'private', criteriaJson: { condition: 'Asthma' } },
          ],
        })),
      }],
      value: 'saved-searches.json',
    };

    await component['importSavedSearches']({ target } as unknown as Event);

    expect(component['importStatus']()).toBe('success');
    expect(component['importMessage']()).toBe('Imported 1 saved search. Skipped 2, including 1 duplicate.');
    expect(component['importPending']()).toBe(false);
    expect(target.value).toBe('');
  });
});
