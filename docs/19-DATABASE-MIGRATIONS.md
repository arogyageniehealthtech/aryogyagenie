# Production Database Migration Workflow

## 1. Overview & Best Practices

In a production system serving ~50,000 monthly users, destructive operations like `drizzle-kit push --force` or resetting the database are strictly forbidden.

All schema changes must follow a **version-controlled migration workflow**:

```
Schema Edit (`lib/db/src/schema/*.ts`)
     ↓
`pnpm run db:generate` (Produces SQL in `lib/db/drizzle/`)
     ↓
Code & Migration Review
     ↓
`pnpm run db:migrate` (Applies pending migrations in transaction)
     ↓
Verification & Health Check
```

---

## 2. Available Commands

- **Generate Migration Files**:
  ```bash
  pnpm run db:generate
  ```
  Generates versioned SQL files inside `lib/db/drizzle/` based on schema edits.

- **Execute Production Migrations**:
  ```bash
  pnpm run db:migrate
  ```
  Applies all unapplied SQL migration files against the target database via `drizzle-orm/node-postgres/migrator`.

- **Vector Data Migration**:
  ```bash
  npx tsx scripts/src/migratePgvector.ts
  ```
  Enables `pgvector` extension and populates vector columns safely.

---

## 3. Production Deployment Step-by-Step Procedure

1. **Pre-deployment Check**:
   Verify database connectivity (`DATABASE_URL`) and ensure a backup snapshot exists.
2. **Execute Database Migrations**:
   Run `pnpm run db:migrate` before starting updated application instances.
3. **Execute pgvector Migration**:
   Run `npx tsx scripts/src/migratePgvector.ts` to ensure HNSW vector indexes and vector columns are active.
4. **Deploy Application**:
   Start production server instances (`pnpm --filter @workspace/api-server run start`).
