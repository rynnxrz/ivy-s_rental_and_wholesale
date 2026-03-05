# AWS Standardization Milestones (Handover Standard, Codebase-Integrated)

Last updated: 2026-02-13  
Document owner: Single-man MVP handover baseline  
Primary objective: Make this repo handover-ready with explicit standards, then execute AWS standardization without breaking strict inventory correctness.

## 1. Project Setting (Non-Negotiable Baseline)

### Project Context
You are building a B2B Rental Management MVP for high-value items (Fine Jewelry).  
The goal is a "Single-man MVP": prioritize simplicity, stability, and maintainability.  
Critical constraint: Inventory availability must be strictly accurate. Use Postgres exclusion constraints, not only application logic.

### Tech Stack
- Framework: Next.js 16 (App Router)
- Language: TypeScript (strict)
- Core: React 19
- Database and Auth: Supabase (Postgres)
- Styling: Tailwind CSS v4 + Shadcn UI
- State and Forms: React Hook Form + Zod
- AI and Scraping: Google Gemini 3 (Flash), Firecrawl (raw HTML extraction)

### Coding Guidelines

#### Next.js App Router and Server Actions
- Use `app/api/.../route.ts` only for public webhooks or explicit REST needs.
- Prefer Server Actions for form mutations.
- Always treat cookies as async in server components/actions (`await cookies()`).
- Keep logic on server (`"use server"`), use `"use client"` only for interactivity.

#### Supabase Integration (Strict)
- Use `@supabase/ssr` (do not use `@supabase/auth-helpers-nextjs`).
- Server client: `createServerClient` with cookie handling.
- Browser client: `createBrowserClient`.
- RLS is primary access control; avoid duplicating access control in app code if RLS can enforce it.
- For RLS performance, prefer `(select auth.uid())` or helpers like `is_admin()`.

#### Database and Data Model
- Status fields must use custom Postgres ENUM types, not text + check constraints.
- When adding enum values, use:
  1. `ALTER TYPE type_name ADD VALUE IF NOT EXISTS 'new_value';`
  2. Note `ALTER TYPE ... ADD VALUE` may require non-transactional execution on some Postgres versions.
- Critical type: `reservations.status` must be `reservation_status`.
- Variant model:
  - No separate `item_variants` table.
  - Variants are rows in `items`.
  - Items with same `name` and different `color` are treated as variants by UI.
  - AI imports must insert grouped variants with identical `name`.

#### UI and UX
- Responsive on mobile, optimized for desktop.
- Use `sonner`/toast for user feedback.
- Use `Suspense` boundaries and skeleton loaders.

#### User Roles and Testing Credentials
- Admin:
  - Account: `rynnxrz@gmail.com` / `6-xfu5P$cw+5/TN`
  - Scope: inventory management, reservation approval/archiving, voice management testing
  - UI should show: Admin Dashboard, Inventory Upload, Archive actions
- Customer:
  - Account: `shipbyx@gmail.com` / `admin`
  - Scope: browse catalog, check availability, send rental requests
  - UI should not expose inventory editing
- Testing rule:
  - Server actions and RLS changes must be validated with both roles.
  - Admin gating should use `is_admin()` helper (or strict admin email check fallback).

#### AI Agent and Scraping Guidelines
- Human-in-the-loop is mandatory:
  - Scrape -> AI parse -> Staging preview -> User approval -> Insert.
- AI must not write directly into `items` without approval.
- Scraping must include request delays and bounded batches (5-10 items/run for MVP).
- External images must be migrated into Supabase Storage bucket `rental_items`.
- Storage key convention target: `items/{uuid}.jpg` (do not store third-party URLs in final item rows).

#### Single-man MVP Mindset
- No microservices.
- No complex global state over-engineering.
- No Stripe integration.
- Payment flow remains: Invoice -> Bank transfer -> Manual "mark as paid".
- Availability logic is highest risk: always verify three times before merge.

