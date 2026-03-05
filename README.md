# README - Docker Setup Guide

## Clinical Trials Management System

A full-stack application for managing clinical trials with:
- **Frontend**: Angular 18 (LTS) - Modern, responsive UI
- **Backend**: Next.js 14 (LTS) - API and server-side logic
- **Database**: PostgreSQL 16 - Data persistence

## Prerequisites

- Docker and Docker Compose installed on your system
- Linux/Mac: Docker Desktop or Docker Engine + Docker Compose
- Windows: Docker Desktop with WSL2 backend

## Project Structure

```
clinicalTrials/
├── backend/              # Next.js backend application
│   ├── pages/           # API routes and pages
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── frontend/            # Angular frontend application
│   ├── src/
│   │   ├── app/        # Angular components
│   │   ├── index.html
│   │   └── main.ts
│   ├── angular.json
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml   # Container orchestration
└── README.md
```

## Getting Started

### 1. Start All Services

```bash
docker-compose up -d
```

This will:
- Create and start PostgreSQL database container
- Build and start Next.js backend container
- Build and start Angular frontend container
- Set up networking between containers

### 2. Access the Applications

- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:3001
- **Backend Health Check**: http://localhost:3001/api/health
- **PostgreSQL**: localhost:5432 (postgres/postgres)

### 3. View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f frontend
docker-compose logs -f backend
docker-compose logs -f db
```

### 4. Common Commands

```bash
# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Rebuild containers
docker-compose build

# Restart a service
docker-compose restart backend
```

## Database Connection

The backend automatically connects to PostgreSQL using:
```
postgres://postgres:postgres@db:5432/clinicaltrials
```

Database credentials:
- User: `postgres`
- Password: `postgres`
- Database: `clinicaltrials`
- Host: `db` (within Docker network)
- Port: `5432`

## Development

### Making Changes

- **Frontend changes**: Auto-reload with the development server
- **Backend changes**: Requires restart of the backend container
- **Database schema**: Modify database initialization scripts as needed

### Rebuild After Changes

```bash
# Rebuild specific service
docker-compose build backend
docker-compose up -d backend

# Or rebuild and start all
docker-compose up --build
```

## Troubleshooting

### Containers won't start
```bash
# Check docker daemon is running
docker ps

# View detailed logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs db
```

### Port already in use
```bash
# Find process using port 4200 (frontend)
lsof -i :4200

# Kill the process or modify docker-compose.yml ports
```

### Database connection issues
```bash
# Wait for database to be ready
docker-compose logs db | grep "ready to accept connections"

# Connect to database directly for testing
psql -h localhost -U postgres -d clinicaltrials
```

### Clean rebuild
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

## Next Steps

1. Implement API endpoints in `backend/pages/api/`
2. Add Angular components in `frontend/src/app/`
3. Create database migrations/initialization scripts
4. Add authentication/authorization
5. Set up proper environment variables for production

## Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [Angular Documentation](https://angular.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Documentation](https://docs.docker.com/)
