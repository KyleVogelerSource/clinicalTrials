import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface StudySearchParams {
  condition?: string;
  intervention?: string;
  sponsor?: string;
  overallStatus?: string;
  studyType?: string;
  phase?: string;
  sex?: string;
  minAge?: number;
  maxAge?: number;
  healthyVolunteers?: boolean;
  pageSize?: number;
  pageToken?: string;
}

export interface Study {
  protocolSection: {
    identificationModule: {
      nctId: string;
      briefTitle: string;
      organization?: {
        fullName: string;
      };
    };
    statusModule?: {
      overallStatus?: string;
      startDateStruct?: {
        date?: string;
      };
    };
    conditionsModule?: {
      conditions?: string[];
    };
    designModule?: {
      studyType?: string;
      phase?: string[];
      enrollmentInfo?: {
        count: number;
      };
    };
    contactsLocationsModule?: {
      locations?: Array<{
        facility?: string;
        city?: string;
        state?: string;
        country: string;
      }>;
    };
  };
  hasResults?: boolean;
}

export interface StudiesResponse {
  studies: Study[];
  nextPageToken?: string;
  totalCount?: number;
}

export interface EnumValues {
  [key: string]: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ClinicalTrialsService {
  private apiUrl = '/api';  // Proxied to backend in Docker, or use full URL for local dev

  constructor(private http: HttpClient) {}

  /**
   * Search studies with filters
   */
  searchStudies(params: StudySearchParams): Observable<StudiesResponse> {
    let httpParams = new HttpParams();

    if (params.condition) {
      httpParams = httpParams.set('condition', params.condition);
    }
    if (params.intervention) {
      httpParams = httpParams.set('intervention', params.intervention);
    }
    if (params.sponsor) {
      httpParams = httpParams.set('sponsor', params.sponsor);
    }
    if (params.overallStatus) {
      httpParams = httpParams.set('overallStatus', params.overallStatus);
    }
    if (params.studyType) {
      httpParams = httpParams.set('studyType', params.studyType);
    }
    if (params.phase) {
      httpParams = httpParams.set('phase', params.phase);
    }
    if (params.sex) {
      httpParams = httpParams.set('sex', params.sex);
    }
    if (params.minAge !== undefined) {
      httpParams = httpParams.set('minAge', params.minAge.toString());
    }
    if (params.maxAge !== undefined) {
      httpParams = httpParams.set('maxAge', params.maxAge.toString());
    }
    if (params.healthyVolunteers !== undefined) {
      httpParams = httpParams.set('healthyVolunteers', params.healthyVolunteers.toString());
    }
    if (params.pageSize) {
      httpParams = httpParams.set('pageSize', params.pageSize.toString());
    }
    if (params.pageToken) {
      httpParams = httpParams.set('pageToken', params.pageToken);
    }

    return this.http.get<StudiesResponse>(`${this.apiUrl}/studies`, { params: httpParams });
  }

  /**
   * Get specific study by NCT ID
   */
  getStudyById(nctId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/studies/${nctId}`);
  }

  /**
   * Get enum values for dropdowns
   */
  getEnumValues(): Observable<EnumValues> {
    return this.http.get<EnumValues>(`${this.apiUrl}/studies/enums`);
  }

  /**
   * Get statistics about studies
   */
  getStatistics(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/stats/size`);
  }

  /**
   * Get field value distribution
   */
  getFieldValueStats(fields: string[]): Observable<any> {
    let params = new HttpParams();
    fields.forEach(field => {
      params = params.append('fields', field);
    });
    return this.http.get<any>(`${this.apiUrl}/stats/field/values`, { params });
  }
}
