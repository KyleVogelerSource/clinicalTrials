import { Injectable } from '@angular/core';
import meshData from '../../../shared/src/static/combined-mesh-data.json';
import conditionData from '../../../shared/src/static/common-disease-conditions.json';
import trialDesignOptions from '../../../shared/src/static/trial-design-options.json';
import Fuse from 'fuse.js'; // A fuzzy match library

interface MeshEntry {
    id: string;
    name: string;
    synonyms: string[];
}

@Injectable({
    providedIn: 'root',
})
export class ClinicalStudyService {
    private keywords: Fuse<MeshEntry>;
    private conditions: Fuse<MeshEntry>;

    constructor() {
        this.keywords = new Fuse(meshData as MeshEntry[], {
            keys: ['name', 'synonyms'],
            threshold: 0.3,
        });

        this.conditions = new Fuse(conditionData as MeshEntry[], {
            keys: ['name', 'synonyms'],
            threshold: 0.3
        });
    }

    getSuggestedKeywords(input: string): string[] {
        return input ? this.search(input, this.keywords) : [];
    }

    getMatchingConditions(input: string | null): string[] {
        return input ? this.search(input, this.conditions) : [];
    }

    private search(input: string, dataSet: Fuse<MeshEntry>): string[] {
        const results = dataSet.search(input);
        const uniqueNames = new Set<string>();

        for (const result of results) {
            uniqueNames.add(result.item.name);
            if (uniqueNames.size >= 10) {
                break;
            }
        }
        return Array.from(uniqueNames);
    }

    getInterventionModels(): string[] {
        return trialDesignOptions.interventionModels;
    }

    getMaskingTypes(): string[] {
        return trialDesignOptions.maskingTypes;
    }

    getMaskingRoles(): string[] {
        return trialDesignOptions.maskingRoles;
    }

    getPrimaryPurposes(): string[] {
        return trialDesignOptions.primaryPurposes;
    }

    getAllocations(): string[] {
        return trialDesignOptions.allocations;
    }

    getEnrollmentTypes(): string[] {
        return trialDesignOptions.enrollmentTypes;
    }

    getPhases(): string[] {
        return trialDesignOptions.phases;
    }
}