#### Schema and Migration Conventions (Critical)
- Single source of truth: all schema changes go through `supabase/migrations/`.
- Do not use ad-hoc `setup.sql` or manual SQL scripts as final source.
- Regenerate types after schema changes:
  - `npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts` (standard requirement)
  - Repo currently generates to `src/types/database.types.ts` (see drift section below).
- Public availability date queries must use RPC `get_unavailable_date_ranges()` (SECURITY DEFINER).
- `start_date` and `end_date` should be `timestamptz`; cast to `::DATE` only for UI display.

## 2. Codebase-Integrated Snapshot (Current Repo Reality)

### Runtime and Libraries
- `next@16.1.0`, `react@19.2.3`, `@supabase/ssr@0.8.0`, `@supabase/supabase-js@2.90.1`
- Type generation script currently writes to `src/types/database.types.ts` (`package.json` script: `update-types`)

### Core Integration Points
- Supabase server client: `src/lib/supabase/server.ts`
- Supabase browser client: `src/lib/supabase/client.ts`
- Admin guard: `src/lib/auth/guards.ts`
- Public booking action: `src/actions/booking.ts`
- Bulk request flow (idempotency + emergency backup): `src/actions/bulkRequest.ts`
- Public availability calendar RPC usage: `src/app/catalog/[id]/BookingForm.tsx`
- AI staging and commit flow: `src/actions/items.ts`
- Staging API route (query only): `src/app/api/staging-items/route.ts`

### Database and RPC Surface in Use
- `check_item_availability(...)`
- `get_unavailable_date_ranges(...)`
- `get_available_items(...)` / `get_available_items_v2(...)`
- `commit_staging_batch(...)`
- `restore_reservation(...)`
- `is_admin()`

### Current Schema/Migration Drift To Track During Handover
- `reservation_status` and `is_admin()` are used by runtime/types, but creation is not fully represented in `supabase/migrations/` (partly in `supabase/scripts/`).
- Exclusion constraint logic exists in script (`supabase/scripts/fix_exclusion_constraint.sql`) and is not fully standardized in migrations.
- Baseline migrations still define some legacy `DATE`/`TEXT` semantics while current standards require enum + timestamptz discipline.
- Storage policy migration `00036_storage_policies.sql` references `item-images`, while runtime uses `rental_items`.
- Type generation location differs from standard requirement (`src/lib/...`) vs current script target (`src/types/...`).

## 3. Handover Document Standard (What Must Be Delivered)

Each milestone handover package must include all of:
- Change summary (what changed, why, risk).
- Touched files list (app + migration + infra).
- Rollback instructions (exact command or procedure).
- Validation evidence:
  - Admin flow
  - Customer flow
  - Availability correctness (overlap rejection evidence)
  - RLS policy behavior evidence
- Open issues and explicit ownership.

Sign-off rule:
- No milestone is complete without reproducible verification and rollback docs.

## 4. Milestones (Handover-First + AWS Standardization)

### Milestone 0: Handover Baseline Freeze (2-3 days)
Goal:
- Freeze architecture boundaries and define migration ownership.

Deliverables:
- ADR for RDS vs Aurora (default recommendation: RDS PostgreSQL Multi-AZ + RDS Proxy).
- Explicit auth bridging plan (Supabase Auth -> DB RLS context).
- Non-goals list (no product workflow redesign, no payments redesign).

Exit criteria:
- One-page ADR approved.
- Rollback owner and communication plan defined.

### Milestone 1: Data Correctness Source-of-Truth Cleanup (2-4 days)
Goal:
- Move all correctness-critical DB logic into migration-managed SQL.

Deliverables:
- Migration that standardizes exclusion constraint for overlapping `confirmed/active`.
- Enum normalization for `reservation_status`.
- Verification SQL for concurrent overlap attempts.
- Remove dependency on `supabase/scripts/*` for production-critical schema behavior.

