import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchFiltersComponent } from '../components/search-filters.component';
import { ResultsTableComponent } from '../components/results-table.component';
import { ClinicalTrialsService, StudySearchParams, Study, StudiesResponse } from '../services/clinical-trials.service';

@Component({
  selector: 'app-clinical-trials-search',
  standalone: true,
  imports: [CommonModule, SearchFiltersComponent, ResultsTableComponent],
  template: `
    <div class="search-page">
      <!-- Header -->
      <header class="page-header">
        <h1>🏥 Clinical Trials Search</h1>
        <p class="subtitle">Powered by ClinicalTrials.gov API v2</p>
      </header>

      <!-- Main Content -->
      <main class="page-content">
        <div class="workflow-container">
          <!-- Step 1: Input -->
          <div class="workflow-step" [class.active]="currentStep === 'input'">
            <div class="step-indicator">1</div>
            <div class="step-label">Input</div>
          </div>

          <!-- Step 2: Refine -->
          <div class="workflow-line"></div>
          <div class="workflow-step" [class.active]="currentStep === 'refine'">
            <div class="step-indicator">2</div>
            <div class="step-label">Refine</div>
          </div>

          <!-- Step 3: Results -->
          <div class="workflow-line"></div>
          <div class="workflow-step" [class.active]="currentStep === 'results'">
            <div class="step-indicator">3</div>
            <div class="step-label">Results</div>
          </div>
        </div>

        <!-- Search Filters Panel -->
        <app-search-filters
          (searchRequested)="onSearchRequested($event)"
          (parametersPrepared)="onParametersPrepared($event)"
        ></app-search-filters>

        <!-- Results Panel -->
        <app-results-table
          [studies]="studies"
          [totalCount]="totalCount"
          [isLoading]="isLoading"
          [error]="error"
          [nextPageToken]="nextPageToken"
          [currentPage]="currentPage"
          (nextPageRequested)="onNextPage($event)"
          (previousPageRequested)="onPreviousPage()"
          (viewDetailsRequested)="onViewDetails($event)"
        ></app-results-table>

        <!-- Debug Info (Optional) -->
        <div class="debug-info" *ngIf="showDebugInfo">
          <h3>🔧 Last API Request</h3>
          <pre>{{ lastSearchParams | json }}</pre>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .search-page {
      min-height: 100vh;
      background: linear-gradient(135deg, #f5f7fa 0%, #e9eef5 100%);
      padding: 20px;
    }

    .page-header {
      text-align: center;
      margin-bottom: 40px;
      color: #333;
    }

    .page-header h1 {
      font-size: 2.5rem;
      margin: 20px 0 10px;
      color: #2c3e50;
    }

    .subtitle {
      font-size: 1.1rem;
      color: #7f8c8d;
      margin: 0;
    }

    .page-content {
      max-width: 1400px;
      margin: 0 auto;
    }

    .workflow-container {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 40px;
      padding: 30px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .workflow-step {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 100px;
      position: relative;
    }

    .step-indicator {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: #f0f0f0;
      border: 3px solid #ddd;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 1.2rem;
      color: #666;
      margin-bottom: 10px;
      transition: all 0.3s;
    }

    .workflow-step.active .step-indicator {
      background: #4CAF50;
      border-color: #4CAF50;
      color: white;
      box-shadow: 0 0 10px rgba(76, 175, 80, 0.3);
    }

    .step-label {
      font-weight: 600;
      color: #555;
      font-size: 0.9rem;
    }

    .workflow-line {
      width: 40px;
      height: 3px;
      background: #ddd;
      margin: 0 10px;
      border-radius: 2px;
    }

    .debug-info {
      margin-top: 30px;
      padding: 20px;
      background: #f9f9f9;
      border: 1px solid #ddd;
      border-radius: 4px;
      border-left: 4px solid #2196F3;
    }

    .debug-info h3 {
      margin-top: 0;
      color: #2196F3;
    }

    .debug-info pre {
      background: white;
      padding: 12px;
      border-radius: 4px;
      border: 1px solid #eee;
      overflow-x: auto;
      font-size: 0.85rem;
      line-height: 1.4;
    }

    @media (max-width: 768px) {
      .workflow-container {
        flex-wrap: wrap;
        gap: 15px;
      }

      .workflow-line {
        width: 3px;
        height: 30px;
        margin: 0;
      }

      .page-header h1 {
        font-size: 1.8rem;
      }
    }
  `]
})
export class ClinicalTrialsSearchComponent implements OnInit {
  // UI State
  isLoading = false;
  error: string | null = null;
  showDebugInfo = true;
  currentStep: 'input' | 'refine' | 'results' = 'input';

