import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { TrialResultsRequest } from '@shared/dto/TrialResultsRequest';
import { TrialResultsResponse } from '@shared/dto/TrialResultsResponse';
import { mockTrialResultsResponse } from './mock-trial-results';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class ResultsApiService {
    constructor(private http: HttpClient) {

    }
    
    getResults(_request: TrialResultsRequest): Observable<TrialResultsResponse> {
        return of(mockTrialResultsResponse);
    }
}
