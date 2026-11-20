# Test 4 Stripe Connect design

## Intent and authorization

Extend the passed Test 3 Marketplace with sandbox-only seller onboarding, direct-charge Checkout with a 10% application fee, webhook-confirmed orders, and Sold listings. The user accepted the recommended separate Test 4 branch/deployment and delegated implementation choices, asking for explanations. Work on branch `test4-stripe-connect`; leave `main` and the Test 3 deployment unchanged.

## Approach

Reuse Next.js 16.4.6 / React 19, Supabase, and the existing UI. Add the official Stripe Node SDK and server-side Next.js Route Handlers. Use Accounts v1 Express hosted onboarding and USD card Checkout on the seller's connected account. The alternative destination-charge flow is accepted by the assignment, but direct charges match the supplied shared-sandbox webhook instructions. Default fee: 10%, rounded to cents.

Use the existing clean checkout on the feature branch, honoring the desktop preference to reuse a suitable checkout. Implement in this session with one independent final review; tasks share the payment and repository interfaces closely.

## User flows

- Seller enters the same email used on listings, clicks Connect with Stripe, completes hosted sandbox onboarding, and returns to a status page.
- Server saves the connected account and fresh readiness flags. Ready requires details_submitted, charges_enabled, and payouts_enabled.
- Eligible available listings display Buy Now; sold and reserved listings cannot start another purchase.
- Checkout uses the database listing price and seller mapping, never a price/account supplied by the browser.
- Checkout reserves the single item transactionally. Definite creation rejections release it; ambiguous provider timeouts keep it reserved until Stripe confirmation. Cancellation first expires the Stripe session, then releases it. Expired-session webhooks also release reservations.
- Success page polls the private order through an opaque Checkout Session ID. Only the verified payment handler sets paid/Sold.
- Every flow is explicitly sandbox-only; no login is added, per assessment.

## Data and trust boundaries

Add an additive migration after the existing schema. Private `marketplace_sellers` stores normalized unique emails, Stripe account IDs, and readiness flags. Private `marketplace_orders` stores price/title snapshots, connected account, fee, session/payment IDs, state, and buyer email. Add listing status, sold timestamp, and internal reservation ID.

RLS denies anonymous seller/order reads and writes. Public listing reads are restricted to display columns; anonymous inserts must start available with no payment fields. Reservation, release, and fulfillment RPCs run only as service_role, lock rows, and enforce ownership/state. Duplicate fulfillment is idempotent.

Server uses SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY), STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, APP_URL. Public Stripe key may be configured but hosted Checkout redirects use the returned URL. Never commit real keys. Reject live Stripe keys.

Signed short-lived tokens bind onboarding refresh/return and checkout cancellation. Shared-sandbox events must match app namespace and a locally known account/order; unfamiliar events return 200 without writes. Paid events also match connected account, session, amount, USD currency, successful PaymentIntent, and application fee.

## Reliability

A reservation is never released merely because local time elapsed: Stripe expiration/cancellation must be confirmed. This prevents a delayed paid webhook from allowing another sale. Expiring an already paid session must not make the listing available. Provider or database failures return retryable errors where appropriate.

All payment state changes are server-side. Webhook signatures use the raw body. Repeated and concurrent delivery cannot create duplicate paid orders. A buyer closing the success page does not prevent webhook fulfillment.

## Scope

Keep existing create, search, categories, detail, and private messaging. Add Connect, Buy Now, cancellation, success, Sold/reserved display, migration, registration script, tests, and a clear Test 4 setup guide. No real-money support, cart, shipping, refunds UI, seller authentication, or unrelated redesign.

## Deployment and live checks

Prepare a distinct Vercel project whose production branch is test4-stripe-connect. Add public Supabase settings, server Supabase key, sandbox Stripe keys, APP_URL, and the app's own webhook signing secret. Register only this project's endpoint, connect:true, for account.updated, checkout.session.completed, checkout.session.expired. Leave other candidates' resources untouched.

Actual live verification requires the reviewed migration, configured server credentials, public endpoint, hosted onboarding, and a 4242 test purchase. Record any unavailable prerequisites honestly. Keep at least one onboarded seller's listing available for the reviewer.