  // Search Results
  studies: Study[] = [];
  totalCount: number | null = null;
  nextPageToken: string | null = null;
  currentPage = 1;
  pageSize = 20;

  // API Request Tracking
  lastSearchParams: StudySearchParams | null = null;
  pageTokenStack: string[] = [];

  constructor(private trialsService: ClinicalTrialsService) {}

  ngOnInit(): void {
    console.log('Clinical Trials Search Component Initialized');
    console.log('API Base URL: http://localhost:3001/api');
  }

  /**
   * Handle search request from filter component
   */
  onSearchRequested(params: StudySearchParams): void {
    console.log('🔍 Search Requested with params:', params);
    this.currentStep = 'results';  // Move to results step
    this.isLoading = true;
    this.error = null;
    this.studies = [];
    this.currentPage = 1;
    this.pageTokenStack = [];
    this.nextPageToken = null;

    // Ensure pageSize is set
    const searchParams = { ...params, pageSize: params.pageSize || this.pageSize };
    this.lastSearchParams = searchParams;

    this.trialsService.searchStudies(searchParams).subscribe({
      next: (response: StudiesResponse) => {
        console.log('✅ API Response Received:', response);
        this.studies = response.studies;
        this.nextPageToken = response.nextPageToken || null;
        this.totalCount = response.totalCount || null;
        this.isLoading = false;

        console.log(`📊 Found ${this.studies.length} studies${this.totalCount ? ` (${this.totalCount} total)` : ''}`);

        if (this.studies.length === 0) {
          console.warn('⚠️ No studies found matching criteria');
        }
      },
      error: (err) => {
        console.error('❌ API Error:', err);
        this.isLoading = false;
        this.error = err.error?.error || err.message || 'Failed to fetch studies. Please check the backend is running on http://localhost:3001';
      }
    });
  }

  /**
   * Called when filters are prepared (before API call)
   */
  onParametersPrepared(params: StudySearchParams): void {
    console.log('📋 Search Parameters Prepared:', params);
    this.currentStep = 'refine';  // Move to refine step when adjusting filters
  }

  /**
   * Handle next page navigation
   */
  onNextPage(pageToken: string): void {
    console.log('➡️ Loading next page with token:', pageToken);
    
    if (this.lastSearchParams) {
      const nextParams = { ...this.lastSearchParams, pageToken, pageSize: this.pageSize };
      
      this.isLoading = true;
      this.error = null;
      this.pageTokenStack.push(pageToken);

      this.trialsService.searchStudies(nextParams).subscribe({
        next: (response: StudiesResponse) => {
          console.log('✅ Next Page Response Received:', response);
          this.studies = response.studies;
          this.nextPageToken = response.nextPageToken || null;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('❌ Error loading next page:', err);
          this.isLoading = false;
          this.error = 'Failed to load next page';
        }
      });
    }
  }

  /**
   * Handle previous page navigation
   */
  onPreviousPage(): void {
    console.log('⬅️ Loading previous page');
    this.pageTokenStack.pop();
    
    if (this.lastSearchParams) {
      const prevToken = this.pageTokenStack[this.pageTokenStack.length - 1];
      const prevParams = prevToken 
        ? { ...this.lastSearchParams, pageToken: prevToken, pageSize: this.pageSize }
        : { ...this.lastSearchParams, pageSize: this.pageSize };

      this.isLoading = true;
      this.error = null;

      this.trialsService.searchStudies(prevParams).subscribe({
        next: (response: StudiesResponse) => {
          console.log('✅ Previous Page Response Received:', response);
          this.studies = response.studies;
          this.nextPageToken = response.nextPageToken || null;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('❌ Error loading previous page:', err);
          this.isLoading = false;
          this.error = 'Failed to load previous page';
        }
      });
    }

    this.currentPage--;
  }

  /**
   * Handle viewing details of a specific study
   */
  onViewDetails(study: Study): void {
    const nctId = study.protocolSection.identificationModule.nctId;
    console.log(`📖 Viewing details for study: ${nctId}`);

    this.trialsService.getStudyById(nctId).subscribe({
      next: (fullStudy) => {
        console.log('✅ Full Study Details Retrieved:', fullStudy);
        // Could open modal or navigate to detail page
        alert(`Study Details for ${nctId}\n\n${JSON.stringify(fullStudy, null, 2)}`);
      },
      error: (err) => {
        console.error('❌ Error fetching study details:', err);
        this.error = `Failed to load details for ${nctId}`;
      }
    });
  }
}
