import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ClinicalTrialsService, StudySearchParams, EnumValues } from '../services/clinical-trials.service';

@Component({
  selector: 'app-search-filters',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="filters-container">
      <h2>🔍 Search Filters</h2>
      
      <form [formGroup]="filterForm" (ngSubmit)="onSearch()">
        <!-- Condition/Disease Filter -->
        <div class="filter-section">
          <label>Disease / Condition</label>
          <input 
            type="text" 
            formControlName="condition"
            placeholder="e.g., diabetes, cancer, asthma"
            class="input-field"
          />
        </div>

        <!-- Intervention Filter -->
        <div class="filter-section">
          <label>Intervention / Treatment</label>
          <input 
            type="text" 
            formControlName="intervention"
            placeholder="e.g., vaccine, drug, surgery"
            class="input-field"
          />
        </div>

        <!-- Sponsor Filter -->
        <div class="filter-section">
          <label>Sponsor / Organization</label>
          <input 
            type="text" 
            formControlName="sponsor"
            placeholder="e.g., NIH, FDA, Hospital Name"
            class="input-field"
          />
        </div>

        <!-- Study Status Filter -->
        <div class="filter-row">
          <div class="filter-section">
            <label>Status</label>
            <select formControlName="overallStatus" class="input-field">
              <option value="">All Statuses</option>
              <option *ngFor="let status of statusOptions" [value]="status">
                {{ status }}
              </option>
            </select>
          </div>

          <!-- Phase Filter -->
          <div class="filter-section">
            <label>Phase</label>
            <select formControlName="phase" class="input-field">
              <option value="">All Phases</option>
              <option *ngFor="let phase of phaseOptions" [value]="phase">
                {{ phase }}
              </option>
            </select>
          </div>
        </div>

        <!-- Age Range Filters - DISABLED: Not supported by ClinicalTrials.gov API v2 -->
        <div class="filter-row disabled-section">
          <div class="filter-section">
            <label title="Age filters not currently supported by ClinicalTrials.gov API v2">Min Age <span class="not-supported">(not yet supported)</span></label>
            <input 
              type="number" 
              formControlName="minAge"
              placeholder="e.g., 18"
              class="input-field"
              [disabled]="true"
            />
          </div>

          <div class="filter-section">
            <label title="Age filters not currently supported by ClinicalTrials.gov API v2">Max Age <span class="not-supported">(not yet supported)</span></label>
            <input 
              type="number" 
              formControlName="maxAge"
              placeholder="e.g., 65"
              class="input-field"
              [disabled]="true"
            />
          </div>
        </div>

        <!-- Sex/Gender Filter - DISABLED: Not supported by ClinicalTrials.gov API v2 -->
        <div class="filter-section disabled-section">
          <label title="Sex/Gender filter not currently supported by ClinicalTrials.gov API v2">Sex/Gender <span class="not-supported">(not yet supported)</span></label>
          <select formControlName="sex" class="input-field" [disabled]="true">
            <option value="">All</option>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
          </select>
        </div>

        <!-- Study Type Filter - DISABLED: Not supported by ClinicalTrials.gov API v2 -->
        <div class="filter-section disabled-section">
          <label title="Study Type filter not currently supported by ClinicalTrials.gov API v2">Study Type <span class="not-supported">(not yet supported)</span></label>
          <select formControlName="studyType" class="input-field" [disabled]="true">
            <option value="">All Types</option>
            <option value="INTERVENTIONAL">Interventional</option>
            <option value="OBSERVATIONAL">Observational</option>
            <option value="EXPANDED_ACCESS">Expanded Access</option>
          </select>
        </div>

        <!-- Healthy Volunteers -->
        <div class="filter-section">
          <label>
            <input 
              type="checkbox" 
              formControlName="healthyVolunteers"
            />
            Accepts Healthy Volunteers
          </label>
        </div>

        <!-- Page Size -->
        <div class="filter-section">
          <label>Results Per Page</label>
          <select formControlName="pageSize" class="input-field">
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>

        <!-- Action Buttons -->
        <div class="button-group">
          <button type="submit" class="btn btn-primary">🔍 Search</button>
          <button type="button" (click)="onClear()" class="btn btn-secondary">↻ Clear</button>
        </div>
      </form>

      <div class="filter-info">
        <p *ngIf="isLoading" class="loading">⏳ Loading...</p>
        <p *ngIf="error" class="error">❌ {{ error }}</p>
      </div>
    </div>
  `,
  styles: [`
    .filters-container {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }

    h2 {
      margin-top: 0;
      color: #333;
      font-size: 1.3rem;
    }

    form {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .filter-section {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .filter-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }

    label {
      font-weight: 600;
      color: #555;
      font-size: 0.9rem;
    }

    .input-field {
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 0.95rem;
      font-family: inherit;
      transition: border-color 0.2s;
    }

    .input-field:focus {
      outline: none;
      border-color: #4CAF50;
      box-shadow: 0 0 5px rgba(76, 175, 80, 0.2);
    }

    .button-group {
      display: flex;
      gap: 10px;
      margin-top: 10px;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .btn-primary {
      background-color: #4CAF50;
      color: white;
    }

    .btn-primary:hover {
      background-color: #45a049;
    }

    .btn-secondary {
      background-color: #f0f0f0;
      color: #333;
      border: 1px solid #ddd;
    }

    .btn-secondary:hover {
      background-color: #e0e0e0;
    }

    .filter-info {
      margin-top: 15px;
      padding: 10px;
      border-radius: 4px;
      min-height: 20px;
    }

    .loading {
      color: #2196F3;
      margin: 0;
      font-weight: 600;
    }

    .error {
      color: #f44336;
      margin: 0;
      font-weight: 600;
    }

    .disabled-section {
      opacity: 0.6;
      pointer-events: none;
    }

    .not-supported {
      color: #ff6b6b;
      font-size: 0.8rem;
      font-weight: normal;
    }

    @media (max-width: 768px) {
      .filter-row {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class SearchFiltersComponent implements OnInit {
  @Output() searchRequested = new EventEmitter<any>();
  @Output() parametersPrepared = new EventEmitter<any>();

  filterForm!: FormGroup;
  isLoading = false;
  error: string | null = null;

  statusOptions: string[] = [];
  phaseOptions: string[] = [];

  constructor(
    private fb: FormBuilder,
    private trialsService: ClinicalTrialsService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadEnumValues();
  }

  private initializeForm(): void {
    this.filterForm = this.fb.group({
      condition: [''],
      intervention: [''],
      sponsor: [''],
      overallStatus: [''],
      phase: [''],
      minAge: [null],
      maxAge: [null],
      sex: [''],
      studyType: [''],
      healthyVolunteers: [false],
      pageSize: [20]
    });
  }

  private loadEnumValues(): void {
    this.trialsService.getEnumValues().subscribe({
      next: (enums: any) => {
        this.statusOptions = enums?.Status || [];
        this.phaseOptions = enums?.Phase || [];
      },
      error: (err) => {
        console.error('Error loading enums:', err);
        // Set default values if API fails
        this.statusOptions = ['RECRUITING', 'COMPLETED', 'NOT_YET_RECRUITING', 'ENROLLING_BY_INVITATION'];
        this.phaseOptions = ['PHASE1', 'PHASE2', 'PHASE3', 'PHASE4', 'NA'];
      }
    });
  }

  onSearch(): void {
    this.isLoading = true;
    this.error = null;

    // Build search parameters, excluding empty values
    const params: StudySearchParams = {};
    const formValue = this.filterForm.value;

    Object.keys(formValue).forEach(key => {
      const value = formValue[key];
      if (value !== null && value !== '' && value !== false) {
        (params as any)[key] = value;
      }
    });

    this.parametersPrepared.emit(params);
    this.searchRequested.emit(params);

    console.log('Search Parameters:', params);
  }

  onClear(): void {
    this.filterForm.reset({
      healthyVolunteers: false,
      pageSize: 20
    });
    this.error = null;
  }
}
