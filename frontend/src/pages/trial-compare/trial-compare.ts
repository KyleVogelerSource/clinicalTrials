import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { TrialWorkflowService } from '../../services/trial-workflow-service';
import { DebugMessageService } from '../../services/debug-message.service';
import { TrialCompareResponse, TrialCompareService } from '../../services/trial-compare.service';

@Component({
  selector: 'app-trial-compare',
  templateUrl: './trial-compare.html',
  styleUrl: './trial-compare.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrialCompare implements OnInit {
  private readonly workflowService = inject(TrialWorkflowService);
  private readonly compareService = inject(TrialCompareService);
  private readonly debugMessageService = inject(DebugMessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly compareData = signal<TrialCompareResponse | null>(null);

  protected readonly selectedIds = this.workflowService.selectedTrialIds;
  protected readonly selectedCount = computed(() => this.selectedIds().length);

  constructor() {
    this.debugMessageService.clear();
    this.destroyRef.onDestroy(() => this.debugMessageService.clear());
  }

  ngOnInit() {
    const ids = this.selectedIds();
    if (ids.length < 2 || ids.length > 5) {
      this.loading.set(false);
      this.errorMessage.set('Select 2 to 5 trials on the Dashboard before running comparison.');
      this.debugMessageService.clear();
      return;
    }

    this.compareService.compareTrials({
      trials: ids.map((nctId) => ({ nctId })),
    }).subscribe({
      next: (response) => {
        this.compareData.set(response);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        const debugMessage = error instanceof HttpErrorResponse
          ? (typeof error.error?.message === 'string' ? error.error.message : error.message)
          : 'Unable to compare selected trials right now.';

        this.debugMessageService.setMessage(`Compare failed: ${debugMessage}`);
        this.errorMessage.set('Comparison could not be loaded.');
        this.loading.set(false);
      },
    });
  }

  protected backToDashboard() {
    this.router.navigate(['/']);
  }

  protected toPercent(score: number): number {
    return Math.round(score);
  }

  protected labelForNctId(nctId: string): string {
    const trial = this.compareData()?.normalizedTrials.find((t) => t.nctId === nctId);
    return trial ? `${trial.briefTitle} (${nctId})` : nctId;
  }
}
