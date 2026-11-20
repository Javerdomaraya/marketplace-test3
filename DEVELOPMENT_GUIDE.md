# Marketplace development guide

A guide to the current implementation, its data model, and how to verify changes. Start with [README.md](README.md) for the project overview, [SETUP.md](SETUP.md) for installation/deployment, and [FEATURES.md](FEATURES.md) for user-facing behavior.

## Stack and execution model

The app uses Next.js 16.4.6 App Router, React 19.3, TypeScript, Tailwind CSS 4, Lucide icons, and shadcn-style UI primitives. Supabase provides Postgres, its data API, and Storage. The optional notification service runs in a Supabase Edge Function and calls Resend.

Browse, item creation, item detail, and buyer messaging use browser-side Supabase calls. There is no custom Next.js API route for these flows and no login/session flow. The client disables session persistence, automatic token refresh, and URL-session detection.

```text
Browser (Next.js / React)
  |-- SELECT / INSERT listings ----------> Supabase Postgres + RLS
  |-- upload / public image URL ---------> Supabase Storage
  |-- INSERT private buyer message -----> Supabase Postgres + RLS
                                              |
                                     optional INSERT webhook
                                              |
                                     notify-seller Edge Function
                                              |
                                     Resend -> seller inbox
```

The publishable key is public by design. Access control comes from database grants, RLS, constraints, and Storage policy settings. Only the optional function uses privileged database credentials.

## Source map

```text
app/
  layout.tsx                         Shared layout, header/footer
  globals.css                        Global styles
  page.tsx                           Browse, category filtering, search
  create/page.tsx                     Listing-type chooser
  create/item/page.tsx                Form, preview, upload, listing insert
  item/[id]/page.tsx                  Fetch item and display details
components/
  layout/                            Site header and footer
  marketplace/listing-card.tsx        Browse card
  marketplace/message-seller-form.tsx Private inquiry submission
  ui/                                Button, input, textarea primitives
lib/
  categories.ts                      Category values and type guard
  listing-pagination.ts              Fetch all listings in ranges
  supabase.ts                        Browser client and public image URLs
  validation.ts                      Listing, photo, message, UUID checks
  utils.ts                           Class names, USD price/date formatting
types/marketplace.ts                  Listing model
supabase/
  schema.sql                         Tables, constraints, grants, RLS, bucket
  verify.sql                         Read-only configuration checks
  EMAIL_NOTIFICATIONS.md             Optional service setup and troubleshooting
  functions/notify-seller/
    index.ts                         Runtime environment and Deno entry point
    notification.ts                  Testable webhook and email logic
tests/                               Node test runner / tsx tests
docs/superpowers/                     Existing design and implementation plan
```

Before writing Next.js code, follow [AGENTS.md](AGENTS.md) and read the relevant installed guides in `node_modules/next/dist/docs/`. The project instructions warn that this version's APIs and conventions can differ from earlier versions.

## Routes and main flows

| Route | Main responsibility |
| --- | --- |
| `/` | Fetch all listings; apply category and keyword filters |
| `/create` | Offer Item for sale; show other types as future functionality |
| `/create/item` | Validate, upload one image, insert one listing, redirect |
| `/item/[id]` | Validate UUID, fetch one item, render Message Seller |

### Listing creation

The form validates its fields with `validateListing` and its selected file with `validatePhoto`. It generates `<uuid>.jpg|png|webp`, uploads with `upsert: false`, then inserts the listing and selects its ID for navigation.

Upload and row insertion are not a transaction. If insertion fails after upload, the object can remain. Visitors cannot delete it; cleanup requires trusted tooling. An in-flight ref lock and disabled submit state prevent repeated clicks in the same request, but do not provide cross-session idempotency.

With Cache Components enabled, Next.js preserves routes using React Activity. The create page uses a layout-effect cleanup to clear the draft and native file input when hidden, so reselecting a listing type starts fresh. A draft-version ref prevents a previously submitted request from redirecting or updating feedback after the user has left that draft. The submitted upload/insert can still finish in the background.

