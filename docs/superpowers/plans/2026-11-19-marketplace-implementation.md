# Greg's Test 3 — implementation plan

**Goal:** A responsive and genuinely Supabase-backed marketplace covering the four required end-to-end flows.

**Architecture:** Next.js App Router, React client components for interactive forms and filtering; public Supabase publishable client with restrictive RLS; reusable UI components; SQL migrations in `supabase/schema.sql`.

**Dependencies:** `@supabase/supabase-js`, `lucide-react`, `@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `tailwind-merge`; test runner `tsx`.

## Task 1 — Foundation and validation
**Files:** `lib/validation.ts`, `lib/categories.ts`, `lib/supabase.ts`, `lib/utils.ts`, `tests/validation.test.ts`, `.env.example`, `package.json`.
1. Write failing tests for listing and message data, allowed photo MIME/size and UUID validity.
2. Run tests and observe failure.
3. Implement client/shared utilities, fix validation tests and run again.

## Task 2 — Data security and setup
**Files:** `supabase/schema.sql`, `supabase/verify.sql`, `README.md`.
1. Create tables with constrained fields, FK, indexes, RLS and anonymous INSERT/select policies appropriate to each table.
2. Configure public `listing-images` bucket with MIME, size and insert policies; no anon update/delete.
3. Document exact Supabase dashboard steps and verified queries; note spam risk without login.

## Task 3 — Browse marketplace
**Files:** `app/page.tsx`, `components/marketplace/*`, `components/layout/*`, `app/globals.css`, `app/layout.tsx`, `components/ui/*`.
1. Build navigation and card/grid/filters with empty/loading/error states.
2. Fetch real listings from Supabase and navigate to `/item/[id]`.
3. Check lint and TypeScript.

## Task 4 — Create listing
**Files:** `app/create/page.tsx`, `components/marketplace/create-listing-form.tsx`.
1. Add required fields, preview, client validation and disabled submit in flight.
2. Upload photo to Storage, then insert listing; on success navigate to detail.
3. Check validation tests, lint and build.

## Task 5 — Listing detail and messages
**Files:** `app/item/[id]/page.tsx`, `components/marketplace/message-seller-form.tsx`.
1. Add UUID/not-found guards, responsive details and seller email.
2. Persist messages using insert-only Supabase writes; add feedback and duplicate-submit defense.
3. Run all tests, lint and production build.

## Task 6 — Handoff and deployment
**Files:** `README.md`, `.env.example` and optional docs.
1. Document local setup, SQL, Storage, GitHub/Vercel env, production URL checks and manual verification checklist.
2. Inspect combined diff, report exactly what is and isn't verified.

## Security review focus
- Anonymous visitors cannot SELECT `messages`.
- UI cannot depend on returning message rows from `INSERT`.
- Images restricted by MIME and size in browser and bucket configuration.
- No service role or private credentials in client code or Git history.
- No claims that SQL was executed or public production features work without a live Supabase verification.
