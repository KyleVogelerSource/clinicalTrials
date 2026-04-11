import { ClinicalTrialStudy } from "../dto/ClinicalTrialStudiesResponse";
import { CandidatePool, CandidatePoolInternal, CandidatePoolMetadata, ExcludedRecord, FilteredRecord, FilterReason, NormalizedTrial, ReferenceTrial } from "../models/NormalizedTrial";
import { normalizePhase, normalizeTrialStudy } from "./TrialNormalizer";

const DEFAULT_POOL_CAP = 15;

export interface PoolBuilderConfig {
    cap?: number;
    referenceTrial?: ReferenceTrial;
    requiredConditions?: string[];
    ineligibleConditions?: string[];
}

export function buildCandidatePool(studies: ClinicalTrialStudy[], totalPagesFetched: number, config: PoolBuilderConfig = {}): CandidatePool {
    const cap = config.cap ?? DEFAULT_POOL_CAP;
    const ref = config.referenceTrial;
    const totalFetchedFromApi = studies.length;

    const filtered: FilteredRecord[] = [];
    const valid: ClinicalTrialStudy[] = [];

    for (const study of studies) {
        const reason = getFilterReason(study, ref, config);
        if (reason) {
            filtered.push(buildFilteredRecord(study, reason, ref, config));
        } else {
            valid.push(study);
        }
    }

    const normalized = valid.map(normalizeTrialStudy);

    const sorted = sortPool(normalized, ref?.enrollmentCount);

    const trials = sorted.slice(0, cap);

    const excluded: ExcludedRecord[] = sorted.slice(cap).map((trial, i) => ({
        nctId: trial.nctId,
        briefTitle: trial.briefTitle,
        reason: "capped",
        rank: cap + i + 1,
        enrollmentCount: trial.enrollmentCount,
        startDate: trial.startDate,
    }));

    const metadata: CandidatePoolMetadata = {
        totalFetchedFromApi,
        totalPagesfetched: totalPagesFetched,
        totalFiltered: filtered.length,
        totalExcluded: excluded.length,
        totalInPool: trials.length,
        cappedAt: cap,
    };

    const _internal: CandidatePoolInternal = { trials, metadata, filtered, excluded };
    void _internal;

    return { trials, metadata };
}

function getFilterReason(study: ClinicalTrialStudy, ref?: ReferenceTrial, config: PoolBuilderConfig = {}): FilterReason | null {
    const p = study.protocolSection;

    const phases = p.designModule?.phases;
    if (!phases || phases.length === 0) return "missing_phase";

    const enrollment = p.designModule?.enrollmentInfo?.count;
    if (enrollment === undefined || enrollment === null) return "missing_enrollment";

    const criteria = p.eligibilityModule?.eligibilityCriteria;
    if (!criteria || criteria.trim() === "") return "missing_eligibility_criteria";

    if (config.requiredConditions && config.requiredConditions.length > 0) {
        const studyConditions = (p.conditionsModule?.conditions ?? []).map((c: string) =>
            c.toLowerCase()
        );
        const required = config.requiredConditions.map((c) => c.toLowerCase());
        const satisfied = required.some((rc) =>
            studyConditions.some((sc: string) => sc.includes(rc))
        );
        if (!satisfied) return "required_condition_not_met";
    }

    if (config.ineligibleConditions && config.ineligibleConditions.length > 0) {
        const studyConditions = (p.conditionsModule?.conditions ?? []).map((c: string) =>
            c.toLowerCase()
        );
        const ineligible = config.ineligibleConditions.map((c) => c.toLowerCase());
        const hasIneligible = ineligible.some((ic) =>
            studyConditions.some((sc: string) => sc.includes(ic))
        );
        if (hasIneligible) return "ineligible_condition_present";
    }

    if (!ref) return null;

    if (ref.phase) {
        const studyPhase = normalizePhase(phases);
        if (studyPhase !== ref.phase.toUpperCase()) return "phase_mismatch";
    }

    if (ref.studyType) {
        const studyType = p.designModule?.studyType?.toUpperCase();
        if (!studyType || studyType !== ref.studyType.toUpperCase()) return "study_type_mismatch";
    }

    if (ref.sex) {
        const studySex = p.eligibilityModule?.sex?.toUpperCase() ?? "ALL";
        if (!isSexCompatible(ref.sex.toUpperCase(), studySex)) return "sex_incompatible";
    }

    if (ref.conditions && ref.conditions.length > 0) {
        const studyConditions = (p.conditionsModule?.conditions ?? []).map((c: string) =>
            c.toLowerCase()
        );
        const refConditions = ref.conditions.map((c) => c.toLowerCase());
        const hasOverlap = refConditions.some((rc) =>
            studyConditions.some((sc: string) => sc.includes(rc) || rc.includes(sc))
        );
        if (!hasOverlap) return "no_condition_overlap";
    }

    return null;
}

function isSexCompatible(referenceSex: string, studySex: string): boolean {
    if (referenceSex === "ALL") return true;
    if (studySex === "ALL") return true;
    return referenceSex === studySex;
}

function buildFilteredRecord(study: ClinicalTrialStudy, reason: FilterReason, ref?: ReferenceTrial, config: PoolBuilderConfig = {}): FilteredRecord {
    const id = study.protocolSection.identificationModule;

    const detailMap: Partial<Record<FilterReason, string>> = {
        missing_phase: "No phase data present",
        missing_enrollment: "No enrollment count present",
        missing_eligibility_criteria: "No eligibility criteria text present",
        phase_mismatch: `Phase does not match reference (${ref?.phase})`,
        study_type_mismatch: `Study type does not match reference (${ref?.studyType})`,
        sex_incompatible: `Sex eligibility incompatible with reference (${ref?.sex})`,
        no_condition_overlap: `No condition overlap with reference (${ref?.conditions?.join(", ")})`,
        required_condition_not_met: `Trial does not match any required condition (${config.requiredConditions?.join(", ")})`,
        ineligible_condition_present: `Trial lists an ineligible condition (${config.ineligibleConditions?.join(", ")})`,
    };

    return {
        nctId: id.nctId,
        briefTitle: id.briefTitle,
        reason,
        detail: detailMap[reason],
    };
}

function sortPool(trials: NormalizedTrial[], referenceEnrollment?: number): NormalizedTrial[] {
    return [...trials].sort((a, b) => {
        const dateCompare = compareDates(b.startDate, a.startDate);
        if (dateCompare !== 0) return dateCompare;

        if (referenceEnrollment !== undefined) {
            const distA = Math.abs(a.enrollmentCount - referenceEnrollment);
            const distB = Math.abs(b.enrollmentCount - referenceEnrollment);
            return distA - distB;
        }

        return 0;
    });
}

function compareDates(a: string | null, b: string | null): number {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b);
}

