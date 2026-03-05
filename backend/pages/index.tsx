export default function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1>🏥 Clinical Trials Backend API</h1>
      <p style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>
        Next.js backend implementing the full ClinicalTrials.gov OpenAPI v2 interface
      </p>

      <section style={{ marginBottom: '2rem' }}>
        <h2>📚 Core Endpoints</h2>
        <ul>
          <li><code>/api/studies</code> - Search and filter clinical trials with advanced filters</li>
          <li><code>/api/studies/[nctId]</code> - Get detailed study information by NCT ID</li>
          <li><code>/api/studies/metadata</code> - Get available metadata and search parameters</li>
          <li><code>/api/studies/search-areas</code> - Available search areas for filtering</li>
          <li><code>/api/studies/enums</code> - Enum values for dropdowns (Status, Phase, StudyType, etc.)</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>📊 Statistics Endpoints</h2>
        <ul>
          <li><code>/api/stats/size</code> - Total number of studies in database</li>
          <li><code>/api/stats/field/values</code> - Field value frequencies and statistics</li>
          <li><code>/api/stats/field/sizes</code> - Field size/availability statistics</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>🔧 Utility Endpoints</h2>
        <ul>
          <li><code>/api/version</code> - API version and data timestamp</li>
          <li><code>/api/health</code> - Backend health check</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Quick Start Examples</h2>
        <pre style={{ 
          backgroundColor: '#f5f5f5', 
          padding: '1rem', 
          borderRadius: '4px',
          overflowX: 'auto'
        }}>
{`# Search for diabetes studies
curl http://localhost:3001/api/studies?condition=diabetes&pageSize=10

# Get specific study
curl http://localhost:3001/api/studies/NCT05123456

# Get recruiting Phase 2 studies
curl "http://localhost:3001/api/studies?overallStatus=RECRUITING&phase=PHASE2"

# Get enum values for dropdowns
curl http://localhost:3001/api/studies/enums

# Check API version
curl http://localhost:3001/api/version
`}
        </pre>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>📖 Documentation</h2>
        <p>
          See <code>API_DOCUMENTATION.md</code> for comprehensive documentation including:
        </p>
        <ul>
          <li>All endpoint parameters and response formats</li>
          <li>Query syntax for advanced searches</li>
          <li>Complete study data structure reference</li>
          <li>TypeScript model definitions</li>
          <li>Error handling</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>🏗️ Architecture</h2>
        <ul>
          <li><strong>Models:</strong> Complete TypeScript interfaces in <code>/src/clinicalTrials/models/</code></li>
          <li><strong>Services:</strong> API client in <code>/src/clinicalTrials/services/ClinicalTrialsApiClient.ts</code></li>
          <li><strong>API Routes:</strong> Express-like endpoints in <code>/pages/api/</code></li>
        </ul>
      </section>

      <section>
        <h2>🔗 References</h2>
        <ul>
          <li><a href="https://clinicaltrials.gov/data-api/api" target="_blank" rel="noopener noreferrer">
            ClinicalTrials.gov Data API
          </a></li>
          <li><a href="https://clinicaltrials.gov/data-api/about-api" target="_blank" rel="noopener noreferrer">
            API Documentation
          </a></li>
          <li><a href="https://clinicaltrials.gov/data-api/about-api/study-data-structure" target="_blank" rel="noopener noreferrer">
            Study Data Structure
          </a></li>
        </ul>
      </section>
    </div>
  )
}
