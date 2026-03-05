# Quick Start Guide for Clinical Trials Docker Setup

## TL;DR - Get Started in 30 Seconds

```bash
# From the project root directory
docker-compose up -d

# Wait 10-15 seconds for all services to start
# Then visit:
# Frontend: http://localhost:4200
# Backend: http://localhost:3001
```

## What Gets Started

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| Frontend (Angular) | 4200 | http://localhost:4200 | User Interface |
| Backend (Next.js) | 3001 | http://localhost:3001 | API Server |
| Database (PostgreSQL) | 5432 | localhost:5432 | Data Storage |

## Stop Everything

```bash
docker-compose down
```

## View Logs

```bash
# See all logs in real-time
docker-compose logs -f

# See specific service logs
docker-compose logs -f frontend
docker-compose logs -f backend
docker-compose logs -f db
```

## Rebuild After Code Changes

```bash
# Just one service
docker-compose build frontend

# Or rebuild everything
docker-compose up --build -d
```

## First Time Setup Issues?

### Issue: "Cannot connect to Docker daemon"
**Solution**: Make sure Docker Desktop is running (Mac/Windows) or Docker daemon is running (Linux)

### Issue: "Port 4200 already in use"
**Solution**: Kill the existing process or change the port in docker-compose.yml

### Issue: "Backend can't connect to database"
**Solution**: Wait for the database container to be fully ready (check logs), then restart backend:
```bash
docker-compose restart backend
```

### Issue: "Frontend shows blank page"
**Solution**: Check browser console for errors:
1. Open DevTools (F12)
2. Check Console tab for JavaScript errors
3. Check Network tab to see if API calls are failing
4. Restart frontend: `docker-compose restart frontend`

## Database Access

Connect directly to PostgreSQL:
```bash
psql -h localhost -U postgres -d clinicaltrials
# Password: postgres
```

Or use your favorite database client (DBeaver, pgAdmin, etc.):
- Host: localhost
- Port: 5432
- Username: postgres
- Password: postgres
- Database: clinicaltrials

## Useful Commands

```bash
# View all running containers
docker-compose ps

# Restart all containers
docker-compose restart

# Remove all containers and data
docker-compose down -v

# Build and start fresh
docker-compose down -v && docker-compose up --build -d

# Access container shell
docker-compose exec frontend sh
docker-compose exec backend sh
docker-compose exec db psql -U postgres -d clinicaltrials
```

## Next: Modify The App

1. **Frontend**: Edit files in `frontend/src/` - changes auto-reload
2. **Backend**: Edit files in `backend/pages/` - restart container after changes
3. **Database**: Modify init script in `docker/init-db.sh` - restart containers

Happy coding! 🚀
