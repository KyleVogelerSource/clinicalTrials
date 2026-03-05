# Clinical Trials Backend API

This Next.js backend implements a full proxy/wrapper around the [ClinicalTrials.gov OpenAPI](https://clinicaltrials.gov/data-api/api).

## Features

✅ Full OpenAPI v2 support for Clinical Trials.gov API  
✅ TypeScript models for all study data structures  
✅ Comprehensive search and filtering capabilities  
✅ Statistics endpoints  
✅ Enum/metadata endpoints  
✅ RESTful API interface  

## Architecture

### Components

1. **Models** (`/src/clinicalTrials/models/`)
   - `StudyModels.ts` - Complete TypeScript interfaces for all study data structures
   - Based on the official ClinicalTrials.gov data structure documentation

2. **Services** (`/src/clinicalTrials/services/`)
   - `ClinicalTrialsApiClient.ts` - HTTP client functions for the upstream API
   - Handles query building, filtering, and error handling

3. **API Endpoints** (`/pages/api/`)
   - REST endpoints that proxy to ClinicalTrials.gov API
   - Request validation and error handling
   - JSON response formatting

4. **DTOs** (`/src/clinicalTrials/dto/`)
   - `ClinicalTrialSearchRequest.ts` - Search request structure

## API Endpoints

### Studies Endpoints

#### GET `/api/studies`
Search and filter clinical trials with advanced query capabilities.

**Query Parameters:**
```
// Query/Search Filters
query: string               - Raw query string (e.g., "CONDITION(diabetes) AND PHASE(Phase 2)")
term: string               - Free-text search term
condition: string          - Condition/disease filter
intervention: string       - Intervention/treatment filter
sponsor: string            - Sponsor organization filter
investigator: string       - Investigator name filter
location: string           - Location filter

// Status/Type Filters
overallStatus: string      - Recruitment status (RECRUITING, COMPLETED, etc.)
studyType: string          - Study type (INTERVENTIONAL, OBSERVATIONAL, EXPANDED_ACCESS)
phase: string              - Study phase (PHASE1, PHASE2, PHASE3, PHASE4, NA, EARLY_PHASE1)
interventionModel: string  - Intervention model
primaryPurpose: string     - Primary purpose (TREATMENT, PREVENTION, DIAGNOSTIC, etc.)
sex: string                - Sex/gender (FEMALE, MALE, ALL)
minAge: number             - Minimum participant age
maxAge: number             - Maximum participant age
healthyVolunteers: boolean - Whether healthy volunteers are accepted

// Date Range Filters
startDateFrom: string      - Start date from (YYYY-MM-DD)
startDateTo: string        - Start date to (YYYY-MM-DD)
completionDateFrom: string - Completion date from (YYYY-MM-DD)
completionDateTo: string   - Completion date to (YYYY-MM-DD)

// Enrollment Filters
minEnrollment: number      - Minimum enrollment
maxEnrollment: number      - Maximum enrollment

// Results Filter
hasResults: boolean        - Only studies with posted results

// Pagination
pageSize: number           - Results per page (max 100)
pageToken: string          - Token for next page
countTotal: boolean        - Include total count in response

// Sorting
sort: string               - Sort order
```

**Example Requests:**

```bash
# Search for diabetes studies
curl http://localhost:3001/api/studies?condition=diabetes&pageSize=10

# Find recruiting Phase 2 studies
curl "http://localhost:3001/api/studies?overallStatus=RECRUITING&phase=PHASE2&pageSize=20"

# Complex query with multiple filters
curl "http://localhost:3001/api/studies?condition=cancer&minAge=18&maxAge=65&healthyVolunteers=false&pageSize=50"

# Raw query syntax
curl "http://localhost:3001/api/studies?query=CONDITION(diabetes)%20AND%20PHASE(Phase%202)"
```

**Response:** 
```json
{
  "data": {
    "studies": [
      {
        "protocolSection": {
          "identificationModule": { /* ... */ },
          "statusModule": { /* ... */ },
          "descriptionModule": { /* ... */ }
          /* ... other modules ... */
        },
        "hasResults": true,
        "resultsSection": { /* ... */ }
      }
    ],
    "nextPageToken": "...",
    "totalCount": 5432
  }
}
```

---

#### GET `/api/studies/[nctId]`
Fetch a specific study by its NCT ID.

**Parameters:**
- `nctId` (path) - National Clinical Trial ID (e.g., NCT05123456)

**Example:**
```bash
curl http://localhost:3001/api/studies/NCT05123456
```

**Response:**
```json
{
  "data": {
    "protocolSection": { /* complete study protocol */ },
    "resultsSection": { /* study results if available */ },
    "derivedSection": { /* derived/computed fields */ },
    "hasResults": true
  }
}
```

---

#### GET `/api/studies/metadata`
Get metadata about available search parameters and fields.

**Example:**
```bash
curl http://localhost:3001/api/studies/metadata
```

**Response:**
```json
{
  "data": {
    "filters": [ /* available filter fields */ ],
    "query": [ /* available query fields */ ]
  }
}
```

---

#### GET `/api/studies/search-areas`
Get available search areas for advanced filtering.

**Example:**
```bash
curl http://localhost:3001/api/studies/search-areas
```

**Response:**
```json
{
  "data": {
    "searchAreas": [
      {
        "name": "Condition",
        "searchableFields": [ /* ... */ ]
      }
      /* ... more search areas ... */
    ]
  }
}
```

---

#### GET `/api/studies/enums`
Get enum values for dropdown fields (Status, Phase, StudyType, etc.).

**Example:**
```bash
curl http://localhost:3001/api/studies/enums
```

**Response:**
```json
{
  "data": {
    "Status": ["ACTIVE_NOT_RECRUITING", "COMPLETED", "ENROLLING_BY_INVITATION", ...],
    "Phase": ["NA", "EARLY_PHASE1", "PHASE1", "PHASE2", "PHASE3", "PHASE4"],
    "StudyType": ["EXPANDED_ACCESS", "INTERVENTIONAL", "OBSERVATIONAL"],
    /* ... more enums ... */
  }
}
```

---

### Statistics Endpoints

#### GET `/api/stats/size`
Get statistics about total number of studies.

**Example:**
```bash
curl http://localhost:3001/api/stats/size
```

**Response:**
```json
{
  "data": {
    "nStudiesReturned": 419426,
    "nStudiesTotal": 419426
  }
}
```

---

#### GET `/api/stats/field/values`
Get statistics about specific field values and their frequency.

**Query Parameters:**
- `fields` (required) - Field name(s) to get values for (e.g., "Status", "Phase")
- `pageSize` (optional) - Results per page
- `pageToken` (optional) - Pagination token

**Example:**
```bash
# Get all status values and their counts
curl "http://localhost:3001/api/stats/field/values?fields=Status"

# Get multiple fields
curl "http://localhost:3001/api/stats/field/values?fields=Status&fields=Phase&pageSize=50"
```

**Response:**
```json
{
  "data": {
    "fieldValues": [
      {
        "name": "Status",
        "values": [
          { "value": "RECRUITING", "count": 8234 },
          { "value": "COMPLETED", "count": 234121 }
          /* ... more values ... */
        ]
      }
    ]
  }
}
```

---

#### GET `/api/stats/field/sizes`
Get statistics about field sizes/data availability.

**Query Parameters:**
- `fields` (required) - Field name(s)
- `pageSize` (optional)
- `pageToken` (optional)

**Example:**
```bash
curl "http://localhost:3001/api/stats/field/sizes?fields=BriefSummary&fields=DetailedDescription"
```

---

### Utility Endpoints

#### GET `/api/version`
Get API version and data timestamp information.

**Example:**
```bash
curl http://localhost:3001/api/version
```

**Response:**
```json
{
  "data": {
    "version": "2.0.0",
    "dataTimestamp": "2024-03-05T14:30:00Z"
  }
}
```

---

#### GET `/api/health`
Health check endpoint for backend availability.

**Example:**
```bash
curl http://localhost:3001/api/health
```

**Response:**
```json
{
  "message": "Backend is running",
  "timestamp": "2024-03-05T14:30:00.000Z"
}
```

---

## Study Data Structure

The API returns comprehensive study data organized in sections:

### Protocol Section
- **identificationModule** - Study identification, title, acronym, organization
- **statusModule** - Study status, dates, recruitment info
- **sponsorCollaboratorsModule** - Sponsor and collaborator information
- **oversightModule** - Oversight, FDA regulations, DMC info
- **descriptionModule** - Brief and detailed summaries
- **conditionsModule** - Conditions and keywords
- **designModule** - Study type, phase, design info, enrollment
- **armsInterventionsModule** - Study arms and interventions
- **outcomesModule** - Primary, secondary, and other outcomes
- **eligibilityModule** - Inclusion/exclusion criteria, age ranges
- **contactsLocationsModule** - Contacts and facility locations
- **referencesModule** - Citations and related links
- **ipdSharingStatementModule** - Individual participant data sharing info

### Results Section
- **participantFlowModule** - Participant flow and milestones
- **baselineCharacteristicsModule** - Baseline data
- **outcomeMeasuresModule** - Outcome measure results
- **adverseEventsModule** - Adverse events data
- **moreInfoModule** - Limitations, agreements, points of contact

### Derived Section
- **conditionBrowseModule** - Medical condition classifications
- **interventionBrowseModule** - Drug/intervention classifications

### Additional Sections
- **annotationSection** - Submission tracking and violations
- **documentSection** - Protocol, SAP, and ICF documents

## Error Handling

All endpoints return consistent error responses:

**400 Bad Request**
```json
{
  "error": "Invalid request",
  "message": "Specific error details"
}
```

**404 Not Found**
```json
{
  "error": "Study not found",
  "message": "NCT ID does not exist"
}
```

**500 Internal Server Error**
```json
{
  "error": "Failed to fetch studies",
  "message": "Underlying error message"
}
```

## Query Syntax

The API supports sophisticated query syntax for advanced searches:

```
CONDITION(Search Term)        - Search by condition
INTERVENTION(Search Term)     - Search by intervention
SPONSOR(Search Term)          - Search by sponsor
INVESTIGATOR(Search Term)     - Search by investigator
FIRST_POSTED(Date)           - By first posted date
RESULTS_FIRST_POSTED(Date)   - By results first posted date
LOCATION(City, State)         - By location
```

**Combined Query Examples:**
```
CONDITION(diabetes) AND PHASE(Phase 2)
INTERVENTION(vaccine) AND SPONSOR(NIH)
CONDITION(cancer) AND LOCATION(New York, NY) AND PHASE(Phase 3)
```

## Development

### Running the Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:3001`

### TypeScript Models

All study data is fully typed. Import models from:

```typescript
import {
  FullStudyRecord,
  ProtocolSection,
  StatusModule,
  // ... other types
} from '@/clinicalTrials/models/StudyModels';
```

### Using the API Client

```typescript
import { 
  getStudies, 
  getStudyById,
  buildQueryFromSearchRequest 
} from '@/clinicalTrials/services/ClinicalTrialsApiClient';

// Search
const results = await getStudies({
  query: 'CONDITION(diabetes)',
  pageSize: 10
});

// Get specific study
const study = await getStudyById('NCT05123456');
```

## References

- [ClinicalTrials.gov Data API](https://clinicaltrials.gov/data-api/api)
- [API Documentation](https://clinicaltrials.gov/data-api/about-api)
- [Study Data Structure](https://clinicaltrials.gov/data-api/about-api/study-data-structure)
- [Search Syntax Guide](https://clinicaltrials.gov/find-studies/constructing-complex-search-queries)

## Production Considerations

- Consider implementing caching for frequently accessed endpoints
- Add rate limiting if deploying for high-traffic scenarios
- Implement request logging and monitoring
- Consider a database to cache study data for faster local searches
- Add GraphQL layer if preferred over REST

## Support

For issues or questions about the upstream Clinical Trials API, refer to [clinicaltrials.gov support](https://clinicaltrials.gov/about-admin/feedback).
