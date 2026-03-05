import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Study } from '../services/clinical-trials.service';

@Component({
  selector: 'app-results-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="results-container">
      <div class="results-header">
        <h2>📊 Results</h2>
        <div class="result-info">
          <span class="result-count" *ngIf="totalCount">
            {{ totalCount | number }} Total Results Found
          </span>
          <span class="page-info" *ngIf="studies.length > 0">
            Showing {{ studies.length }} results
          </span>
        </div>
      </div>

      <div class="loading-state" *ngIf="isLoading">
        <p>⏳ Fetching studies from Clinical Trials API...</p>
        <div class="progress-bar"></div>
      </div>

      <div class="error-state" *ngIf="error && !isLoading">
        <p>❌ Error: {{ error }}</p>
      </div>

      <div class="empty-state" *ngIf="!isLoading && !error && studies.length === 0">
        <p>🔍 Use the filters above to search for clinical trials</p>
      </div>

      <div class="table-wrapper" *ngIf="!isLoading && studies.length > 0">
        <table class="results-table">
          <thead>
            <tr>
              <th>NCT ID</th>
              <th>Trial Name</th>
              <th>Condition</th>
              <th>Status</th>
              <th>Phase</th>
              <th>Location</th>
              <th>Organization</th>
              <th>Enrollment</th>
              <th>Start Date</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let study of studies" class="study-row">
              <td class="nct-id">
                <code>{{ study.protocolSection.identificationModule.nctId }}</code>
              </td>
              <td class="trial-name">
                <strong>{{ study.protocolSection.identificationModule.briefTitle }}</strong>
              </td>
              <td class="condition">
                <span *ngFor="let cond of getConditions(study); let last = last">
                  {{ cond }}<span *ngIf="!last">, </span>
                </span>
              </td>
              <td class="status">
                <span [ngClass]="'status-' + (getStatus(study) | lowercase)">
                  {{ getStatus(study) }}
                </span>
              </td>
              <td class="phase">
                {{ getPhase(study) }}
              </td>
              <td class="location">
                {{ getLocation(study) }}
              </td>
              <td class="organization">
                {{ getOrganization(study) }}
              </td>
              <td class="enrollment">
                {{ getEnrollment(study) }}
              </td>
              <td class="date">
                {{ getStartDate(study) }}
              </td>
              <td class="actions">
                <button 
                  class="btn-details"
                  (click)="onViewDetails(study)"
                  title="View full study details"
                >
                  View →
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Controls -->
      <div class="pagination" *ngIf="studies.length > 0">
        <button 
          class="btn btn-nav"
          (click)="onPreviousPage()"
          [disabled]="!hasPreviousPage"
        >
          ← Previous
        </button>
        
        <span class="page-indicator">
          Page {{ currentPage }}
          <span *ngIf="hasNextPage">• More results available</span>
        </span>

        <button 
          class="btn btn-nav"
          (click)="onNextPage()"
          [disabled]="!hasNextPage"
        >
          Next →
        </button>
      </div>
    </div>
  `,
  styles: [`
    .results-container {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }

    .results-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #f0f0f0;
    }

    h2 {
      margin: 0;
      color: #333;
      font-size: 1.3rem;
    }

    .result-info {
      display: flex;
      gap: 20px;
      align-items: center;
      font-size: 0.9rem;
    }

    .result-count {
      color: #4CAF50;
      font-weight: 600;
    }

    .page-info {
      color: #666;
    }

    .loading-state {
      padding: 40px;
      text-align: center;
      color: #2196F3;
    }

    .progress-bar {
      height: 4px;
      background: linear-gradient(90deg, #2196F3, #4CAF50);
      border-radius: 2px;
      margin-top: 15px;
      animation: loading 1.5s infinite;
    }

    @keyframes loading {
      0% {
        width: 0;
      }
      50% {
        width: 100%;
      }
      100% {
        width: 0;
      }
    }

    .error-state {
      padding: 20px;
      background-color: #ffebee;
      border-left: 4px solid #f44336;
      border-radius: 4px;
      color: #c62828;
    }

    .empty-state {
      padding: 40px;
      text-align: center;
      color: #999;
      font-size: 1.1rem;
    }

    .table-wrapper {
      overflow-x: auto;
      margin-bottom: 20px;
    }

    .results-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    .results-table thead {
      background-color: #f9f9f9;
      border-bottom: 2px solid #ddd;
    }

    .results-table th {
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #555;
      white-space: nowrap;
    }

    .results-table td {
      padding: 12px;
      border-bottom: 1px solid #eee;
    }

    .study-row:hover {
      background-color: #f5f5f5;
    }

    .nct-id code {
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      color: #d32f2f;
      font-weight: 600;
    }

    .trial-name {
      font-weight: 500;
      max-width: 300px;
      white-space: normal;
    }

    .condition {
      color: #666;
      font-size: 0.85rem;
    }

    .status {
      padding: 4px 8px;
      border-radius: 3px;
      font-weight: 600;
      font-size: 0.8rem;
    }

    .status-recruiting {
      background-color: #e8f5e9;
      color: #2e7d32;
    }

    .status-completed {
      background-color: #e3f2fd;
      color: #1565c0;
    }

    .status-not_yet_recruiting {
      background-color: #fff3e0;
      color: #e65100;
    }

    .status-enrolling_by_invitation {
      background-color: #f3e5f5;
      color: #6a1b9a;
    }

    .phase {
      font-weight: 600;
      color: #333;
    }

    .location {
      font-size: 0.85rem;
      color: #666;
    }

    .organization {
      font-size: 0.85rem;
      color: #666;
    }

    .enrollment {
      text-align: center;
      font-weight: 600;
    }

    .date {
      font-size: 0.85rem;
      color: #999;
    }

    .actions {
      text-align: center;
    }

    .btn-details {
      background: #4CAF50;
      color: white;
      border: none;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 0.8rem;
      cursor: pointer;
      font-weight: 600;
      transition: background-color 0.2s;
    }

    .btn-details:hover {
      background-color: #45a049;
    }

    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 20px;
      padding: 20px;
      border-top: 1px solid #eee;
    }

    .page-indicator {
      color: #666;
      font-weight: 500;
    }

    .btn {
      padding: 8px 16px;
      border: 1px solid #ddd;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
    }

    .btn-nav:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-nav:not(:disabled):hover {
      background-color: #f0f0f0;
      border-color: #999;
    }

    @media (max-width: 1200px) {
      .trial-name {
        max-width: 200px;
      }
    }

    @media (max-width: 768px) {
      .results-table {
        font-size: 0.8rem;
      }

      .results-table th,
      .results-table td {
        padding: 8px;
      }

      .location,
      .organization,
      .date {
        display: none;
      }
    }
  `]
})
export class ResultsTableComponent implements OnChanges {
  @Input() studies: Study[] = [];
  @Input() totalCount: number | null = null;
  @Input() isLoading = false;
  @Input() error: string | null = null;
  @Input() nextPageToken: string | null = null;
  @Input() currentPage = 1;

  @Output() nextPageRequested = new EventEmitter<string>();
  @Output() previousPageRequested = new EventEmitter<void>();
  @Output() viewDetailsRequested = new EventEmitter<Study>();

  hasPreviousPage = false;
  hasNextPage = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nextPageToken']) {
      this.hasNextPage = !!this.nextPageToken;
    }
  }

  getConditions(study: Study): string[] {
    return study.protocolSection.conditionsModule?.conditions || ['N/A'];
  }

  getStatus(study: Study): string {
    return study.protocolSection.statusModule?.overallStatus || 'N/A';
  }

  getPhase(study: Study): string {
    const phases = study.protocolSection.designModule?.phase;
    return phases && phases.length > 0 ? phases[0] : 'N/A';
  }

  getLocation(study: Study): string {
    const locations = study.protocolSection.contactsLocationsModule?.locations;
    if (locations && locations.length > 0) {
      const loc = locations[0];
      return [loc.city, loc.state, loc.country].filter(Boolean).join(', ');
    }
    return 'N/A';
  }

  getOrganization(study: Study): string {
    return study.protocolSection.identificationModule.organization?.fullName || 'N/A';
  }

  getEnrollment(study: Study): string {
    const count = study.protocolSection.designModule?.enrollmentInfo?.count;
    return count ? count.toString() : 'N/A';
  }

  getStartDate(study: Study): string {
    return study.protocolSection.statusModule?.startDateStruct?.date || 'N/A';
  }

  onNextPage(): void {
    if (this.nextPageToken) {
      this.nextPageRequested.emit(this.nextPageToken);
      this.currentPage++;
    }
  }

  onPreviousPage(): void {
    if (this.hasPreviousPage) {
      this.previousPageRequested.emit();
      this.currentPage--;
    }
  }

  onViewDetails(study: Study): void {
    this.viewDetailsRequested.emit(study);
  }
}
