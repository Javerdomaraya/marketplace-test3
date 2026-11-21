# Test 4: Stripe Connect setup and explanation

This branch extends the passed Marketplace with **sandbox-only** payments. The implementation uses direct charges on each seller's connected account and a **10% application fee**. Listing prices and order accounting use USD; new hosted Checkout sessions enable eligible local-currency choices through Stripe Adaptive Pricing. No real-money keys are accepted.

## What changed

| Part | What it does |
| --- | --- |
| Connect with Stripe | Matches the seller's normalized listing email, creates an Accounts v2 merchant account with Stripe-managed risk, saves its ID, and opens Stripe-hosted onboarding |
| Buy Now | Checks current seller readiness and creates hosted Checkout from the price saved in Supabase |
| Reservation | Locks the listing in a database transaction so a second buyer cannot open another active checkout |
| Confirmation | A signed webhook verifies the account, price, fee, payment status, and this app's metadata proof before saving paid/Sold |
| Success page | Reads the saved order and waits while webhook confirmation is pending |
| Cancellation | Expires the Stripe session before making the item available again |
| Privacy | Seller/account mapping and orders have no anonymous database access; server credentials stay out of browser code |

The existing listing creation, photo upload, categories/search, detail page, and private messaging remain. Work is on `test4-stripe-connect`; `main` remains the Test 3 source.

## 1. Apply the database migration

For the existing Marketplace project, run the complete file
[supabase/migrations/20261121000000_stripe_connect.sql](supabase/migrations/20261121000000_stripe_connect.sql)
in the Supabase SQL Editor. Review it and back up any important data first.

For a new project, run [supabase/schema.sql](supabase/schema.sql) before this migration. Do not run the original schema again afterward: it contains the earlier broad listing SELECT grant and initial insert policy. The Test 4 migration narrows those permissions for the new payment fields.

It adds:

- Private `marketplace_sellers` and `marketplace_orders` tables.
- Listing `status` (`available`, `reserved`, `sold`), `sold_at`, and a private reservation reference.
- Server-only functions to reserve, attach a Stripe session, release, and fulfill an order.
- Row locks and idempotency rules for repeated webhook deliveries.
- Public display-column reads and an insert policy that prevents visitors from forging Sold listings.

Run [supabase/verify-payments.sql](supabase/verify-payments.sql) afterward.

## 2. Local environment

In the existing project folder, keep real values only in `.env.local`. The provided assessment Stripe sandbox values have been configured locally during implementation; they must never be committed.

| Variable | Where used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server; your Marketplace project |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Existing public browser access |
| `SUPABASE_SECRET_KEY` | Server only; Supabase secret key. Legacy `SUPABASE_SERVICE_ROLE_KEY` is also supported |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Supplied sandbox public key; available for Stripe UI extensions |
| `STRIPE_SECRET_KEY` | Supplied `sk_test_` key; server only |
| `STRIPE_WEBHOOK_SECRET` | This app's own endpoint signing secret |
| `APP_URL` | `http://localhost:3000` locally; actual Test 4 production origin on Vercel |

Hosted Checkout redirects to Stripe's returned URL, so it does not need Stripe.js in the browser. The official `stripe` SDK runs on the server.

The private Supabase key also derives this app's flow-token and order-proof signing material. The assessment Stripe secret is shared, so it is not used as a private app-signing key. Each order persists its expected proof privately, allowing payment confirmation after key rotation. Changing the Supabase key still invalidates previously generated onboarding/cancellation links; webhook expiration remains available.

Restart the development server after environment changes:

```powershell
cd C:\Personal\marketplace-test3
npm ci
npm run dev
```

## 3. Deploy a separate Test 4 Vercel project

Use the same public GitHub repository and branch `test4-stripe-connect`. Keep the existing Test 3 project attached to `main`.

Create a separate Vercel project such as `marketplace-test4`, set its **Production Branch** to `test4-stripe-connect`, and use the Next.js preset with the repository root. Add the environment variables above for Production. Set `APP_URL` to its actual public production origin with no extra path.

The webhook and seller-return URLs must be publicly reachable. Test the production domain in a signed-out browser. Configuring a separate project avoids replacing the passed Test 3 deployment.

