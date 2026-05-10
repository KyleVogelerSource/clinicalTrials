import { describe, expect, it } from "vitest";
import { validateSavedSearchShareRequest, validateSavedSearchUpsertRequest } from "./SavedSearchValidator";

describe("SavedSearchValidator", () => {
  describe("validateSavedSearchUpsertRequest", () => {
    it("accepts a valid saved search upsert request", () => {
      const result = validateSavedSearchUpsertRequest({
        name: "Diabetes trials",
        description: "Relevant criteria",
        visibility: "private",
        criteriaJson: {
          condition: "diabetes",
          pageSize: 25,
        },
      });

      expect(result).toEqual({ valid: true, errors: [] });
    });

    it("rejects missing and malformed top-level fields", () => {
      const result = validateSavedSearchUpsertRequest({
        name: " ",
        description: 10 as unknown as string,
        visibility: "public" as "private",
        criteriaJson: [] as unknown as Record<string, never>,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          { field: "name", message: "name is required." },
          { field: "description", message: "description must be a string when provided." },
          { field: "visibility", message: "visibility must be either 'private' or 'shared'." },
          { field: "criteriaJson", message: "criteriaJson is required and must be an object." },
        ])
      );
    });

    it("rejects overlong names", () => {
      const result = validateSavedSearchUpsertRequest({
        name: "x".repeat(201),
        visibility: "shared",
        criteriaJson: { condition: "asthma" },
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: "name",
        message: "name cannot exceed 200 characters.",
      });
    });

    it("prefixes nested search criteria validation errors", () => {
      const result = validateSavedSearchUpsertRequest({
        name: "Invalid criteria",
        visibility: "private",
        criteriaJson: {
          pageSize: 101,
        },
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((error) => error.field.startsWith("criteriaJson."))).toBe(true);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "criteriaJson.pageSize" }),
        ])
      );
    });
  });

  describe("validateSavedSearchShareRequest", () => {
    it("accepts a valid share request", () => {
      const result = validateSavedSearchShareRequest({
        username: "alice",
        canView: true,
        canRun: false,
        canEdit: true,
      });

      expect(result).toEqual({ valid: true, errors: [] });
    });

    it("requires a username and boolean permissions", () => {
      const result = validateSavedSearchShareRequest({
        username: "",
        canView: "yes" as unknown as boolean,
        canRun: undefined,
        canEdit: null as unknown as boolean,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([
        { field: "username", message: "username is required." },
        { field: "canView", message: "canView must be a boolean." },
        { field: "canRun", message: "canRun must be a boolean." },
        { field: "canEdit", message: "canEdit must be a boolean." },
      ]);
    });
  });
});
