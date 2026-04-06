#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const inputs = {
  backend: {
    coverage: path.join(repoRoot, 'backend/coverage/coverage-summary.json'),
    tests: path.join(repoRoot, 'backend/coverage/test-results.json'),
    coverageHtml: 'backend/coverage/index.html',
  },
  frontend: {
    coverage: path.join(repoRoot, 'frontend/coverage/frontend/coverage-summary.json'),
    tests: path.join(repoRoot, 'frontend/coverage/frontend/test-results.json'),
    coverageHtml: 'frontend/coverage/frontend/index.html',
  },
};

const outputDir = path.join(repoRoot, 'reports');
const outputFile = path.join(outputDir, 'test-coverage-dashboard.html');

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function metric(summary, key) {
  const value = summary.total?.[key];
  if (!value) {
    return { total: 0, covered: 0, pct: 0 };
  }

  const pct = typeof value.pct === 'number' ? value.pct : Number(value.pct) || 0;
  return {
    total: value.total ?? 0,
    covered: value.covered ?? 0,
    pct,
  };
}

function projectData(label, cfg) {
  const coverage = readJson(cfg.coverage);
  const tests = readJson(cfg.tests);

  const lines = metric(coverage, 'lines');
  const statements = metric(coverage, 'statements');
  const functions = metric(coverage, 'functions');
  const branches = metric(coverage, 'branches');

  const totalTests = tests.numTotalTests ?? 0;
  const passedTests = tests.numPassedTests ?? 0;
  const failedTests = tests.numFailedTests ?? 0;
  const passRate = totalTests === 0 ? 0 : (passedTests / totalTests) * 100;

  return {
    label,
    coverageHtml: cfg.coverageHtml,
    tests: {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      passRate,
    },
    metrics: [
      { name: 'Lines', ...lines },
      { name: 'Statements', ...statements },
      { name: 'Functions', ...functions },
      { name: 'Branches', ...branches },
    ],
  };
}

function pctText(value) {
  return `${value.toFixed(2)}%`;
}

function barClass(pct) {
  if (pct >= 80) return 'good';
  if (pct >= 60) return 'medium';
  return 'low';
}

function projectCard(project) {
  const metricRows = project.metrics
    .map((m) => {
      const uncovered = Math.max(m.total - m.covered, 0);
      return `
        <div class="metric-row">
          <div class="metric-head">
            <span class="metric-name">${m.name}</span>
            <span class="metric-values">${m.covered}/${m.total} (${pctText(m.pct)})</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill ${barClass(m.pct)}" style="width: ${Math.max(0, Math.min(100, m.pct))}%;"></div>
          </div>
          <div class="metric-foot">Uncovered: ${uncovered}</div>
        </div>
      `;
    })
    .join('');

  return `
    <section class="card">
      <header class="card-header">
        <h2>${project.label}</h2>
        <a href="../${project.coverageHtml}" target="_blank" rel="noopener noreferrer">Open HTML coverage report</a>
      </header>

      <div class="test-strip">
        <div class="stat">
          <span class="label">Total tests</span>
          <span class="value">${project.tests.total}</span>
        </div>
        <div class="stat">
          <span class="label">Passed</span>
          <span class="value pass">${project.tests.passed}</span>
        </div>
        <div class="stat">
          <span class="label">Failed</span>
          <span class="value fail">${project.tests.failed}</span>
        </div>
        <div class="stat">
          <span class="label">Pass rate</span>
          <span class="value">${pctText(project.tests.passRate)}</span>
        </div>
      </div>

      <div class="metrics">
        ${metricRows}
      </div>
    </section>
  `;
}

function buildHtml(data) {
  const now = new Date().toISOString();
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ClinicalTrials Test and Coverage Dashboard</title>
    <style>
      :root {
        --bg: #f3efe7;
        --ink: #1f2a44;
        --card: #fffdf8;
        --line: #d9d0c0;
        --good: #1b8a5a;
        --medium: #db7a22;
        --low: #b7342b;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Trebuchet MS", "Segoe UI", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 20% 15%, #f8d9a030 0%, transparent 45%),
          radial-gradient(circle at 80% 20%, #7aa5b530 0%, transparent 45%),
          var(--bg);
      }

      .wrap {
        max-width: 1100px;
        margin: 0 auto;
        padding: 32px 18px 48px;
      }

      h1 {
        margin: 0;
        font-size: clamp(1.5rem, 3vw, 2.4rem);
        letter-spacing: 0.02em;
      }

      .subtitle {
        margin: 8px 0 24px;
        font-size: 0.95rem;
        opacity: 0.8;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 18px;
      }

      .card {
        border: 1px solid var(--line);
        border-radius: 16px;
        background: var(--card);
        box-shadow: 0 10px 24px #00000014;
        overflow: hidden;
      }

      .card-header {
        padding: 16px 16px 10px;
        border-bottom: 1px solid var(--line);
      }

      .card-header h2 {
        margin: 0 0 8px;
        font-size: 1.25rem;
      }

      .card-header a {
        color: #0a4f8f;
        text-decoration: none;
        font-size: 0.9rem;
      }

      .card-header a:hover { text-decoration: underline; }

      .test-strip {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        padding: 14px 16px;
      }

      .stat {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 8px;
        background: #fff;
      }

      .stat .label {
        display: block;
        font-size: 0.72rem;
        opacity: 0.8;
        margin-bottom: 4px;
      }

      .stat .value {
        font-size: 1.05rem;
        font-weight: 700;
      }

      .stat .pass { color: var(--good); }
      .stat .fail { color: var(--low); }

      .metrics {
        padding: 4px 16px 16px;
      }

      .metric-row {
        margin: 10px 0 12px;
      }

      .metric-head {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        font-size: 0.9rem;
      }

      .metric-name { font-weight: 700; }
      .metric-values { opacity: 0.9; }

      .bar-track {
        margin-top: 6px;
        height: 12px;
        border-radius: 999px;
        background: #e8e0d2;
        overflow: hidden;
      }

      .bar-fill { height: 100%; }
      .bar-fill.good { background: var(--good); }
      .bar-fill.medium { background: var(--medium); }
      .bar-fill.low { background: var(--low); }

      .metric-foot {
        margin-top: 4px;
        font-size: 0.75rem;
        opacity: 0.75;
      }

      @media (max-width: 700px) {
        .test-strip {
          grid-template-columns: repeat(2, 1fr);
        }
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <h1>Test and Coverage Dashboard</h1>
      <p class="subtitle">Generated: ${now}</p>
      <div class="grid">
        ${data.map(projectCard).join('')}
      </div>
    </main>
  </body>
</html>`;
}

function main() {
  const backend = projectData('Backend', inputs.backend);
  const frontend = projectData('Frontend', inputs.frontend);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, buildHtml([backend, frontend]), 'utf8');

  console.log(`Dashboard generated: ${path.relative(repoRoot, outputFile)}`);
}

main();