## 4. Register this app's Connect webhook

After the Test 4 public deployment exists, temporarily set local `APP_URL` to that production origin. Then run:

```powershell
node --env-file=.env.local scripts/create-webhook.mjs
```

The script registers a **Connect** endpoint for:

- `account.updated`
- `checkout.session.completed`
- `checkout.session.expired`

It saves the signing secret to `.env.local` without printing it and saves the owned endpoint ID in ignored `.stripe-webhook.json`. Copy `STRIPE_WEBHOOK_SECRET` from your local file into the **Test 4** Vercel environment and redeploy.

Rerunning with matching state reuses the endpoint. If you need a replacement, `--replace` verifies ownership and stages a new endpoint while leaving the previous one enabled. Deploy the new signing secret, confirm successful signed event delivery and paid-order settlement, then disable only the recorded previous owned endpoint IDs in Stripe. Never disable an endpoint belonging to another candidate. A failed creation or local save leaves the working endpoint enabled.

Restore local `APP_URL=http://localhost:3000` if you resume local development. For local webhooks, use Stripe CLI forwarding and its temporary signing secret as described in the assignment; restore the production endpoint's secret when deploying.

## 5. Seller onboarding

1. Open `/connect` on the production app.
2. Enter the exact seller email used for a listing; matching ignores leading/trailing spaces and letter case.
3. Click **Connect with Stripe**.
4. Complete hosted onboarding using Stripe's sandbox identity and bank data.
5. Return to the marketplace. The server retrieves fresh Stripe readiness flags.
6. An available listing for that email should show **Buy Now** once details, charges, and payouts are enabled.