Exit criteria:
- DB rejects conflicting concurrent reservations at SQL level.
- Availability invariants pass against both admin and customer test flows.

### Milestone 2: RLS and Security Hardening (2-4 days)
Goal:
- Ensure all role and policy behavior is deterministic under pooled connections.

Deliverables:
- `is_admin()` and policy assumptions moved into migration source of truth.
- Function `search_path` hardening validated for RPCs in active use.
- Public availability access only through safe RPC surface.

Exit criteria:
- Admin and customer credentials pass expected permission matrix.
- No policy or RPC dependency remains undocumented.

### Milestone 3: AI/Staging and Media Compliance (3-5 days)
Goal:
- Enforce human-in-the-loop and storage standards end-to-end.

Deliverables:
- Staging flow proof: no direct AI writes to `items`.
- Image migration enforcement to storage-managed keys (`items/{uuid}.jpg` target convention).
- Batch size and scraping delay controls documented and tested.
- Confirm `commit_staging_batch` path remains atomic (or document approved fallback behavior and risk).

Exit criteria:
- Approved staging commit path tested with rollback scenario.
- No external image URL remains in final imported item rows.

### Milestone 4: AWS Security Foundation (3-5 days)
Goal:
- Provision secure AWS data plane while preserving application behavior.

Deliverables:
- RDS/Aurora with encryption at rest + encrypted snapshots.
- RDS Proxy configured as app entry point.
- S3 with SSE-KMS, versioning, blocked public access.
- Secrets in Secrets Manager.
- CloudWatch alarms for DB/storage/error budgets.

Exit criteria:
- Encryption controls verified.
- App can connect through pool endpoint in pre-prod.

### Milestone 5: Migration Rehearsal (2-4 days)
Goal:
- Prove data parity and behavior parity before cutover.

Deliverables:
- Full dry-run migration replay from `supabase/migrations/`.
- Parity checks for `items`, `reservations`, `profiles`, `app_settings`, invoices.
- Shadow comparison for availability outputs across sampled windows.

Exit criteria:
- Zero critical parity mismatches.
- No availability divergence for sampled test windows.

### Milestone 6: Production Cutover + Hypercare (1 day + 3-5 days)
Goal:
- Execute controlled cutover with immediate rollback safety.

Deliverables:
- Planned maintenance window + write freeze.
- Final sync and config switch.
- Smoke suite runbook:
  - customer request flow
  - admin approval/archive/restore
  - invoice/manual paid flow
  - image upload and retrieval
- Hypercare dashboards and incident protocol.

Exit criteria:
- No double-booking incidents.
- Error/latency metrics remain within defined threshold.

### Milestone 7: Post-Cutover Cleanup (2-3 days)
Goal:
- Remove temporary compatibility debt and finalize handover.

Deliverables:
- Decommission obsolete Supabase storage/auth compatibility paths.
- IAM and secret rotation.
- Final operator runbook and break-glass checklist.

Exit criteria:
- Remaining technical debt explicitly listed with owners/dates.
- Handover package accepted.

## 5. Immediate Actions (This Week)

1. Create Milestone 0 ADR and assign owners.
2. Implement Milestone 1 migration for exclusion constraint + enum/source cleanup.
3. Resolve bucket/type-path drift:
   - bucket naming (`item-images` vs `rental_items`)
   - generated types path (`src/lib` standard vs `src/types` current)
4. Produce first handover evidence bundle (admin/customer role tests + overlap rejection proof).

## 6. Handover Acceptance Checklist

- [ ] Project setting section is adopted as coding baseline.
- [ ] All critical DB correctness logic is migration-managed.
- [ ] Role/RLS behavior validated with both test accounts.
- [ ] Availability guarantees demonstrated with concurrent conflict tests.
- [ ] AWS migration has reversible cutover procedure.
- [ ] Runbook is complete enough for a new maintainer to operate solo.
