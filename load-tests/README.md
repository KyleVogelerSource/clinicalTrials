# Load Tests

These scripts use [k6](https://k6.io/docs/get-started/installation/) to exercise the app under concurrent usage.

Run them from the repository root.

You can either install k6 locally or use the Docker Compose `k6` service.

## Install k6

Mac:

```bash
brew install k6
```

Linux:

```bash
sudo gpg -k
curl -s https://dl.k6.io/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/k6-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt update
sudo apt install k6
```

## Safe Local Smoke Test

This test does not call external AI providers or ClinicalTrials.gov. It is the best first test after `docker compose up`.

With Docker Compose:

```bash
docker compose --profile load-test run --rm k6
```

With a local k6 install:

```bash
k6 run load-tests/smoke-local.js
```

Use a different target:

```bash
BASE_URL=https://your-backend-url k6 run load-tests/smoke-local.js
```

## ClinicalTrials.gov API Scenario

This scenario calls backend search endpoints that depend on ClinicalTrials.gov. Keep the load modest.

```bash
k6 run load-tests/search-api.js
```

Useful overrides:

```bash
BASE_URL=http://localhost:3000 VUS=10 DURATION=2m k6 run load-tests/search-api.js
```

With Docker Compose:

```bash
K6_SCRIPT=search-api.js K6_VUS=10 K6_DURATION=2m docker compose --profile load-test run --rm k6
```

## AI Benchmark Scenario

This scenario calls `/api/clinical-trials/benchmark`, which can invoke Voyage and Anthropic. It is gated so it does not run by accident.

Run only when you intentionally want to test provider-backed benchmarking:

```bash
ENABLE_AI_BENCHMARK=true VUS=1 DURATION=30s k6 run load-tests/benchmark-ai.js
```

With Docker Compose:

```bash
K6_SCRIPT=benchmark-ai.js ENABLE_AI_BENCHMARK=true K6_VUS=1 K6_DURATION=30s docker compose --profile load-test run --rm k6
```

Use low concurrency because this can create provider cost and rate-limit failures. The backend must have `ANTHROPIC_API_KEY` and `VOYAGE_API_KEY` configured.

## Common Environment Variables

- `BASE_URL`: backend base URL, default `http://localhost:3000`
- `VUS`: number of virtual users
- `DURATION`: steady-state test duration
- `K6_SCRIPT`: Docker Compose script name, default `smoke-local.js`
- `K6_VUS`: Docker Compose virtual user count
- `K6_DURATION`: Docker Compose steady-state test duration

## Pull Request and Main Validation

`.github/workflows/load-tests-ci.yml` validates the Docker Compose configuration, inspects the k6 scripts, and runs the safe smoke test against a local backend stack on pull requests and pushes to `main`. It does not run the ClinicalTrials.gov search scenario or the AI benchmark scenario in CI, so it avoids external API traffic and provider cost.
