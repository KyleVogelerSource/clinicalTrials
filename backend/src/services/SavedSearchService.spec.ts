import { beforeEach, describe, expect, it, vi } from "vitest";
import * as postgresClient from "../storage/PostgresClient";
import * as clinicalTrialsService from "./ClinicalTrialsService";
import {
  createSavedSearch,
  deleteOwnedSavedSearch,
  getAccessibleSavedSearch,
  listOwnedSavedSearches,
  listSharedSavedSearches,
  runSavedSearch,
  shareSavedSearch,
  updateAccessibleSavedSearch,
} from "./SavedSearchService";

vi.mock("../storage/PostgresClient");
vi.mock("./ClinicalTrialsService");

describe("SavedSearchService", () => {
  let mockPool: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
    };

    vi.mocked(postgresClient.getDbPool).mockReturnValue(
      mockPool as unknown as ReturnType<typeof postgresClient.getDbPool>
    );
    vi.clearAllMocks();
  });

  it("creates a saved search with normalized criteria and canonical key", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          owner_user_id: 7,
          owner_username: "",
          name: "Diabetes Search",
          description: null,
          criteria_json: { condition: "diabetes" },
          visibility: "private",
          created_at: "2026-04-10T00:00:00.000Z",
          updated_at: "2026-04-10T00:00:00.000Z",
          is_owner: true,
          access_can_view: true,
          access_can_run: true,
          access_can_edit: true,
        },
      ],
    });

    const result = await createSavedSearch(7, "alice", {
      name: "Diabetes Search",
      description: null,
      criteriaJson: {
        condition: " Diabetes ",
      },
      visibility: "private",
    });

    const queryArgs = mockPool.query.mock.calls[0][1];
    expect(queryArgs[3]).toContain("diabetes");
    expect(queryArgs[4]).toHaveLength(64);
    expect(result.criteriaJson.condition).toBe("diabetes");
  });

  it("trims non-empty descriptions and maps string criteria rows", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 11,
          owner_user_id: 7,
          owner_username: "",
          name: "Trimmed",
          description: "keep me",
          criteria_json: JSON.stringify({ condition: "asthma" }),
          visibility: "shared",
          created_at: "2026-04-10T00:00:00.000Z",
          updated_at: "2026-04-10T00:00:00.000Z",
          last_known_count: undefined,
          last_run_at: undefined,
          is_owner: true,
          access_can_view: false,
          access_can_run: false,
          access_can_edit: false,
        },
      ],
    });

    const result = await createSavedSearch(7, "alice", {
      name: " Trimmed ",
      description: " keep me ",
      criteriaJson: { condition: " Asthma " },
      visibility: "shared",
    });

    expect(mockPool.query.mock.calls[0][1][1]).toBe("Trimmed");
    expect(mockPool.query.mock.calls[0][1][2]).toBe("keep me");
    expect(result.criteriaJson).toEqual({ condition: "asthma" });
    expect(result.lastKnownCount).toBeNull();
    expect(result.lastRunAt).toBeNull();
  });

  it("lists owned saved searches", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 2,
          owner_user_id: 3,
          owner_username: "alice",
          name: "Owned",
          description: "mine",
          criteria_json: { condition: "asthma" },
          visibility: "private",
          created_at: "2026-04-10T00:00:00.000Z",
          updated_at: "2026-04-10T00:00:00.000Z",
          is_owner: true,
          access_can_view: true,
          access_can_run: true,
          access_can_edit: true,
        },
      ],
    });

    const results = await listOwnedSavedSearches(3);

    expect(results).toHaveLength(1);
    expect(results[0].permissions.isOwner).toBe(true);
  });

  it("lists shared saved searches", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 4,
          owner_user_id: 9,
          owner_username: "bob",
          name: "Shared",
          description: null,
          criteria_json: { condition: "heart failure" },
          visibility: "shared",
          created_at: "2026-04-10T00:00:00.000Z",
          updated_at: "2026-04-10T00:00:00.000Z",
          is_owner: false,
          access_can_view: true,
          access_can_run: false,
          access_can_edit: false,
        },
      ],
    });

    const results = await listSharedSavedSearches(5);

    expect(results).toHaveLength(1);
    expect(results[0].ownerUsername).toBe("bob");
    expect(results[0].permissions.canView).toBe(true);
  });

  it("returns null for shared saved search access when acl is not allowed", async () => {
    mockPool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: 8,
          owner_user_id: 9,
          owner_username: "bob",
          name: "Shared",
          description: null,
          criteria_json: { condition: "heart failure" },
          visibility: "shared",
          created_at: "2026-04-10T00:00:00.000Z",
          updated_at: "2026-04-10T00:00:00.000Z",
          is_owner: false,
          access_can_view: true,
          access_can_run: false,
          access_can_edit: false,
        },
      ],
    });

    const result = await getAccessibleSavedSearch(8, 5, false);

    expect(result).toBeNull();
  });

  it("returns null for missing saved searches and denied shared rows", async () => {
    mockPool.query.mockResolvedValueOnce({ rowCount: undefined, rows: [] });
    await expect(getAccessibleSavedSearch(8, 5, true)).resolves.toBeNull();

    mockPool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: 8,
          owner_user_id: 9,
          owner_username: "bob",
          name: "Shared",
          description: null,
          criteria_json: { condition: "heart failure" },
          visibility: "shared",
          created_at: "2026-04-10T00:00:00.000Z",
          updated_at: "2026-04-10T00:00:00.000Z",
          is_owner: false,
          access_can_view: false,
          access_can_run: false,
          access_can_edit: false,
        },
      ],
    });

    await expect(getAccessibleSavedSearch(8, 5, true)).resolves.toBeNull();
  });

  it("allows shared edit when share row and acl are both present", async () => {
    mockPool.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 8,
            owner_user_id: 9,
            owner_username: "bob",
            name: "Shared",
            description: null,
            criteria_json: { condition: "heart failure" },
            visibility: "shared",
            created_at: "2026-04-10T00:00:00.000Z",
            updated_at: "2026-04-10T00:00:00.000Z",
            is_owner: false,
            access_can_view: true,
            access_can_run: true,
            access_can_edit: true,
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 8,
            owner_user_id: 9,
            owner_username: "bob",
            name: "Updated Shared",
            description: null,
            criteria_json: { condition: "heart failure" },
            visibility: "shared",
            created_at: "2026-04-10T00:00:00.000Z",
            updated_at: "2026-04-10T01:00:00.000Z",
            is_owner: false,
            access_can_view: true,
            access_can_run: true,
            access_can_edit: true,
          },
        ],
      });

    const result = await updateAccessibleSavedSearch(
      8,
      5,
      {
        name: "Updated Shared",
        description: null,
        criteriaJson: { condition: "heart failure" },
        visibility: "shared",
      },
      true,
      true
    );

    expect(result.name).toBe("Updated Shared");
  });

  it("rejects update branches for missing, forbidden, duplicate, and invisible updated rows", async () => {
    mockPool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    await expect(updateAccessibleSavedSearch(8, 5, validUpsert(), false, true)).rejects.toThrow("SAVED_SEARCH_NOT_FOUND");

    mockPool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [savedSearchRow({ is_owner: false, access_can_edit: false })],
    });
    await expect(updateAccessibleSavedSearch(8, 5, validUpsert(), true, true)).rejects.toThrow("SAVED_SEARCH_FORBIDDEN");

    mockPool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [savedSearchRow({ is_owner: true })] })
      .mockRejectedValueOnce({
        code: "23505",
        constraint: "saved_searches_owner_canonical_key_unique",
      });
    await expect(updateAccessibleSavedSearch(8, 5, validUpsert(), false, true)).rejects.toThrow("DUPLICATE_SAVED_SEARCH");

    mockPool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [savedSearchRow({ is_owner: true })] })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    await expect(updateAccessibleSavedSearch(8, 5, validUpsert(), false, true)).rejects.toThrow("SAVED_SEARCH_NOT_FOUND");

    mockPool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [savedSearchRow({ is_owner: false, access_can_edit: true, access_can_view: false })] })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1, rows: [savedSearchRow({ is_owner: false, access_can_edit: false, access_can_view: false })] });
    await expect(updateAccessibleSavedSearch(8, 5, validUpsert(), true, false)).rejects.toThrow("SAVED_SEARCH_NOT_FOUND");
  });

  it("rejects duplicate canonical search creation for the same owner", async () => {
    mockPool.query.mockRejectedValueOnce({
      code: "23505",
      constraint: "saved_searches_owner_canonical_key_unique",
    });

    await expect(
      createSavedSearch(7, "alice", {
        name: "Duplicate",
        description: null,
        criteriaJson: { condition: "diabetes" },
        visibility: "private",
      })
    ).rejects.toThrow("DUPLICATE_SAVED_SEARCH");
  });

  it("deletes an owned saved search", async () => {
    mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

    await deleteOwnedSavedSearch(12, 7);

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM saved_searches"),
      [12, 7]
    );
  });

  it("treats undefined delete row counts as not found after lookup miss", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rowCount: undefined })
      .mockResolvedValueOnce({ rowCount: undefined, rows: [] });

    await expect(deleteOwnedSavedSearch(12, 7)).rejects.toThrow("SAVED_SEARCH_NOT_FOUND");
  });

  it("rejects deleting another user's saved search", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ owner_user_id: 9 }],
      });

    await expect(deleteOwnedSavedSearch(12, 7)).rejects.toThrow("SAVED_SEARCH_FORBIDDEN");
  });

  it("returns not found when deleting a missing saved search", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      });

    await expect(deleteOwnedSavedSearch(12, 7)).rejects.toThrow("SAVED_SEARCH_NOT_FOUND");
  });

  it("shares a saved search and forces view access when run permission is granted", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ owner_user_id: 7 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 9, username: "bob" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            saved_search_id: 12,
            user_id: 9,
            can_view: true,
            can_run: true,
            can_edit: false,
            created_at: "2026-04-10T00:00:00.000Z",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    const result = await shareSavedSearch(12, 7, {
      username: " bob ",
      canView: false,
      canRun: true,
      canEdit: false,
    });

    expect(mockPool.query.mock.calls[2][1]).toEqual([12, 9, true, true, false]);
    expect(result).toEqual({
      savedSearchId: 12,
      userId: 9,
      username: "bob",
      canView: true,
      canRun: true,
      canEdit: false,
      createdAt: "2026-04-10T00:00:00.000Z",
    });
  });

  it("forces view access when edit permission is granted", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ owner_user_id: 7 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 9, username: "bob" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            saved_search_id: 12,
            user_id: 9,
            can_view: true,
            can_run: false,
            can_edit: true,
            created_at: "2026-04-10T00:00:00.000Z",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    await shareSavedSearch(12, 7, {
      username: "bob",
      canView: false,
      canRun: false,
      canEdit: true,
    });

    expect(mockPool.query.mock.calls[2][1]).toEqual([12, 9, true, false, true]);
  });

  it("rejects invalid share targets", async () => {
    mockPool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    await expect(
      shareSavedSearch(12, 7, { username: "bob", canView: true, canRun: false, canEdit: false })
    ).rejects.toThrow("SAVED_SEARCH_NOT_FOUND");

    mockPool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ owner_user_id: 8 }] });
    await expect(
      shareSavedSearch(12, 7, { username: "bob", canView: true, canRun: false, canEdit: false })
    ).rejects.toThrow("SAVED_SEARCH_FORBIDDEN");

    mockPool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ owner_user_id: 7 }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    await expect(
      shareSavedSearch(12, 7, { username: "missing", canView: true, canRun: false, canEdit: false })
    ).rejects.toThrow("TARGET_USER_NOT_FOUND");

    mockPool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ owner_user_id: 7 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 7, username: "alice" }] });
    await expect(
      shareSavedSearch(12, 7, { username: "alice", canView: true, canRun: false, canEdit: false })
    ).rejects.toThrow("TARGET_USER_INVALID");
  });

  it("runs an owned saved search, records a run, and snapshots up to ten studies", async () => {
    const studies = Array.from({ length: 12 }, (_, index) => ({
      protocolSection: {
        identificationModule: {
          nctId: `NCT${String(index + 1).padStart(8, "0")}`,
          briefTitle: `Trial ${index + 1}`,
        },
        statusModule: {},
        designModule: {},
        conditionsModule: {},
      },
    }));
    vi.mocked(clinicalTrialsService.searchClinicalTrials).mockResolvedValueOnce({
      totalCount: 12,
      studies,
    });
    mockPool.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 12,
            owner_user_id: 7,
            owner_username: "alice",
            name: "Saved",
            description: null,
            criteria_json: JSON.stringify({
              condition: "Diabetes",
              phase: "Phase 2",
              interventionModel: "Parallel Assignment",
              sex: "Female",
            }),
            visibility: "private",
            created_at: "2026-04-10T00:00:00.000Z",
            updated_at: "2026-04-10T00:00:00.000Z",
            is_owner: true,
            access_can_view: false,
            access_can_run: false,
            access_can_edit: false,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 20,
            saved_search_id: 12,
            run_by_user_id: 7,
            source: "scheduled",
            result_count: 12,
            executed_at: "2026-04-11T00:00:00.000Z",
          },
        ],
      });
    for (let i = 0; i < 10; i++) {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });
    }

    const result = await runSavedSearch(12, 7, false, false, "scheduled");

    expect(clinicalTrialsService.searchClinicalTrials).toHaveBeenCalledWith({
      condition: "Diabetes",
      phase: "PHASE2",
      interventionModel: "PARALLEL",
      sex: "FEMALE",
    });
    expect(result.run).toEqual({
      id: 20,
      savedSearchId: 12,
      runByUserId: 7,
      source: "scheduled",
      resultCount: 12,
      executedAt: "2026-04-11T00:00:00.000Z",
      snapshotCount: 10,
    });
    expect(mockPool.query.mock.calls.filter(([sql]) => String(sql).includes("saved_search_snapshots"))).toHaveLength(10);
  });

  it("rejects running inaccessible or invalid saved searches", async () => {
    mockPool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    await expect(runSavedSearch(12, 7, true, true)).rejects.toThrow("SAVED_SEARCH_NOT_FOUND");

    mockPool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: 12,
          owner_user_id: 8,
          owner_username: "bob",
          name: "Shared",
          description: null,
          criteria_json: { condition: "diabetes" },
          visibility: "shared",
          created_at: "2026-04-10T00:00:00.000Z",
          updated_at: "2026-04-10T00:00:00.000Z",
          is_owner: false,
          access_can_view: true,
          access_can_run: false,
          access_can_edit: false,
        },
      ],
    });
    await expect(runSavedSearch(12, 7, true, false)).rejects.toThrow("SAVED_SEARCH_FORBIDDEN");

    mockPool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: 12,
          owner_user_id: 7,
          owner_username: "alice",
          name: "Invalid",
          description: null,
          criteria_json: {},
          visibility: "private",
          created_at: "2026-04-10T00:00:00.000Z",
          updated_at: "2026-04-10T00:00:00.000Z",
          is_owner: true,
          access_can_view: true,
          access_can_run: true,
          access_can_edit: true,
        },
      ],
    });
    await expect(runSavedSearch(12, 7, false, false)).rejects.toThrow("SAVED_SEARCH_CRITERIA_INVALID:");
  });

  it("runs a shared saved search when run permission is allowed and preserves unknown runtime labels", async () => {
    vi.mocked(clinicalTrialsService.searchClinicalTrials).mockResolvedValueOnce({
      totalCount: 0,
      studies: [],
    });
    mockPool.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          savedSearchRow({
            id: 12,
            owner_user_id: 8,
            owner_username: "bob",
            is_owner: false,
            access_can_view: false,
            access_can_run: true,
            access_can_edit: false,
            criteria_json: {
              condition: "Diabetes",
              phase: "custom phase",
              interventionModel: "custom model",
              sex: "other",
            },
          }),
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 30,
            saved_search_id: 12,
            run_by_user_id: 7,
            source: "manual",
            result_count: 0,
            executed_at: "2026-04-11T00:00:00.000Z",
          },
        ],
      });

    const result = await runSavedSearch(12, 7, true, true);

    expect(clinicalTrialsService.searchClinicalTrials).toHaveBeenCalledWith({
      condition: "Diabetes",
      phase: "CUSTOM PHASE",
      interventionModel: "CUSTOM MODEL",
      sex: "OTHER",
    });
    expect(result.savedSearch.permissions.canRun).toBe(true);
  });
});

function validUpsert() {
  return {
    name: "Updated",
    description: null,
    criteriaJson: { condition: "diabetes" },
    visibility: "private" as const,
  };
}

function savedSearchRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 8,
    owner_user_id: 7,
    owner_username: "alice",
    name: "Saved",
    description: null,
    criteria_json: { condition: "diabetes" },
    visibility: "private",
    created_at: "2026-04-10T00:00:00.000Z",
    updated_at: "2026-04-10T00:00:00.000Z",
    is_owner: true,
    access_can_view: true,
    access_can_run: true,
    access_can_edit: true,
    ...overrides,
  };
}
