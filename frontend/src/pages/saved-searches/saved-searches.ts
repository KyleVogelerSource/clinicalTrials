import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ClinicalStudyService } from '../../services/clinical-study.service';
import { mapSavedSearchCriteriaToDesignModel } from '../../services/saved-search-criteria-mapper';
import { buildSavedSearchesExportJson, parseSavedSearchesImportJson } from '../../services/saved-search-file.service';
import {
  SavedSearchRecord,
  SavedSearchService,
  SavedSearchVisibility,
} from '../../services/saved-search.service';
import { TrialWorkflowService } from '../../services/trial-workflow-service';
import { ACTION_NAMES } from '@shared/auth/action-names';
import { PermissionService } from '../../services/permission.service';

@Component({
  selector: 'app-saved-searches',
  templateUrl: './saved-searches.html',
  styleUrl: './saved-searches.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavedSearches implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly clinicalStudyService = inject(ClinicalStudyService);
  private readonly savedSearchService = inject(SavedSearchService);
  private readonly workflowService = inject(TrialWorkflowService);
  private readonly router = inject(Router);
  private readonly permissionService = inject(PermissionService);

  protected readonly authorized = signal(false);
  protected readonly loading = signal(true);
  protected readonly mine = signal<SavedSearchRecord[]>([]);
  protected readonly sharedWithMe = signal<SavedSearchRecord[]>([]);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly visibilityMenuId = signal<number | null>(null);
  protected readonly visibilityUpdating = signal<number | null>(null);
  protected readonly deletePendingId = signal<number | null>(null);
  protected readonly importStatus = signal<'idle' | 'success' | 'error'>('idle');
  protected readonly importMessage = signal<string>('');
  protected readonly importPending = signal(false);
  protected readonly canImportCriteria = this.permissionService.watch(ACTION_NAMES.searchCriteriaImport);
  protected readonly canExportCriteria = this.permissionService.watch(ACTION_NAMES.searchCriteriaExport);

  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.loading.set(false);
      this.authorized.set(false);
      return;
    }
    this.authorized.set(true);
    this.loadAll();
  }

  private loadAll() {
    this.loading.set(true);
    this.savedSearchService.listMine().subscribe({
      next: (records) => {
        this.mine.set(records);
        this.loadShared();
      },
      error: () => {
        this.errorMessage.set('Failed to load your saved searches.');
        this.loading.set(false);
      },
    });
  }

  private loadShared() {
    this.savedSearchService.listSharedWithMe().subscribe({
      next: (records) => {
        this.sharedWithMe.set(records);
        this.loading.set(false);
      },
      error: () => {
        this.sharedWithMe.set([]);
        this.loading.set(false);
      },
    });
  }

  protected openInDashboard(record: SavedSearchRecord) {
    this.workflowService.setInputs(mapSavedSearchCriteriaToDesignModel(record.criteriaJson, {
      phase: this.clinicalStudyService.getDefaultPhase(),
      allocationType: this.clinicalStudyService.getDefaultAllocation(),
      interventionModels: this.clinicalStudyService.getInterventionModels(),
      blindingType: this.clinicalStudyService.getDefaultMaskingType(),
      blindingTypes: this.clinicalStudyService.getMaskingTypes(),
      sex: this.clinicalStudyService.getDefaultSex(),
      phases: this.clinicalStudyService.getPhases(),
      allocations: this.clinicalStudyService.getAllocations(),
      sexes: this.clinicalStudyService.getSexes(),
    }));
    this.router.navigate(['/']);
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString();
  }

  protected toggleVisibilityMenu(id: number): void {
    this.visibilityMenuId.set(this.visibilityMenuId() === id ? null : id);
  }

  protected setVisibility(record: SavedSearchRecord, visibility: SavedSearchVisibility): void {
    this.visibilityMenuId.set(null);
    if (record.visibility === visibility) return;
    this.visibilityUpdating.set(record.id);
    this.savedSearchService.update(record.id, {
      name: record.name,
      description: record.description,
      criteriaJson: record.criteriaJson,
      visibility,
    }).subscribe({
      next: (updated) => {
        this.mine.update(list => list.map(r => r.id === updated.id ? updated : r));
        this.visibilityUpdating.set(null);
      },
      error: () => {
        this.errorMessage.set('Failed to update visibility.');
        this.visibilityUpdating.set(null);
      },
    });
  }

  protected deleteSearch(record: SavedSearchRecord): void {
    const confirmed = globalThis.window?.confirm?.(`Delete saved search "${record.name}"?`) ?? false;
    if (!confirmed) return;

    this.visibilityMenuId.set(null);
    this.deletePendingId.set(record.id);
    this.errorMessage.set(null);

    this.savedSearchService.delete(record.id).subscribe({
      next: () => {
        this.mine.update(list => list.filter(r => r.id !== record.id));
        this.deletePendingId.set(null);
      },
      error: () => {
        this.errorMessage.set('Failed to delete saved search.');
        this.deletePendingId.set(null);
      },
    });
  }

  protected exportSearch(record: SavedSearchRecord): void {
    if (!this.canExportCriteria()) {
      return;
    }

    const content = buildSavedSearchesExportJson([record]);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${record.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'saved-search'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  protected async importSavedSearches(event: Event): Promise<void> {
    if (!this.canImportCriteria()) {
      return;
    }

    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;

    this.importPending.set(true);
    this.importStatus.set('idle');
    this.errorMessage.set(null);

    try {
      const searches = parseSavedSearchesImportJson(await file.text());
      const results = await Promise.allSettled(
        searches.map((search) => firstValueFrom(this.savedSearchService.create(search)))
      );

      const created = results.filter(result => result.status === 'fulfilled').length;
      const skipped = results.length - created;
      const duplicateSkips = results.filter(
        (result) => result.status === 'rejected' && (result.reason as { status?: number })?.status === 409
      ).length;

      this.importStatus.set(created > 0 ? 'success' : 'error');
      if (created === 0 && duplicateSkips === skipped && duplicateSkips > 0) {
        this.importMessage.set(
          duplicateSkips === 1
            ? 'Skipped 1 search because an equivalent saved search already exists.'
            : `Skipped ${duplicateSkips} searches because equivalent saved searches already exist.`
        );
      } else if (skipped > 0 && duplicateSkips > 0) {
        this.importMessage.set(
          `Imported ${created} saved search${created === 1 ? '' : 'es'}. Skipped ${skipped}, including ${duplicateSkips} duplicate${duplicateSkips === 1 ? '' : 's'}.`
        );
      } else {
        this.importMessage.set(
          skipped > 0
            ? `Imported ${created} saved search${created === 1 ? '' : 'es'}. Skipped ${skipped}.`
            : `Imported ${created} saved search${created === 1 ? '' : 'es'}.`
        );
      }

      this.loadAll();
    } catch {
      this.importStatus.set('error');
      this.importMessage.set('Could not import saved searches. Use a valid saved-search JSON export.');
    } finally {
      this.importPending.set(false);
      if (input) {
        input.value = '';
      }
    }
  }
}
