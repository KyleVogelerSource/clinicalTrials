# Development Guide

## Project Stack Overview

### Frontend - Angular 18 (LTS)
- **Location**: `frontend/`
- **Port**: 4200
- **Tech**: TypeScript, Angular Components, RxJS
- **Key Files**:
  - `src/app/app.component.ts` - Root component
  - `src/main.ts` - Application bootstrap
  - `angular.json` - Angular build configuration
  - `tsconfig.json` - TypeScript configuration

#### Frontend Commands
```bash
# Development server (auto-reload)
npm start

# Build for production
npm run build

# Run tests
npm test
```

#### Adding New Components
```bash
# Generate a new component
ng generate component components/my-component

# Generate a new service
ng generate service services/my-service

# Generate a new module
ng generate module modules/my-module
```

---

### Backend - Next.js 14 (LTS)
- **Location**: `backend/`
- **Port**: 3001
- **Tech**: TypeScript, Node.js, React (for API routes)
- **Key Files**:
  - `pages/api/` - API endpoints
  - `pages/` - Server-side rendered pages
  - `next.config.js` - Next.js configuration
  - `tsconfig.json` - TypeScript configuration
  - `package.json` - Dependencies and scripts

#### Backend Commands
```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Start production build
npm start

# Lint code
npm run lint
```

#### Creating API Endpoints
```typescript
// pages/api/example.ts
import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    res.status(200).json({ message: 'Hello from API' })
  }
}
```

---

### Database - PostgreSQL 16
- **Location**: Running in Docker container
- **Port**: 5432
- **User**: postgres
- **Password**: postgres
- **Database**: clinicaltrials

#### Database Connection String
```
postgres://postgres:postgres@db:5432/clinicaltrials
```

#### Running SQL Queries
Inside container:
```bash
docker-compose exec db psql -U postgres -d clinicaltrials
```

From Node.js:
```typescript
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

// Execute query
const result = await pool.query('SELECT * FROM studies')
```

---

## Development Workflow

### 1. Frontend Development
```bash
# Terminal 1: Watch frontend changes
cd frontend
npm start
```
- Open http://localhost:4200
- Changes auto-reload in browser
- Check browser console for errors

### 2. Backend Development
```bash
# Terminal 2: Watch backend changes
cd backend
npm run dev
```
- API available at http://localhost:3001
- Test with curl or Postman
- Check terminal for errors

### 3. Database Development
```bash
# Connect to database
docker-compose exec db psql -U postgres -d clinicaltrials
```
- Write and test SQL queries
- Modify schema as needed
- Run migrations as needed

#### Example: Connect Frontend to Backend API
In `frontend/src/app/app.component.ts`:
```typescript
import { HttpClient } from '@angular/common/http'

export class AppComponent {
  constructor(private http: HttpClient) {}
  
  ngOnInit() {
    this.http.get('http://localhost:3001/api/health')
      .subscribe(response => console.log(response))
  }
}
```

#### Example: Create Backend Endpoint
In `backend/pages/api/trials.ts`:
```typescript
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

export default async function handler(req, res) {
  try {
    const result = await pool.query('SELECT * FROM studies')
    res.status(200).json(result.rows)
  } catch (error) {
    res.status(500).json({ error: 'Database error' })
  }
}
```

---

## Debugging

### Frontend Debugging
1. Open DevTools in browser (F12)
2. Check Console, Network, and Sources tabs
3. Set breakpoints in TypeScript files
4. Use `console.log()` for quick debugging

### Backend Debugging
1. Check server logs: `docker-compose logs -f backend`
2. Add console.log statements in API routes
3. Use VS Code debugger (optional debugging configuration)
4. Test endpoints with curl:
   ```bash
   curl http://localhost:3001/api/health
   ```

### Database Debugging
```bash
# Connect to database
docker-compose exec db psql -U postgres -d clinicaltrials

# View tables
\dt

# Describe table structure
\d studies

# Run queries
SELECT * FROM studies;
```

---

## Project Structure Best Practices

### Frontend Organization
```
frontend/
├── src/
│   ├── app/
│   │   ├── components/      # Reusable components
│   │   ├── services/        # API services
│   │   ├── models/          # Data models/interfaces
│   │   └── app.component.ts # Root component
│   ├── assets/              # Images, styling
│   └── main.ts              # Bootstrap
├── angular.json             # Angular config
└── package.json
```

### Backend Organization
```
backend/
├── pages/
│   ├── api/                 # API endpoints
│   │   ├── health.ts
│   │   ├── trials.ts
│   │   └── ...
│   └── index.tsx            # Home page
├── lib/                     # Utility functions
├── types/                   # TypeScript types
├── package.json
└── tsconfig.json
```

---

## Environment Variables

### Frontend (.env files in frontend/)
```env
# Can be accessed via environment as process.env
```

### Backend (.env.local in backend/)
```env
DATABASE_URL=postgres://postgres:postgres@db:5432/clinicaltrials
NEXT_PUBLIC_API_URL=http://localhost:3001
NODE_ENV=development
```

---

## Testing

### Frontend Unit Tests
```bash
cd frontend
ng test
```

### Backend Testing
```bash
cd backend
npm test
```

---

## Performance Tips

1. **Frontend**: Use `OnPush` change detection strategy
2. **Backend**: Use connection pooling for database
3. **Database**: Create indexes on frequently queried columns
4. **Docker**: Use `.dockerignore` to reduce build context

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Port already in use | Change port in docker-compose.yml |
| Module not found | Run `npm install` in the service directory |
| Database won't connect | Ensure DB container is running and healthy |
| CORS errors | Configure CORS in Next.js backend |
| Changes not reflecting | Restart the container or service |

---

## Getting Help

1. Check Docker logs: `docker-compose logs -f`
2. Check browser console (Frontend)
3. Test API directly with curl
4. Review stack documentation
