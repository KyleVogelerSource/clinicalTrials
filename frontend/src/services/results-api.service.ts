import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { TrialResultsRequest } from '../../../shared/src/dto/TrialResultsRequest';
import { TrialResultsResponse } from '../../../shared/src/dto/TrialResultsResponse';
import { mockTrialResultsResponse } from './mock-trial-results';

@Injectable({ providedIn: 'root' })
export class ResultsApiService {
    getResults(_request: TrialResultsRequest): Observable<TrialResultsResponse> {
        return of(mockTrialResultsResponse);
    }
}
