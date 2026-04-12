import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import {
  SavedSearchRecord,
  SavedSearchService,
  SavedSearchVisibility,
} from '../../services/saved-search.service';
import { TrialWorkflowService } from '../../services/trial-workflow-service';

@Component({
  selector: 'app-saved-searches',
  templateUrl: './saved-searches.html',
  styleUrl: './saved-searches.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavedSearches implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly savedSearchService = inject(SavedSearchService);
  private readonly workflowService = inject(TrialWorkflowService);
  private readonly router = inject(Router);

  protected readonly authorized = signal(false);
  protected readonly loading = signal(true);
  protected readonly mine = signal<SavedSearchRecord[]>([]);
  protected readonly sharedWithMe = signal<SavedSearchRecord[]>([]);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly visibilityMenuId = signal<number | null>(null);
  protected readonly visibilityUpdating = signal<number | null>(null);

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

  protected openInDesigner(record: SavedSearchRecord) {
    const criteria = record.criteriaJson;
    this.workflowService.setInputs({
      condition: criteria.condition ?? '',
      phase: criteria.phase ?? '',
      allocationType: '',
      interventionModel: criteria.interventionModel ?? null,
      blindingType: '',
      minAge: criteria.minAge ?? null,
      maxAge: criteria.maxAge ?? null,
      sex: criteria.sex ?? '',
      required: criteria.requiredConditions ?? [],
      ineligible: criteria.ineligibleConditions ?? [],
    });
    this.router.navigate(['/designer']);
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
}
