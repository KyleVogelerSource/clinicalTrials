const anthropicApiUrl = "https://api.anthropic.com/v1/messages";
const anthropicModel = "claude-sonnet-4-20250514";
const voyageApiUrl = "https://api.voyageai.com/v1/embeddings";
const voyageModel = "voyage-3";
const timeoutMs = 10000;

const requireSecrets = process.env.REQUIRE_AI_PROVIDER_SECRETS !== "false";

function fail(message) {
  console.error(`::error title=AI provider secret validation failed::${message}`);
  process.exitCode = 1;
}

async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function validateAnthropic(apiKey) {
  const response = await fetchWithTimeout(anthropicApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: anthropicModel,
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic returned HTTP ${response.status}`);
  }
}

async function validateVoyage(apiKey) {
  const response = await fetchWithTimeout(voyageApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: voyageModel,
      input: ["ping"],
      input_type: "document",
    }),
  });

  if (!response.ok) {
    throw new Error(`Voyage returned HTTP ${response.status}`);
  }
}

const anthropicKey = process.env.ANTHROPIC_API_KEY ?? "";
const voyageKey = process.env.VOYAGE_API_KEY ?? "";

if (!anthropicKey || !voyageKey) {
  const missing = [
    anthropicKey ? null : "ANTHROPIC_API_KEY",
    voyageKey ? null : "VOYAGE_API_KEY",
  ].filter(Boolean);

  if (requireSecrets) {
    fail(`Missing required GitHub secret(s): ${missing.join(", ")}`);
  } else {
    console.log(`Skipping live AI provider validation because GitHub did not expose secret(s): ${missing.join(", ")}`);
  }

  process.exit();
}

const checks = [
  ["Anthropic", validateAnthropic(anthropicKey)],
  ["Voyage", validateVoyage(voyageKey)],
];

for (const [name, check] of checks) {
  try {
    await check;
    console.log(`${name} API key validated`);
  } catch (err) {
    fail(`${name} validation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}
