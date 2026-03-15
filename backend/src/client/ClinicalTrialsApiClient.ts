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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
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

    if (request.term)              p.set("query.term",    request.term);
    if (request.condition)         p.set("query.cond",    request.condition);
    if (request.intervention)      p.set("query.intr",    request.intervention);
    if (request.sponsor)           p.set("query.spons",   request.sponsor);
    if (request.investigator)      p.set("query.invest",  request.investigator);
    if (request.location)          p.set("query.locn",    request.location);

    if (request.overallStatus)     p.set("filter.overallStatus",     request.overallStatus);
    if (request.studyType)         p.set("filter.studyType",         request.studyType);
    if (request.phase)             p.set("filter.phase",             request.phase);
    if (request.interventionModel) p.set("filter.interventionModel", request.interventionModel);
    if (request.primaryPurpose)    p.set("filter.primaryPurpose",    request.primaryPurpose);
    if (request.sex)               p.set("filter.sex",               request.sex);

    if (request.healthyVolunteers !== undefined) {
      p.set("filter.healthyVolunteers", String(request.healthyVolunteers));
    }
    if (request.hasResults !== undefined) {
      p.set("filter.hasResults", String(request.hasResults));
    }

    const pageSize = Math.min(request.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    p.set("pageSize", String(pageSize));
    if (request.pageToken)         p.set("pageToken", request.pageToken);
    if (request.countTotal !== undefined) p.set("countTotal", String(request.countTotal));

    p.set("format", "json");

    const raw: string[] = [];

    if (request.minAge !== undefined || request.maxAge !== undefined) {
      const lo = request.minAge ?? "MIN";
      const hi = request.maxAge ?? "MAX";
      raw.push(`filter.age=RANGE[${lo},${hi}]`);
    }

    if (request.startDateFrom || request.startDateTo) {
      const from = request.startDateFrom ?? "MIN";
      const to   = request.startDateTo   ?? "MAX";
      raw.push(`filter.startDate=RANGE[${from},${to}]`);
    }

    if (request.completionDateFrom || request.completionDateTo) {
      const from = request.completionDateFrom ?? "MIN";
      const to   = request.completionDateTo   ?? "MAX";
      raw.push(`filter.completionDate=RANGE[${from},${to}]`);
    }

    if (request.minEnrollment !== undefined || request.maxEnrollment !== undefined) {
      const lo = request.minEnrollment ?? "MIN";
      const hi = request.maxEnrollment ?? "MAX";
      raw.push(`filter.enrollment=RANGE[${lo},${hi}]`);
    }

    raw.push("fields=protocolSection,derivedSection,hasResults");

    return `${BASE_URL}?${p.toString()}&${raw.join("&")}`;
  }

  private mapResponse(raw: any): ClinicalTrialStudiesResponse {
    return {
      totalCount: raw.totalCount ?? 0,
      nextPageToken: raw.nextPageToken,
      studies: Array.isArray(raw.studies) ? raw.studies : [],
    };
  }
}