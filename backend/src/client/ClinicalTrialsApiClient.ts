import { ClinicalTrialSearchRequest } from "../../../shared/src/dto/ClinicalTrialSearchRequest";
import { ClinicalTrialStudiesResponse } from "../models/ClinicalTrialStudiesResponse";

const BASE_URL = "https://clinicaltrials.gov/api/v2/studies";
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const DEFAULT_TIMEOUT_MS = 10_000;

export interface ClinicalTrialsClientConfig {
  timeoutMs?: number;
}

export class ClinicalTrialsApiClientError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ClinicalTrialsApiClientError";
  }
}

export class ClinicalTrialsApiTimeoutError extends ClinicalTrialsApiClientError {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = "ClinicalTrialsApiTimeoutError";
  }
}

export class ClinicalTrialsApiClient {
  private readonly timeoutMs: number;

  constructor(config: ClinicalTrialsClientConfig = {}) {
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async searchStudies(
    request: ClinicalTrialSearchRequest
  ): Promise<ClinicalTrialStudiesResponse> {
    const url = this.buildUrl(request);

    console.log("[ClinicalTrialsApiClient] GET", url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        const body = await response.text();
        console.error("[ClinicalTrialsApiClient] Error response body:", body);
        throw new ClinicalTrialsApiClientError(
          `ClinicalTrials.gov API responded with status ${response.status}: ${response.statusText}`
        );
      }

      const raw = await response.json();
      return this.mapResponse(raw);
    } catch (err) {
      if (err instanceof ClinicalTrialsApiClientError) throw err;

      if (err instanceof Error && err.name === "AbortError") {
        throw new ClinicalTrialsApiTimeoutError(this.timeoutMs);
      }

      throw new ClinicalTrialsApiClientError(
        "Failed to fetch studies from ClinicalTrials.gov",
        err
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  buildUrl(request: ClinicalTrialSearchRequest): string {
    const p = new URLSearchParams();

    if (request.term)              p.set("query.term",   request.term);
    if (request.condition)         p.set("query.cond",   request.condition);
    if (request.intervention)      p.set("query.intr",   request.intervention);
    if (request.sponsor)           p.set("query.spons",  request.sponsor);
    if (request.investigator)      p.set("query.invest", request.investigator);
    if (request.location)          p.set("query.locn",   request.location);

    if (request.overallStatus) {
      p.set("filter.overallStatus", request.overallStatus);
    }

    const advanced = this.buildAdvancedFilter(request);
    if (advanced) {
      p.set("filter.advanced", advanced);
    }

    const pageSize = Math.min(request.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    p.set("pageSize", String(pageSize));
    if (request.pageToken)           p.set("pageToken",   request.pageToken);
    if (request.countTotal !== undefined) p.set("countTotal", String(request.countTotal));

    p.set("format", "json");

    const fields = "fields=ProtocolSection,DerivedSection,HasResults";

    return `${BASE_URL}?${p.toString()}&${fields}`;
  }

  private buildAdvancedFilter(request: ClinicalTrialSearchRequest): string {
    const clauses: string[] = [];

    if (request.phase)             clauses.push(`AREA[Phase]${request.phase}`);
    if (request.studyType)         clauses.push(`AREA[StudyType]${request.studyType}`);
    if (request.interventionModel) clauses.push(`AREA[InterventionModel]${request.interventionModel}`);
    if (request.primaryPurpose)    clauses.push(`AREA[PrimaryPurpose]${request.primaryPurpose}`);
    if (request.sex)               clauses.push(`AREA[Sex]${request.sex}`);

    if (request.healthyVolunteers !== undefined) {
      clauses.push(`AREA[HealthyVolunteers]${request.healthyVolunteers ? "Y" : "N"}`);
    }
    if (request.hasResults !== undefined) {
      clauses.push(`AREA[HasResults]${request.hasResults ? "Y" : "N"}`);
    }

    if (request.minAge !== undefined || request.maxAge !== undefined) {
      const lo = request.minAge  ?? "MIN";
      const hi = request.maxAge  ?? "MAX";
      clauses.push(`AREA[MinimumAge]RANGE[${lo},${hi}]`);
    }

    if (request.minEnrollment !== undefined || request.maxEnrollment !== undefined) {
      const lo = request.minEnrollment ?? "MIN";
      const hi = request.maxEnrollment ?? "MAX";
      clauses.push(`AREA[EnrollmentCount]RANGE[${lo},${hi}]`);
    }

    if (request.startDateFrom || request.startDateTo) {
      const from = request.startDateFrom ?? "MIN";
      const to   = request.startDateTo   ?? "MAX";
      clauses.push(`AREA[StartDate]RANGE[${from},${to}]`);
    }

    if (request.completionDateFrom || request.completionDateTo) {
      const from = request.completionDateFrom ?? "MIN";
      const to   = request.completionDateTo   ?? "MAX";
      clauses.push(`AREA[CompletionDate]RANGE[${from},${to}]`);
    }

    return clauses.join(" AND ");
  }

  private mapResponse(raw: any): ClinicalTrialStudiesResponse {
    return {
      totalCount: raw.totalCount ?? 0,
      nextPageToken: raw.nextPageToken,
      studies: Array.isArray(raw.studies) ? raw.studies : [],
    };
  }
}