### Browse and detail

`loadAllListings` requests 200-row ranges until a short page is returned. The query sorts by `created_at DESC, id DESC`. Search matches a case-insensitive substring of title, description, and location, alongside the selected category. All filtering happens in React after retrieval.

Detail uses the route UUID and `maybeSingle()` to retrieve one row. Images use public Storage URLs. There is no realtime subscription or shared client data cache.

### Buyer messages

The form validates the buyer email/message and inserts the item's ID with those fields. Keep this operation INSERT-only: adding `.select()` would require private-message read access that the schema intentionally does not grant.

The success state describes persistence. It cannot report asynchronous notification delivery.

### Optional notification

The INSERT webhook calls `notify-seller` with `x-marketplace-webhook-secret`. The handler requires POST, compares the shared secret, checks the payload/event, and uses the message ID to re-query trusted data. It looks up the seller from the stored listing instead of accepting a recipient from the webhook body.

The server creates text and HTML emails, escapes inserted HTML, sets Reply-To to the buyer, and submits to Resend with `marketplace-message/<message-id>` as the idempotency key. Provider failures return an error without undoing the saved buyer message. The app does not include an email-delivery ledger or an application-managed retry queue.

## Database model

[supabase/schema.sql](supabase/schema.sql) is the setup source of truth.

### public.listings

| Column | Type and behavior |
| --- | --- |
| `id` | UUID primary key, generated by Postgres |
| `title` | Required text; trimmed length 3–100 |
| `description` | Required text; trimmed length 10–2,000 |
| `price` | `numeric(12,2)`; greater than 0, at most 100,000,000 |
| `category` | Required text constrained to the category list |
| `seller_email` | Required email-pattern text, at most 254 characters |
| `image_path` | Required UUID-based image filename with an accepted extension |
| `location` | Nullable text; trimmed length 2–100 when provided |
| `created_at` | Timestamp with time zone, defaults to `now()` |
| `updated_at` | Timestamp with time zone, defaults to `now()` |

There is no automatic `updated_at` update trigger or listing-edit flow. The image path is a string, not a foreign key to Storage, so database constraints alone cannot prove an object exists.

Indexes support created-time ordering and category/created-time access. Current browsing uses the created-time ordering and filters categories client-side.

### public.messages

| Column | Type and behavior |
| --- | --- |
| `id` | UUID primary key, generated by Postgres |
| `listing_id` | Required UUID foreign key to listings; `ON DELETE CASCADE` |
| `buyer_email` | Required email-pattern text, at most 254 characters |
| `message` | Required text; trimmed length 1–2,000 |
| `created_at` | Timestamp with time zone, defaults to `now()` |

An index covers `listing_id, created_at DESC`. Administrative deletion of a listing cascades to its messages; Storage objects are not deleted by that foreign key.

### Access policy

| Resource | Visitor grants and policy |
| --- | --- |
| `listings` | SELECT and INSERT for `anon` and `authenticated`; no UPDATE/DELETE |
| `messages` | INSERT for `anon` and `authenticated`; no SELECT/UPDATE/DELETE |
| `listing-images` | Public bucket; size limit 5,242,880 bytes; JPEG/PNG/WebP |
| `storage.objects` | INSERT policy limited to this bucket and UUID-based image names; no app-supplied overwrite/delete access |

RLS is enabled on both application tables. The SQL revokes broad table privileges before granting only the required operations. Verify the deployed project's actual settings with [supabase/verify.sql](supabase/verify.sql); source SQL alone does not establish its live configuration.

## Configuration boundaries

