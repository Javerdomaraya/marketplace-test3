# Stripe Connect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add the Test 4 sandbox onboarding and purchase flow to the existing Marketplace.
**Architecture:** Next.js server endpoints own Stripe and private Supabase operations. A service-only SQL transaction reserves and fulfills each listing; verified shared-sandbox webhooks settle orders. React screens expose onboarding, purchase, cancellation, and confirmation.
**Tech Stack:** Existing Next.js/React/TypeScript/Tailwind/Supabase; Stripe Node SDK.
**Spec:** docs/superpowers/specs/2026-11-21-stripe-connect-design.md

## Global Constraints

- Branch test4-stripe-connect; preserve main and Test 3 deployment.
- Sandbox only; reject live keys and events.
- No login; seller email matches listing email after trimming/lowercasing.
- Direct charges, USD, 10% application fee, one item per purchase.
- Never commit credentials; server-only Supabase and Stripe secrets.
- Only server-verified payment can set paid and Sold.
- Unknown shared-sandbox events return 200 without modifying records.

## Review Focus

- Concurrent buyers must not receive two active payment sessions for one item.
- Duplicate or delayed webhook/cancel events must preserve a paid order and Sold item.
- Amount/account/fee mismatches and unknown shared-sandbox events must not fulfill.
- Retry/provider failures must not leave an item falsely sold or incorrectly available.
- Success/onboarding return URLs must not bypass authoritative readiness/payment checks.

### Task 1: Payment domain and database

**Files:** lib/payments/types.ts, lib/payments/policy.ts, lib/payments/tokens.ts, supabase/migrations/20261121000000_stripe_connect.sql, tests/payment-policy.test.ts, tests/payment-tokens.test.ts; package.json, .env.example, .gitignore.
**Interfaces:** Produce Seller, Order, PaymentListing, PaymentRepository and PaymentGateway interfaces; normalizeSellerEmail, priceToCents, platformFee, sellerReady, signFlowToken/readFlowToken.
- [ ] Write failing tests for email normalization, decimal cents, fee rounding, USD bounds, readiness, sandbox enforcement, tampered/wrong-purpose/expired tokens.
- [ ] Run targeted tests and confirm failures before implementation.
- [ ] Implement domain policies and HMAC tokens. Add Stripe SDK.
- [ ] Add private tables and service-only reserve/attach/release/complete functions with row locks, snapshot validation, and idempotency.
- [ ] Verify targeted tests and existing suite. Validate SQL using an actual Postgres-compatible runtime where available.
- [ ] Commit task and record verification in the ledger.

### Task 2: Secure payment services and endpoints

**Files:** lib/payments/checkout.ts, onboarding.ts, webhook.ts, stripe-gateway.ts, repository.ts, server.ts, http.ts; app/api/stripe/{connect,status,checkout,webhook,order}/route.ts; app/api/stripe/onboarding/{return,refresh}/route.ts; app/api/stripe/checkout/cancel/route.ts; tests/payment-checkout.test.ts, payment-webhook.test.ts, payment-onboarding.test.ts.
**Consumes:** Task 1 types/policy/tokens and SQL RPCs.
**Produces:** beginOnboarding(email), refreshOnboarding(token), finishOnboarding(token), createCheckout(listingId), cancelCheckout(token), processStripeEvent(event); thin HTTP handlers and a server SDK/repository adapter.
- [ ] Write failing service tests using repository/gateway fakes for ready/unready/sold/reserved listings, server price/fee/account selection, failed session cleanup, safe cancellation, and signed flow validation.
- [ ] Write failing webhook tests for invalid signatures, unknown/live events, wrong account/amount/currency/fee, unpaid and paid sessions, duplicate payment and expiration-after-payment.
- [ ] Run tests to confirm expected RED results.
- [ ] Implement services/adapters and raw-body signature verification. Use no-store responses; expose only minimal public status/order receipts.
- [ ] Verify targeted tests, full suite, lint, and build; commit and ledger.

### Task 3: Marketplace UI, setup and operations

**Files:** app/connect/page.tsx, app/checkout/{success,cancel}/page.tsx, components/marketplace/purchase-panel.tsx, components/payments/*; app/item/[id]/page.tsx, app/page.tsx, components/marketplace/listing-card.tsx, components/layout/site-header.tsx, site-footer.tsx, types/marketplace.ts; scripts/create-webhook.mjs; TEST4_SETUP.md and existing docs.
**Consumes:** Task 2 endpoints; listing status/sold_at.
**Produces:** Hosted onboarding launch; eligible Buy Now; non-purchasable reserved/Sold states; pending/paid success; safe cancellation; owned webhook registration and reviewer instructions.
- [ ] Add UI without exposing server credentials; preserve Test 3 flows and reset lifecycle behavior.
- [ ] Verify browser form states, responsiveness, empty/missing configuration, and success waiting state.
- [ ] Add webhook setup script that stores its signing secret locally without logging it; no deletion of unrelated endpoints.
- [ ] Add environment/migration/deployment instructions and a plain-language explanation of changes.
- [ ] Run full suite, lint, build, doc checks, secret scan and final independent review.
- [ ] Commit and ledger.

### Task 4: Configure and verify sandbox integration where authorized

**Files:** Private local configuration only; review evidence and setup documentation.
**Consumes:** User-provided sandbox keys, server Supabase key, applied migration, public deployment.
- [ ] Configure supplied sandbox keys privately; inspect only presence of secret values in output.
- [ ] Apply/review migration against the intended Marketplace project; preserve Test 3 data.
- [ ] Prepare distinct public Test 4 deployment and its own Connect webhook.
- [ ] Complete hosted onboarding and 4242 purchase; confirm application fee, saved paid order, Sold state, and availability of another reviewer listing.
- [ ] If account/approval/configuration access is unavailable, finish all local implementation and identify exact remaining setup actions without claiming live acceptance.
