import { afterEach, describe, expect, it, vi } from "vitest";

describe("AiProviderStatusService", () => {
  const fetchMock = vi.fn();

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("reports missing keys without checking providers", async () => {
    vi.stubGlobal("fetch", fetchMock);
    const { getAiProviderConfigurationStatus, getAiProviderStatuses } = await import("./AiProviderStatusService");

    expect(getAiProviderConfigurationStatus().anthropic).toMatchObject({
      configured: false,
      reachable: false,
      error: "API key is not configured.",
    });

    const statuses = await getAiProviderStatuses({ forceRefresh: true });
    expect(statuses.voyage.configured).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks configured providers and reuses cached statuses", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("VOYAGE_API_KEY", "voyage-key");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({ ok: true });
    const { getAiProviderConfigurationStatus, getAiProviderStatuses } = await import("./AiProviderStatusService");

    expect(getAiProviderConfigurationStatus().voyage).toMatchObject({
      configured: true,
      reachable: null,
      error: null,
    });

    const first = await getAiProviderStatuses({ forceRefresh: true });
    const second = await getAiProviderStatuses();

    expect(first.anthropic.reachable).toBe(true);
    expect(first.voyage.reachable).toBe(true);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns provider-specific HTTP errors", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("VOYAGE_API_KEY", "voyage-key");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: false, status: 503 });
    const { getAiProviderStatuses } = await import("./AiProviderStatusService");

    const statuses = await getAiProviderStatuses({ forceRefresh: true });

    expect(statuses.anthropic).toMatchObject({
      configured: true,
      reachable: false,
      error: "Anthropic check failed with HTTP 401.",
    });
    expect(statuses.voyage).toMatchObject({
      configured: true,
      reachable: false,
      error: "Voyage check failed with HTTP 503.",
    });
  });

  it("sanitizes thrown provider check failures", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("VOYAGE_API_KEY", "voyage-key");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock
      .mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockRejectedValueOnce("not an error");
    const { getAiProviderStatuses } = await import("./AiProviderStatusService");

    const statuses = await getAiProviderStatuses({ forceRefresh: true });

    expect(statuses.anthropic.error).toBe("TypeError: network unavailable");
    expect(statuses.voyage.error).toBe("Unknown provider check failure.");
  });
});