Accounts are created as US Accounts v2 merchant sandbox accounts with full Stripe Dashboard access and Stripe as both fees and losses collector. This matches the supplied sandbox's supported Managed Risk configuration; the legacy Express creation request is rejected there. Hosted onboarding still collects the seller's required information. Use test US identity/bank details for this flow. See the official [Connect testing guide](https://docs.stripe.com/connect/testing) and [Managed Risk account configuration](https://docs.stripe.com/connect/risk-management/connected-accounts-with-managed-risk).

Readiness checks use Stripe's supported Accounts v1 view of the same account. Accounts v2 merchant changes also emit `account.updated` snapshot events, so the existing connected-account webhook and local forwarding events remain valid. See [Stripe's API interoperability guide](https://docs.stripe.com/connect/accounts-v2/migrate-integration#webhook-events). Checkout continues to use direct charges with a 10% application fee.

No login or email-ownership verification is added because the assessment explicitly uses email matching. This is an assessment sandbox flow, not a production seller-identity system.

## 6. Verify a purchase

1. Create or choose an available listing owned by the onboarded seller.
2. Click **Buy Now**. The item is reserved while Stripe Checkout is open.
3. Use test card `4242 4242 4242 4242`, any future expiry, test CVC and ZIP.
4. The success page initially waits for verified confirmation.
5. Confirm it changes to **Test payment confirmed**.
6. In Supabase, verify a `marketplace_orders` row with `status=paid`, the correct connected account, price in cents, 10% fee, session/payment IDs, and `paid_at`.
7. Verify the listing has `status=sold` and `sold_at`; its card/detail must display Sold and prevent another purchase.
8. Confirm the Stripe direct-charge application fee using the sandbox payment data.
9. Keep another listing from the onboarded seller **available** for the reviewer.

The platform fee is 10%, rounded to cents. Stripe processing fees are separate. Buy Now supports USD amounts from $0.50 to $999,999.99; the original broader listing price validation remains for browsing/creation.

### Currency choice and buyer details

New Checkout sessions enable Stripe Adaptive Pricing, allowing eligible Philippine buyers to choose PHP or the original USD price. Stripe determines eligibility and shows the exchange rate and any conversion fee. The selector can vary by buyer location, seller settlement settings and Stripe account configuration. The Marketplace does not use a fixed peso exchange rate.

Stripe collects the buyer email, card number, expiry and CVC. The app explicitly requests an individual buyer name. Billing country/region is collected by Stripe as needed, without forcing an additional full street address. Optional “save my information” behavior remains with Stripe Link; the app does not store card numbers or require a buyer to save a card before paying. Stripe controls the exact labels, layout and wallet visibility.

The Checkout Session and PaymentIntent continue to report the original USD integration amount. PHP payment details appear separately as `presentment_details`; the signed webhook still requires the exact original USD amount, currency, seller account and 10% application fee. See [Adaptive Pricing](https://docs.stripe.com/payments/currencies/localize-prices/adaptive-pricing.md?payment-ui=stripe-hosted) and [Link saving](https://docs.stripe.com/payments/link/link-payment-integrations).

New orders persist `checkoutVersion: 2` in their private immutable JSONB specification. Existing unversioned orders replay their original USD-only options when recovering an interrupted request. This avoids changing Stripe parameters under an existing idempotency key. No additional SQL migration is required. After deployment, start a fresh Checkout session to see the new options; existing sessions keep their old configuration.

Test cancellation too: Stripe's back/cancel flow expires its session before releasing the reservation. A completed payment is never released just because the buyer opens the cancel URL. Reservations are not released by a local clock alone; the Stripe session must expire or be safely cancelled.

If Stripe times out while creating Checkout, the app keeps the reservation because the provider may already have created a payable session. The exact request parameters are saved privately before calling Stripe. An interrupted session write can be recovered by replaying that same idempotent operation within 23 hours, independently establishing the provider session ID before accepting its webhook. Copied metadata alone cannot release an item. Checkout creation tracks actual SDK attempts, keeps a reservation when a later rejection follows an uncertain attempt, uses a 35-minute expiry (including a margin above Stripe's minimum), and preserves each order's versioned localization settings. See [Stripe's error and retry guidance](https://docs.stripe.com/error-low-level).

After the recovery window, a provider error that cannot be reconciled, or a server crash before any Stripe session exists, administrative reconciliation may be needed. Never manually release a reservation without checking Stripe first. Such failures keep the item reserved and return a retriable webhook error rather than silently accepting an unknown result.

## 7. Automated verification

```powershell
npm test
npm run lint
npm run build
```

Tests include real Postgres-compatible execution of the migration/RLS/settlement functions through PGlite, exact amount and fee rules, signed flow tokens, shared-sandbox event isolation, raw-body webhook verification using Stripe's signing implementation, and real SDK HTTP request serialization.

PGlite uses one connection, so its checks do not independently simulate production multi-connection races. The SQL functions use Postgres row locks; final review and hosted acceptance checks cover that boundary. Test gateway/provider responses are controlled locally; local green checks alone do not prove hosted onboarding, webhook delivery, or seller settlement.

## 8. Submission

At [apply.capm.us](https://apply.capm.us), choose **4) Stripe Connect**. Submit:

- The public **Test 4 production URL**.
- The public GitHub repository, clearly identifying this branch.
- Screenshots of hosted seller onboarding, Buy Now/Checkout, confirmed success, and the paid Supabase order.
- Optional demo video no longer than 3 minutes.
- Reviewer notes naming the onboarded seller and an available item to buy.

Crop credentials and unrelated private data from database screenshots. Do not submit a login-protected preview link.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Purchases unavailable | Migration applied, correct Supabase project, valid server-only Supabase key and sandbox Stripe key |
| Seller still not ready | Complete all hosted onboarding requirements; charges and payouts must both be enabled |
| Checkout rejected | USD amount bounds, seller readiness, listing not Sold/reserved, SDK/provider access |
| Item reserved after abandoning a browser tab | Complete/cancel the existing Checkout or wait for Stripe's expiration webhook |
| Success page keeps waiting | Public endpoint reachable, correct production signing secret, Connect endpoint enabled, webhook processing logs |
| Webhook 400 | Signing secret matches this endpoint and raw-body signature is valid |
| Webhook 500 | Database/network failure; Stripe can retry after the configuration/service is corrected |
| Supabase CLI reports invalid access token | Use the SQL Editor for the reviewed migration, or sign in again with the CLI |
| New public frontend cannot load listings | Apply the Test 4 migration before deploying the updated listing queries |
