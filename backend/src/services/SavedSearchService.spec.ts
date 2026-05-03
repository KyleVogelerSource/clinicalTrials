import { beforeEach, describe, expect, it, vi } from "vitest";
import * as postgresClient from "../storage/PostgresClient";
import {
  createSavedSearch,
  deleteOwnedSavedSearch,
  getAccessibleSavedSearch,
  listOwnedSavedSearches,
  listSharedSavedSearches,
  updateAccessibleSavedSearch,
} from "./SavedSearchService";

vi.mock("../storage/PostgresClient");

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
});
