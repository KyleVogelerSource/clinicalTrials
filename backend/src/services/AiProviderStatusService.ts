const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3";
const STATUS_CACHE_TTL_MS = 5 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 5000;

type AiProviderName = "anthropic" | "voyage";

export interface AiProviderStatus {
  configured: boolean;
  reachable: boolean | null;
  checkedAt: string | null;
  error: string | null;
}

export interface AiProviderStatuses {
  anthropic: AiProviderStatus;
  voyage: AiProviderStatus;
}

interface AiProviderStatusOptions {
  forceRefresh?: boolean;
}

interface CachedProviderStatus {
  expiresAt: number;
  status: AiProviderStatus;
}

const statusCache: Partial<Record<AiProviderName, CachedProviderStatus>> = {};

function configuredStatus(): AiProviderStatus {
  return {
    configured: true,
    reachable: null,
    checkedAt: null,
    error: null,
  };
}

function missingStatus(): AiProviderStatus {
  return {
    configured: false,
    reachable: false,
    checkedAt: new Date().toISOString(),
    error: "API key is not configured.",
  };
}

function sanitizeProviderError(err: unknown): string {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}`;
  }
  return "Unknown provider check failure.";
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkAnthropic(apiKey: string): Promise<AiProviderStatus> {
  const response = await fetchWithTimeout(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    }),
  });

  if (!response.ok) {
    return {
      configured: true,
      reachable: false,
      checkedAt: new Date().toISOString(),
      error: `Anthropic check failed with HTTP ${response.status}.`,
    };
  }

  return {
    configured: true,
    reachable: true,
    checkedAt: new Date().toISOString(),
    error: null,
  };
}

async function checkVoyage(apiKey: string): Promise<AiProviderStatus> {
  const response = await fetchWithTimeout(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: ["ping"],
      input_type: "document",
    }),
  });

  if (!response.ok) {
    return {
      configured: true,
      reachable: false,
      checkedAt: new Date().toISOString(),
      error: `Voyage check failed with HTTP ${response.status}.`,
    };
  }

  return {
    configured: true,
    reachable: true,
    checkedAt: new Date().toISOString(),
    error: null,
  };
}

async function getCachedProviderStatus(
  provider: AiProviderName,
  apiKey: string,
  check: (apiKey: string) => Promise<AiProviderStatus>,
  options: AiProviderStatusOptions = {}
): Promise<AiProviderStatus> {
  if (!apiKey) {
    delete statusCache[provider];
    return missingStatus();
  }

  const cached = statusCache[provider];
  if (!options.forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.status;
  }

  try {
    const status = await check(apiKey);
    statusCache[provider] = {
      status,
      expiresAt: Date.now() + STATUS_CACHE_TTL_MS,
    };
    return status;
  } catch (err) {
    const status: AiProviderStatus = {
      configured: true,
      reachable: false,
      checkedAt: new Date().toISOString(),
      error: sanitizeProviderError(err),
    };
    statusCache[provider] = {
      status,
      expiresAt: Date.now() + STATUS_CACHE_TTL_MS,
    };
    return status;
  }
}

export async function getAiProviderStatuses(options: AiProviderStatusOptions = {}): Promise<AiProviderStatuses> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? "";
  const voyageKey = process.env.VOYAGE_API_KEY ?? "";

  const [anthropic, voyage] = await Promise.all([
    getCachedProviderStatus("anthropic", anthropicKey, checkAnthropic, options),
    getCachedProviderStatus("voyage", voyageKey, checkVoyage, options),
  ]);

  return { anthropic, voyage };
}

export function getAiProviderConfigurationStatus(): AiProviderStatuses {
  return {
    anthropic: process.env.ANTHROPIC_API_KEY ? configuredStatus() : missingStatus(),
    voyage: process.env.VOYAGE_API_KEY ? configuredStatus() : missingStatus(),
  };
}
