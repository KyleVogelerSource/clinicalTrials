import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { TrialResultsRequest } from '@shared/dto/TrialResultsRequest';
import { TrialResultsResponse } from '@shared/dto/TrialResultsResponse';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class ResultsApiService {
    private http = inject(HttpClient);
    private readonly apiUrl = `${environment.apiBaseUrl}/api/clinical-trials/benchmark`;
    
    getResults(request: TrialResultsRequest, trials: any[]): Observable<TrialResultsResponse> {
        return this.http.post<TrialResultsResponse>(this.apiUrl, {
            ...request,
            trials: trials
        });
    }
}
