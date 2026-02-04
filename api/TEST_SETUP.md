# Test Environment Setup Guide

## Quick Start

### 1. Start Test Database

```bash
cd api
docker-compose -f docker-compose.test.yml up -d
```

Wait for services to be healthy:
```bash
docker-compose -f docker-compose.test.yml ps
```

### 2. Configure Environment

```bash
cp .env.test.example .env.test
```

Edit `.env.test` if needed (defaults should work with Docker Compose)

### 3. Initialize Database

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/moltstudios_test?schema=public" \
  npx prisma migrate deploy
```

### 4. Run Tests

```bash
# Layer 0 tests (pure logic, no DB required)
npm run test:layer0

# Layer 1 tests (integration tests with DB)
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/moltstudios_test?schema=public" \
  npm run test:layer1

# All tests with coverage
npm run test:coverage
```

### 5. Cleanup

```bash
docker-compose -f docker-compose.test.yml down -v
```

## Manual Database Setup (Alternative)

If you prefer not to use Docker:

### PostgreSQL

1. Install PostgreSQL 15+
2. Create test database:
   ```sql
   CREATE DATABASE moltstudios_test;
   CREATE USER postgres WITH PASSWORD 'postgres';
   GRANT ALL PRIVILEGES ON DATABASE moltstudios_test TO postgres;
   ```
3. Update `DATABASE_URL` in `.env.test`

### Redis (Optional)

1. Install Redis 7+
2. Start Redis: `redis-server`
3. Update `REDIS_URL` in `.env.test` if needed

## Troubleshooting

### Tests fail with "Cannot find module @rollup/rollup-linux-x64-gnu"

```bash
npm install @rollup/rollup-linux-x64-gnu --save-optional
```

### Database connection errors

1. Check if PostgreSQL is running:
   ```bash
   docker-compose -f docker-compose.test.yml ps
   ```

2. Test connection manually:
   ```bash
   psql "postgresql://postgres:postgres@localhost:5433/moltstudios_test"
   ```

3. Reset database:
   ```bash
   docker-compose -f docker-compose.test.yml down -v
   docker-compose -f docker-compose.test.yml up -d
   ```

### Prisma client errors

```bash
npx prisma generate
npx prisma migrate deploy
```

## CI/CD Integration

Add to your CI configuration:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: moltstudios_test
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5

steps:
  - name: Setup test environment
    run: |
      cp api/.env.test.example api/.env.test
      cd api && npx prisma generate
      cd api && npx prisma migrate deploy
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/moltstudios_test

  - name: Run tests
    run: npm test -- --coverage
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/moltstudios_test
```