| Configuration | Location |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Local `.env.local` and Vercel environment |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Local `.env.local` and Vercel environment |
| `RESEND_API_KEY` | Optional Supabase function secret |
| `RESEND_FROM_EMAIL` | Optional Supabase function secret |
| `MARKETPLACE_WEBHOOK_SECRET` | Function secret and matching webhook header |
| `MARKETPLACE_SITE_URL` | Optional function environment value for listing links |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEYS` or legacy `SUPABASE_SERVICE_ROLE_KEY` | Supabase-hosted function environment; privileged values never belong in browser code |

`getSupabase()` lazily creates a singleton client and returns null if either public variable is missing. Use the placeholder-only [.env.example](.env.example) for new checkouts. Restart/rebuild after frontend configuration changes.

## Checks and acceptance testing

Run from the project root:

```powershell
npm test
npm run lint
npm run build
```

| Test file | Coverage focus |
| --- | --- |
| `tests/validation.test.ts` | Listing/message fields, price limits, categories, photo type/size, UUID checks |
| `tests/listing-pagination.test.ts` | Successive ranges, complete collection loading, and query failure handling |
| `tests/message-seller-ui.test.ts` | Initial expandable form behavior using server-rendered component markup |
| `tests/seller-email.test.ts` | Webhook authentication/event validation, trusted recipient lookup, email formatting/escaping, idempotency, and mocked provider failures |

The tests run with `tsx --test` and Node's test runner. They are not browser end-to-end tests and do not exercise live Supabase Storage, deployed RLS, Vercel hosting, or real email delivery.

After changes affecting a core flow, run the relevant production acceptance steps in [SETUP.md](SETUP.md#8-verify-the-four-required-flows-on-the-live-site). Check create → persisted row/image, browse/category/search → persistent results, direct detail refresh → full item, and message submission → private row. Verify optional email independently.

## Making changes safely

- **Categories:** update `lib/categories.ts` and the SQL category constraint together. Existing rows must satisfy the revised constraint before it is applied.
- **Fields:** keep the TypeScript model, form state, preview, validation, insert/select columns, detail/card display, and SQL schema aligned.
- **Price/currency:** display formatting lives in `lib/utils.ts`; also update form labels and any price assumptions. The database currently requires positive prices.
- **Images:** coordinate client checks, filename/extension rules, and Storage size/MIME/policy constraints.
- **Messages:** preserve private reads and keep notification credentials out of client imports.
- **Schema:** review and back up a populated project before applying changes. The schema script is initial setup with some rerunnable upgrades, not a versioned migration history.
- **Dependency changes:** keep the lockfile in sync and follow the installed Next.js guidance.
- **Documentation:** update these four documents when commands, environment names, fields, categories, routes, or behavior change.

## Known limitations and maintenance

Test 4 payments run through `app/api/stripe/` and the official server-side Stripe SDK. `lib/payments/` separates policy, signed flow tokens/order proofs, onboarding, Checkout, webhook processing, and the Stripe/Supabase adapters. The [payment migration](supabase/migrations/20261121000000_stripe_connect.sql) adds private seller/order tables and service-only row-locking reservation/settlement RPCs.

Checkout uses the database price/account snapshot. Verified events check ownership proof, connected account, amount, currency, successful payment, and fee before atomically saving paid/Sold. Unknown shared-sandbox events are ignored. Cancellation requires confirmed Stripe expiration. An ambiguous provider timeout keeps the reservation until the owned session is confirmed expired.

The unique server Supabase key derives flow-token/order-proof signing material; the shared assessment Stripe key is not used as a private app-signing key. UI routes are `/connect`, `/checkout/success`, and `/checkout/cancel`. Read [TEST4_SETUP.md](TEST4_SETUP.md) for operating details and live verification.

This assessment deliberately allows anonymous listing/image/message creation. It has no seller identity verification, CAPTCHA, rate limit, moderation, or resource quotas. Public product images and seller emails are visible to visitors; private inquiries must retain their restricted read policy.

For a larger service, database-side search/filtering and visible pagination would avoid downloading the entire catalog. Administrative routines would also need to handle orphaned Storage uploads and data retention. These are future improvements, not current app features.

The original checkout may contain work that has not been committed or published. Review staged files carefully, keep secrets and Supabase CLI temporary state out of the public repository, and use the [README submission checklist](README.md#submission-checklist) for delivery. A local test/build result is not a public deployment URL.
