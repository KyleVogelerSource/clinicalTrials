import { afterEach, describe, expect, it, vi } from "vitest";
import { generateEmbeddings } from "./TrialEmbeddingService";

describe("TrialEmbeddingService", () => {
  const fetchMock = vi.fn();

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("requests Voyage embeddings and maps sorted response indexes back to input ids", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: [
          { index: 1, embedding: [0, 1] },
          { index: 0, embedding: [1, 0] },
        ],
      }),
    });

    const result = await generateEmbeddings(
      [
        { nctId: "NCT000001", synopsis: "first" },
        { nctId: "NCT000002", synopsis: "second" },
      ],
      "voyage-key"
    );

    expect(result.embeddings).toEqual([
      { nctId: "NCT000001", embedding: [1, 0] },
      { nctId: "NCT000002", embedding: [0, 1] },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.voyageai.com/v1/embeddings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer voyage-key" }),
        body: expect.stringContaining("\"input\":[\"first\",\"second\"]"),
      })
    );
  });

  it("splits requests into batches and fills failed batches with zero vectors", async () => {
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: Array.from({ length: 128 }, (_, index) => ({
            index,
            embedding: [index, index + 1],
          })),
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: vi.fn().mockResolvedValue("unavailable"),
      });

    const result = await generateEmbeddings(
      Array.from({ length: 129 }, (_, index) => ({
        nctId: `NCT${String(index).padStart(6, "0")}`,
        synopsis: `trial ${index}`,
      })),
      "voyage-key"
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.embeddings).toHaveLength(129);
    expect(result.embeddings[127].embedding).toEqual([127, 128]);
    expect(result.embeddings[128].embedding).toEqual([0, 0]);
  });

  it("uses the default embedding dimension when every batch fails", async () => {
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    fetchMock.mockRejectedValueOnce(new Error("network down"));

    const result = await generateEmbeddings([{ nctId: "NCT000001", synopsis: "first" }], "voyage-key");

    expect(result.embeddings[0].embedding).toHaveLength(1024);
    expect(result.embeddings[0].embedding.every((value) => value === 0)).toBe(true);
  });
});
