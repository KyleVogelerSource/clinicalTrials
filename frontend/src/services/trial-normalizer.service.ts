import { Injectable } from '@angular/core';
import { ClinicalTrialStudy } from '@shared/dto/ClinicalTrialStudiesResponse';

@Injectable({ providedIn: 'root' })
export class TrialNormalizer {
    /**
     * Minimally normalizes a raw ClinicalTrialStudy into a smaller object for API transmission.
     * This avoids sending the massive full protocol sections and solves 413 Payload Too Large.
     */
    normalizeForBenchmark(study: ClinicalTrialStudy): any {
        const protocol = study.protocolSection;
        const identification = protocol.identificationModule;
        const status = protocol.statusModule;
        const design = protocol.designModule;
        const eligibility = protocol.eligibilityModule;
        const sponsors = protocol.sponsorCollaboratorsModule;

        return {
            nctId: identification.nctId,
            briefTitle: identification.briefTitle,
            phase: this.normalizePhase(design?.phases ?? []),
            studyType: design?.studyType || 'UNKNOWN',
            overallStatus: status?.overallStatus || 'UNKNOWN',
            enrollmentCount: design?.enrollmentInfo?.count ?? 0,
            enrollmentType: design?.enrollmentInfo?.type || 'ESTIMATED',
            startDate: status?.startDateStruct?.date || null,
            completionDate: status?.completionDateStruct?.date || null,
            conditions: protocol.conditionsModule?.conditions || [],
            interventions: (protocol.armsInterventionsModule?.interventions || []).map(i => i.name),
            sex: eligibility?.sex || 'ALL',
            minimumAge: eligibility?.minimumAge || null,
            maximumAge: eligibility?.maximumAge || null,
            sponsor: sponsors?.leadSponsor?.name || null
        };
    }

    private normalizePhase(phases: string[]): string {
        const PHASE_ORDER = ["PHASE4", "PHASE3", "PHASE2", "PHASE1", "EARLY_PHASE1", "NA"];
        const upper = phases.map(p => p.toUpperCase().replace(/\s+/g, '_'));
        for (const candidate of PHASE_ORDER) {
            if (upper.includes(candidate)) return candidate;
        }
        return upper[0] ?? 'NA';
    }
}
