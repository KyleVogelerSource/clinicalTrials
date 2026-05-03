import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  searchClinicalTrials,
  createEmptyClinicalTrialStudiesResponse,
  searchAndBuildCandidatePool,
} from "./ClinicalTrialsService";
import { ClinicalTrialsApiClient } from "../client/ClinicalTrialsApiClient";
import { ClinicalTrialSearchRequest } from "../dto/ClinicalTrialSearchRequest";
import {
  ClinicalTrialStudy,
  ClinicalTrialStudiesResponse,
} from "../dto/ClinicalTrialStudiesResponse";

vi.mock("../client/ClinicalTrialsApiClient");

describe("ClinicalTrialsService", () => {
  type SearchStudiesFn = (
    request: ClinicalTrialSearchRequest
  ) => Promise<ClinicalTrialStudiesResponse>;

  let mockClient: { searchStudies: ReturnType<typeof vi.fn<SearchStudiesFn>> };
  let client: ClinicalTrialsApiClient;

  beforeEach(() => {
    mockClient = {
      searchStudies: vi.fn<SearchStudiesFn>(),
    };
    client = mockClient as unknown as ClinicalTrialsApiClient;
    vi.mocked(ClinicalTrialsApiClient).mockImplementation(() => client);
    vi.clearAllMocks();
  });

  describe("createEmptyClinicalTrialStudiesResponse", () => {
    it("should return empty response with no studies", () => {
      const response = createEmptyClinicalTrialStudiesResponse();

      expect(response).toEqual({
        totalCount: 0,
        studies: [],
      });
    });

    it("should return object with expected properties", () => {
      const response = createEmptyClinicalTrialStudiesResponse();

      expect(response).toHaveProperty("totalCount");
      expect(response).toHaveProperty("studies");
      expect(Array.isArray(response.studies)).toBe(true);
    });
  });

  describe("searchClinicalTrials", () => {
    it("should call client searchStudies with correct request", async () => {
      const request: ClinicalTrialSearchRequest = {
        term: "cancer",
      };

      mockClient.searchStudies.mockResolvedValue({
        totalCount: 10,
        studies: [],
      });

      await searchClinicalTrials(request, client);

      expect(mockClient.searchStudies).toHaveBeenCalledWith(request);
    });

    it("should return response from client", async () => {
      const request: ClinicalTrialSearchRequest = { condition: "diabetes" };
      const expectedResponse = {
        totalCount: 5,
        studies: [
          {
            protocolSection: {
              identificationModule: {
                nctId: "NCT001",
                briefTitle: "Test Study",
              },
            },
          } as unknown as ClinicalTrialStudy,
        ],
      };

      mockClient.searchStudies.mockResolvedValue(expectedResponse);

      const result = await searchClinicalTrials(request, client);

      expect(result).toEqual(expectedResponse);
    });

    it("should propagate client errors", async () => {
      const request: ClinicalTrialSearchRequest = { term: "error" };
      const error = new Error("API Error");

      mockClient.searchStudies.mockRejectedValue(error);

      await expect(searchClinicalTrials(request, client)).rejects.toThrow("API Error");
    });

    it("should handle empty results", async () => {
      const request: ClinicalTrialSearchRequest = { term: "nonexistent" };

      mockClient.searchStudies.mockResolvedValue({
        totalCount: 0,
        studies: [],
      });

      const result = await searchClinicalTrials(request, client);

      expect(result.studies.length).toBe(0);
      expect(result.totalCount).toBe(0);
    });

    it("should handle large result sets", async () => {
      const request: ClinicalTrialSearchRequest = { term: "cancer" };
      const largeStudySet = Array.from(
        { length: 100 },
        (_, i) =>
          ({
            protocolSection: {
              identificationModule: {
                nctId: `NCT${String(i + 1).padStart(6, "0")}`,
                briefTitle: `Study ${i + 1}`,
              },
            },
          } as unknown as ClinicalTrialStudy)
      );

      mockClient.searchStudies.mockResolvedValue({
        totalCount: 100,
        studies: largeStudySet,
      });

      const result = await searchClinicalTrials(request, client);

      expect(result.studies.length).toBe(100);
    });
  });

  describe("searchAndBuildCandidatePool", () => {
    it("should fetch single page and build pool", async () => {
      const request: ClinicalTrialSearchRequest = { term: "cancer" };
      const studies = [
        {
          protocolSection: {
            identificationModule: {
              nctId: "NCT001",
              briefTitle: "Study 1",
            },
            designModule: {
              phases: ["Phase 2"],
              enrollmentInfo: { count: 100 },
              studyType: "INTERVENTIONAL",
            },
            eligibilityModule: {
              eligibilityCriteria: "Age 18+",
              sex: "ALL",
            },
            conditionsModule: { conditions: ["Cancer"] },
          },
        } as unknown as ClinicalTrialStudy,
      ];

      mockClient.searchStudies.mockResolvedValue({
        totalCount: 1,
        studies,
      });

      const result = await searchAndBuildCandidatePool(request, {}, client);

      expect(result).toHaveProperty("trials");
      expect(result).toHaveProperty("metadata");
      expect(result.trials.length).toBeGreaterThan(0);
    });

    it("should fetch multiple pages when nextPageToken is present", async () => {
      const request: ClinicalTrialSearchRequest = { term: "cancer" };

      const studiesPage1 = Array.from({ length: 5 }, (_, i) =>
        createMockStudy(`NCT${String(i + 1).padStart(6, "0")}`)
      );
      const studiesPage2 = Array.from({ length: 3 }, (_, i) =>
        createMockStudy(`NCT${String(i + 6).padStart(6, "0")}`)
      );

      mockClient.searchStudies
        .mockResolvedValueOnce({
          totalCount: 8,
          studies: studiesPage1,
          nextPageToken: "token123",
        })
        .mockResolvedValueOnce({
          totalCount: 8,
          studies: studiesPage2,
        });

      const result = await searchAndBuildCandidatePool(request, {}, client);

      expect(mockClient.searchStudies).toHaveBeenCalledTimes(2);
      expect(result.metadata.totalFetchedFromApi).toBe(8);
    });

    it("should apply cap to candidate pool", async () => {
      const request: ClinicalTrialSearchRequest = { term: "cancer" };
      const studies = Array.from({ length: 30 }, (_, i) => createMockStudy(`NCT${String(i + 1).padStart(6, "0")}`));

      mockClient.searchStudies.mockResolvedValue({
        totalCount: 30,
        studies,
      });

      const result = await searchAndBuildCandidatePool(
        request,
        { cap: 10 },
        client
      );

      expect(result.trials.length).toBeLessThanOrEqual(10);
      expect(result.metadata.cappedAt).toBe(10);
    });

    it("should respect default cap of 15", async () => {
      const request: ClinicalTrialSearchRequest = { term: "cancer" };
      const studies = Array.from({ length: 50 }, (_, i) => createMockStudy(`NCT${String(i + 1).padStart(6, "0")}`));

      mockClient.searchStudies.mockResolvedValue({
        totalCount: 50,
        studies,
      });

      const result = await searchAndBuildCandidatePool(request, {}, client);

      expect(result.trials.length).toBeLessThanOrEqual(15);
      expect(result.metadata.cappedAt).toBe(15);
    });

    it("should filter studies with missing phase", async () => {
      const request: ClinicalTrialSearchRequest = { term: "cancer" };
      const validStudy = createMockStudy("NCT001");
      const invalidStudy = {
        ...createMockStudy("NCT002"),
        protocolSection: {
          ...createMockStudy("NCT002").protocolSection,
          designModule: { phases: undefined },
        },
      };

      mockClient.searchStudies.mockResolvedValue({
        totalCount: 2,
        studies: [validStudy, invalidStudy],
      });

      const result = await searchAndBuildCandidatePool(request, {}, client);

      expect(result.metadata.totalFiltered).toBeGreaterThan(0);
    });

    it("should track metadata correctly", async () => {
      const request: ClinicalTrialSearchRequest = { term: "cancer" };
      const studies = Array.from({ length: 25 }, (_, i) => createMockStudy(`NCT${String(i + 1).padStart(6, "0")}`));

      mockClient.searchStudies.mockResolvedValue({
        totalCount: 25,
        studies,
      });

      const result = await searchAndBuildCandidatePool(
        request,
        { cap: 10 },
        client
      );

      expect(result.metadata.totalFetchedFromApi).toBe(25);
      expect(result.metadata.totalInPool).toBeLessThanOrEqual(10);
      expect(result.metadata.totalExcluded).toBeGreaterThanOrEqual(0);
      expect(result.metadata.cappedAt).toBe(10);
    });

    it("should handle error from client", async () => {
      const request: ClinicalTrialSearchRequest = { term: "cancer" };

      mockClient.searchStudies.mockRejectedValue(new Error("Network error"));

      await expect(
        searchAndBuildCandidatePool(request, {}, client)
      ).rejects.toThrow("Network error");
    });

    it("should stop pagination at MAX_PAGES", async () => {
      const request: ClinicalTrialSearchRequest = { term: "cancer" };

      // Mock 11 pages worth of responses (to exceed MAX_PAGES=10)
      for (let i = 0; i < 11; i++) {
        mockClient.searchStudies.mockResolvedValueOnce({
          totalCount: 1100,
          studies: Array.from({ length: 5 }, (_, j) =>
            createMockStudy(`NCT${String(i * 5 + j).padStart(6, "0")}`)
          ),
          nextPageToken: i < 10 ? `token${i}` : undefined,
        });
      }

      const result = await searchAndBuildCandidatePool(request, {}, client);

      expect(mockClient.searchStudies).toHaveBeenCalledTimes(11);
      expect(result.metadata.totalPagesfetched).toBeLessThanOrEqual(11);
    });
  });
});

// Helper function to create mock studies
function createMockStudy(nctId: string, conditions: string[] = ["Cancer"]): ClinicalTrialStudy {
  return {
    protocolSection: {
      identificationModule: {
        nctId,
        briefTitle: `Clinical Trial ${nctId}`,
      },
      designModule: {
        phases: ["Phase 2"],
        enrollmentInfo: {
          count: 100,
        },
        studyType: "INTERVENTIONAL",
      },
      eligibilityModule: {
        eligibilityCriteria: "18 years or older",
        sex: "ALL",
      },
      conditionsModule: {
        conditions,
      },
    },
  } as unknown as ClinicalTrialStudy;
}
