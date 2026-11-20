# Greg's Test 3 — Marketplace design

## Intent
Build a polished, mobile-friendly, publicly accessible mini-marketplace for a hiring assessment, using Next.js 16, React 19, TypeScript, Supabase Postgres and Storage, and Vercel. Prioritize the four graded flows: create listings, browse/filter listings, show details, and persist buyer messages.

## Constraints and choices
- Preserve the existing `app/` starter layout rather than migrating to `src/` (reduces unnecessary churn).
- No login. Both listing and message creation use Supabase anonymous insert privileges, guarded by PostgreSQL constraints and row-level security.
- Messages are **insert-only** for visitors; there is no public select policy. Buyer emails and text are not exposed by an API or frontend view.
- Listing images live in the public `listing-images` bucket with MIME type and size restrictions and path validation. A public listing can embed an image URL, but visitors cannot modify or delete someone else's images.
- Use a light, Facebook-inspired blue-and-white visual system; no glassmorphism. Categories and currency formatting remain consistent across pages.
- Client-side Supabase queries allow responsive browsing and client-side form interactions. Configuration errors are displayed clearly if Supabase has not yet been connected.
- Do not create mock listing rows and do not touch the separate `wall-test2` project.

## Approaches considered
1. **Direct anonymous Supabase client + strict RLS (selected):** simple, deployable without privileged API credentials, and enough for an authentication-free assessment. Trade-off: anonymous writes can be abused at scale, so use database constraints, upload restrictions, and optional CAPTCHA later.
2. **Server-only API routes with service-role credentials:** centralized validation but unsafe without additional abuse prevention and increases responsibility for protecting an unrestricted privileged endpoint.
3. **Require authentication:** safer moderation and per-user ownership but violates the no-login requirement.

## Data flow
1. User chooses photo and supplies listing data. Client validates, uploads into `listing-images`, inserts a listing row with the storage path, and navigates to `/item/<uuid>`.
2. Homepage loads listings ordered newest first and filters by category and search. A card opens its detail page.
3. Details fetch the row by UUID and show seller information. The message form inserts buyer email/message into a private `messages` table without requesting the inserted row back.

## Failure states
Show loading, empty, invalid ID, not found, upload failure, insert failure, invalid form, and missing environment configuration. On failed listing insert, best-effort attempt to remove the upload may fail because anonymous deletion is prohibited; orphan cleanup is a future administrative task.

## Completion gates
`npm test`, `npm run lint`, `npm run build` must run. Live persistence, storage, and production deployment cannot be claimed until the user creates a separate Supabase project, applies SQL, configures `.env.local` and Vercel, and verifies the public production URL.

## Reference-informed UI revision (November 19)
- Supplied screenshots show a compact white Marketplace header, a permanent desktop category sidebar, a dense multi-column listing grid, a four-card listing-type chooser, a split form/live preview, and a large product image next to details and a message form.
- Follow their layout and density without reproducing sketch placeholder products, copying screenshots into assets, or adding inert message/notification/account buttons. Keep actual listing data from Supabase.
- Add optional seller-entered location and category names shown in the references. Keep earlier categories valid for backward compatibility. No hardcoded city defaults.
- `/create` is a chooser; `/create/item` holds the real form. Alternative listing types remain clearly labeled as not yet available; this hiring test grades item listings only.
- The details view shows the private-message form directly, and its success state describes database storage accurately; do not imply email delivery.
