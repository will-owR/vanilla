# PostgreSQL Integration in DevContainer

This document outlines the changes made to integrate PostgreSQL into the development container setup.

## 1. File Structure Changes

```
.devcontainer/
├── devcontainer.json     # Modified
├── docker-compose.yml    # New
└── Dockerfile           # New
```

## 2. Configuration Files

### 2.1 docker-compose.yml

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    volumes:
      - ../..:/workspaces:cached
    command: sleep infinity
    network_mode: service:db
    environment:
      DATABASE_URL: "postgresql://devuser:devpass@localhost:5432/vanilladb?schema=public"

  db:
    image: postgres:16
    restart: unless-stopped
    volumes:
      - postgres-data:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: devuser
      POSTGRES_PASSWORD: devpass
      POSTGRES_DB: vanilladb
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "devuser", "-d", "vanilladb"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres-data:
```

### 2.2 devcontainer.json Changes

```jsonc
{
  "name": "ChronosCraft v0.1 (Alpha)",
  "dockerComposeFile": "docker-compose.yml",
  "service": "app",
  "workspaceFolder": "/workspaces/${localWorkspaceFolderBasename}"
  // ... rest of the configuration remains unchanged
}
```

### 2.3 Dockerfile

```dockerfile
FROM mcr.microsoft.com/devcontainers/javascript-node:22-bullseye

# Install PostgreSQL client tools
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends postgresql-client \
    && apt-get clean -y && rm -rf /var/lib/apt/lists/*

# [Optional] Install additional global node packages
RUN su node -c "npm install -g prisma typescript ts-node"

# [Optional] Add any additional tools needed for development
```

## 3. Environment Variables

The following environment variables are preconfigured:

```bash
DATABASE_URL="postgresql://devuser:devpass@localhost:5432/vanilladb?schema=public"
```

## 4. Port Configuration

The following ports are forwarded:

- 3000: Client/Frontend (React/Next.js)
- 5000: Server/Backend (Node.js/Express)
- 5432: PostgreSQL Database

## 5. Database Details

- **Database Name:** vanilladb
- **Username:** devuser
- **Password:** devpass
- **Host:** localhost
- **Port:** 5432

## 6. Features

- Persistent database storage between sessions
- Automatic database health checks
- PostgreSQL client tools pre-installed
- Integration with VS Code PostgreSQL extension
- Prisma CLI available globally

## 7. Usage

### 7.1 First-time Setup

1. Rebuild devcontainer
2. Wait for health checks to pass
3. Run initial migrations

### 7.2 Database Connection

Use the following connection string in your application:

```
postgresql://devuser:devpass@localhost:5432/vanilladb?schema=public
```

### 7.3 Common Commands

```bash
# Check database status
pg_isready -U devuser -d vanilladb

# Connect to database
psql -U devuser -d vanilladb

# Run Prisma migrations
npx prisma migrate dev
```

## 8. Troubleshooting

### 8.1 Common Issues

- If database connection fails, check if the database container is healthy
- For permission issues, ensure you're using the correct user credentials
- Volume persistence issues can be resolved by recreating the volume

### 8.2 Useful Commands

```bash
# View database logs
docker compose logs db

# Restart database
docker compose restart db

# Reset database (caution: destroys data)
docker compose down -v
```

## 9. Security Notes

- Default credentials are for development only
- Change credentials in production
- Consider using Docker secrets for sensitive data
