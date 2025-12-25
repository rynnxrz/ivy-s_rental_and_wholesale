---
trigger: always_on
---

# Project Context
You are building **Ivy's Rental & Wholesale**, a B2B Management System for high-value jewelry.
**Goal:** A "Single-man MVP" prioritizing security, simplicity, and strict inventory accuracy.

# Tech Stack
- **Framework:** Next.js 16 (App Router) + React 19
- **Language:** TypeScript (Strict)
- **Styling:** Tailwind CSS v4 + Shadcn UI
- **Database & Auth:** Supabase (Postgres, SSR, Auth, Storage)
- **AI Engine:** Google Gemini (Streaming + Search Grounding)
- **Deployment:** Vercel

---

# 1. Security Guidelines (HIGHEST PRIORITY)

## A. Server Actions (Zero Trust)
- **Mandatory Guard:** Every Server Action that modifies data MUST call `requireAdmin()` from `@/lib/auth/guards` as the FIRST line.
- **Public Actions:** Guest-facing actions (e.g., `createGuestBooking`) MUST validate the `booking_password` server-side. Never trust frontend-only validation.
- **Rate Limiting:** Consider adding for public write operations in production.

## B. Supabase & Data Access
- **Service Role:**
  - 🚫 PROHIBITED in user-facing flows.
  - ✅ ALLOWED in: Admin batch operations, Webhooks, Cron jobs.
- **RLS:** Enabled on all tables. Application logic is the first defense, RLS is the last.
- **Debug Routes:** Wrap in `if (process.env.NODE_ENV === 'development')` or delete before production.

---

# 2. Coding Standards

## Next.js App Router
- **Async Context:** Always `await` for `params`, `searchParams`, `cookies()`.
- **Forms:** `React Hook Form` + `Zod` for client validation. Server Actions MUST re-validate.
- **Feedback:** Use `sonner` for toasts.

## Database
- **Availability:** ALWAYS use `get_unavailable_date_ranges()` RPC. Never query `reservations` directly from ANON.
- **Migrations:** All changes via `supabase/migrations/`. Run `npm run update-types` after.
- **Enums:** Use Postgres ENUM types for status fields. Add new values with `ALTER TYPE ... ADD VALUE`.

## Variant Logic (Critical)
- We do NOT use a separate `item_variants` table.
- Variants are individual rows in `items` with identical `name` but different `color`.
- **UI Convention:** Items with the same `name` are grouped as variants.
- **AI Import Rule:** When grouping variants, AI MUST insert them with identical `name` values.

## UI & Language (User-Centric)
- **No Jargon:** Avoid developer-centric terms like "ad-hoc", "endpoint", "callback", "null".
- **Simple English:** Use plain, business-oriented language. 
  - ❌ "Create Ad-hoc Charge" -> ✅ "Add Manual Charge" or "Extra Fee"
  - ❌ "Execute Sync" -> ✅ "Update List"
  - ❌ "Invalid Payload" -> ✅ "Please check the information you entered"
- **Clarity over Sophistication:** Prioritize terms that a business owner (like Ivy) or a jewelry customer understands instantly.

---

# 3. Business Logic

## Roles
- **Admin:** Full access. Manages Inventory, Staging, Reservations, Communications.
- **Wholesale:** Access `/wholesale` (60% off). Requires `WholesaleAuthMiddleware`. MOQ: $2,000.
- **Customer/Guest:** Access `/catalog`. Submits rental requests via password-protected form.

## Workflows
- **Booking:** Invoice -> Bank Transfer -> Admin "Mark as Paid". No Stripe.
- **AI Import:** Scrape -> Gemini Parse -> **Staging Table** -> Admin Review -> Commit. Use RPC `commit_staging_batch` for atomic operations.

---

# 4. AI & Scraping

- **Grounding:** Use Google Search Grounding to reduce hallucinations.
- **Staging Security:** `staging_imports` and `staging_items` have RLS. Only Admins can view/commit.
- **Image Handling:** Download external images -> Upload to `rental_items` bucket -> Save path to DB. Never store external URLs directly.

---

# Development Mindset
- **No Over-engineering:** No Redux. Use Server Components and `Suspense`.
- **Fixing Bugs:** Check authorization first, then data validation, then logic.
- **Availability:** If the code involves date conflicts, triple-check the logic.