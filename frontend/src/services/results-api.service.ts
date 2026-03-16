import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TrialResultsRequest } from '../../../shared/src/dto/TrialResultsRequest';
import { TrialResultsResponse } from '../../../shared/src/dto/TrialResultsResponse';

@Injectable({ providedIn: 'root' })
export class ResultsApiService {
    private http = inject(HttpClient);
    private readonly API_URL = 'http://localhost:3000/api/clinical-trials/results';

    getResults(request: TrialResultsRequest): Observable<TrialResultsResponse> {
        return this.http.post<TrialResultsResponse>(this.API_URL, request);
    }
}
