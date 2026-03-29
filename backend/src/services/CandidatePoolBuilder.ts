import { ClinicalTrialStudy } from "../../../shared/src/dto/ClinicalTrialStudiesResponse";
import { CandidatePool, CandidatePoolInternal, CandidatePoolMetadata, ExcludedRecord, FilteredRecord, FilterReason, NormalizedTrial, ReferenceTrial } from "../models/NormalizedTrial";

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

    const normalized = valid.map(normalize);

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
        const studyConditions = (p.conditionsModule?.conditions ?? []).map((c) =>
            c.toLowerCase()
        );
        const required = config.requiredConditions.map((c) => c.toLowerCase());
        const satisfied = required.some((rc) =>
            studyConditions.some((sc) => sc.includes(rc))
        );
        if (!satisfied) return "required_condition_not_met";
    }

    if (config.ineligibleConditions && config.ineligibleConditions.length > 0) {
        const studyConditions = (p.conditionsModule?.conditions ?? []).map((c) =>
            c.toLowerCase()
        );
        const ineligible = config.ineligibleConditions.map((c) => c.toLowerCase());
        const hasIneligible = ineligible.some((ic) =>
            studyConditions.some((sc) => sc.includes(ic))
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
        const studyConditions = (p.conditionsModule?.conditions ?? []).map((c) =>
            c.toLowerCase()
        );
        const refConditions = ref.conditions.map((c) => c.toLowerCase());
        const hasOverlap = refConditions.some((rc) =>
            studyConditions.some((sc) => sc.includes(rc) || rc.includes(sc))
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

function normalize(study: ClinicalTrialStudy): NormalizedTrial {
    const p = study.protocolSection;
    const id = p.identificationModule;
    const status = p.statusModule;
    const design = p.designModule;
    const eligibility = p.eligibilityModule;

    return {
        nctId: id.nctId,
        briefTitle: id.briefTitle,

        phase: normalizePhase(design?.phases ?? []),
        studyType: normalizeString(design?.studyType),
        overallStatus: normalizeString(status?.overallStatus),

        enrollmentCount: design?.enrollmentInfo?.count ?? 0,
        enrollmentType: normalizeEnrollmentType(design?.enrollmentInfo?.type),

        startDate: normalizeDate(status?.startDateStruct?.date),
        completionDate: normalizeDate(status?.completionDateStruct?.date),

        conditions: p.conditionsModule?.conditions ?? [],
        interventions: extractInterventionNames(study),

        eligibilityCriteria: eligibility?.eligibilityCriteria?.trim() ?? "",
        sex: normalizeString(eligibility?.sex, "ALL"),
        minimumAge: eligibility?.minimumAge ?? null,
        maximumAge: eligibility?.maximumAge ?? null,

        primaryOutcomes: extractPrimaryOutcomes(study),

        sponsor: p.sponsorCollaboratorsModule?.leadSponsor?.name ?? null,
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

const PHASE_ORDER = ["PHASE4", "PHASE3", "PHASE2", "PHASE1", "EARLY_PHASE1", "NA"];

function normalizePhase(phases: string[]): string {
    const upper = phases.map((p) => p.toUpperCase().replace(/\s+/g, "_"));
    for (const candidate of PHASE_ORDER) {
        if (upper.includes(candidate)) return candidate;
    }
    return upper[0] ?? "NA";
}

function normalizeEnrollmentType(type?: string): "ACTUAL" | "ESTIMATED" {
    return type?.toUpperCase() === "ACTUAL" ? "ACTUAL" : "ESTIMATED";
}

function normalizeDate(raw?: string): string | null {
    if (!raw) return null;

    const isoMatch = raw.match(/^(\d{4}-\d{2})/);
    if (isoMatch) return isoMatch[1];

    const monthYearMatch = raw.match(/^(\w+)\s+(\d{4})$/);
    if (monthYearMatch) {
        const month = parseMonthName(monthYearMatch[1]);
        if (month) return `${monthYearMatch[2]}-${month}`;
    }

    return null;
}

const MONTH_MAP: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04",
    may: "05", june: "06", july: "07", august: "08",
    september: "09", october: "10", november: "11", december: "12",
};

function parseMonthName(name: string): string | null {
    return MONTH_MAP[name.toLowerCase()] ?? null;
}

function normalizeString(value?: string, fallback = "UNKNOWN"): string {
    if (!value || value.trim() === "") return fallback;
    return value.trim().toUpperCase();
}

function extractInterventionNames(study: ClinicalTrialStudy): string[] {
    return (study.protocolSection.armsInterventionsModule?.interventions ?? [])
        .map((i) => i.name)
        .filter((n): n is string => !!n);
}

function extractPrimaryOutcomes(study: ClinicalTrialStudy): string[] {
    return (study.protocolSection.outcomesModule?.primaryOutcomes ?? [])
        .map((o) => o.measure)
        .filter((m): m is string => !!m);
}