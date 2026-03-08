import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class ClinicalStudyService {
    getMatchingConditions(input: string | null): string[] {
        let result: string[] = [];

        // TODO: Hit the backend/cache
        if (input !== null) {
            result = [
                input + '_test',
                input + '_one',
                input + '_two',
                input + '_3'
            ];
        }

        return result;
    }
}
