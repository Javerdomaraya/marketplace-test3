# Marketplace interview quick review

Read this before the interview, then use [INTERVIEW_NOTES.md](INTERVIEW_NOTES.md) to practise the explanations. Snapshot: November 21, 2026, branch `test4-stripe-connect`.

## Your project in three sentences

> I built on a mini-marketplace that supports photo listings, categories, search, item details and seller inquiries without login. Test 4 adds Stripe-hosted seller onboarding and Checkout, with a 10% application fee. The server reserves inventory first, and a verified webhook saves the paid order and marks the item Sold.

## Memorize the flow

```text
Seller email → Stripe-hosted onboarding → saved connected account
Buy Now → database price + fresh readiness → reserved order
Stripe Checkout → signed webhook → verify payment → paid order + Sold
Success page → read the saved receipt
Cancel → expire Stripe session first → release item
```

## Ten short answers

| If Greg asks… | Main point |
| --- | --- |
| Why Next.js? | React interface plus file-based pages and server payment routes in one project |
| Why Supabase? | Postgres, Storage and access rules for the assessment stack |
| Where is the price trusted? | In the database on the server; the browser sends the listing ID |
| What is Stripe Connect? | Connects the seller account so Checkout can charge in that account's context |
| How is the fee collected? | Direct charge plus `application_fee_amount`; $85 → $8.50 platform fee |
| Why a webhook? | A success redirect does not prove payment; fulfillment must also work if the browser closes |
| How do you stop two buyers? | Transactional reservation and a Postgres row lock |
| What is idempotency? | Repeated requests/events must not create another checkout or fulfill twice |
| Why can an item stay reserved? | An active/uncertain Checkout or a missing confirmation/expiration event; check Stripe before release |
| What is the biggest demo limitation? | Email matching has no authenticated seller ownership; real-money use needs that first |

## Key React concepts

- `useState`: values that change the interface.
- `useEffect`: data loading and cleanup of external work.
- `useRef`: submission locks or persistent values without another render.
- `useMemo`: derives the filtered list from rows/category/search.
- Form drafts reset when leaving; old responses cannot overwrite a new draft.
- Responsive image frames contain the full photo and limit its height.

## Remember these boundaries

- Browser: public listing/photo/message operations with Supabase permissions.
- Server: private Stripe/Supabase keys and all payment-changing operations.
- Messages and payment tables have no direct public read access.
- Stripe signature verification uses the raw request body.
- A shared sandbox key means events also need app/account/order ownership checks.
- Direct charges are implemented; do not describe destination transfers as your design.
- The fee is separate from Stripe processing fees. A sandbox charge does not prove a real bank payout.
- The success page polls; an already-open listing is not automatically subscribed to payment changes.

## Your debugging story

> Stripe showed paid, but the app showed reserved. I traced the order and Checkout session and found the local webhook listener was stopped. The existing Stripe completion event was resent through the normal signed webhook. It returned 200, saved paid and changed the listing to Sold. The lesson was to verify both payment and application fulfillment.

## Evidence and current status

Last verified application revision: `798a97a`. **61 tests, lint and a production build passed.** Hosted Supabase/Stripe sandbox onboarding, payment, 10% fee, signed webhook settlement and cancellation were checked.

**Still pending at note creation:** separate public Test 4 Vercel deployment, permanent Connect webhook and a purchase through that public deployment. Vercel CLI was logged out. Update this status after verification; Test 3 remains on `main`.

## Code to open

- [Checkout service](lib/payments/checkout.ts)
- [Stripe adapter](lib/payments/stripe-gateway.ts)
- [Webhook verification and fulfillment](lib/payments/webhook.ts)
- [Payment database migration](supabase/migrations/20261121000000_stripe_connect.sql)
- [Checkout regression tests](tests/payment-checkout.test.ts)

## AI answer and rehearsal

Explain the actual help AI provided and the setup/testing you performed. Use your own words; do not claim unaided authorship or unverified production readiness.

Before the interview, practise explaining the payment flow without notes, trace one test into its implementation, and answer: “What happens if Stripe charges the buyer but the app crashes before saving the session?” The safe answer preserves the reservation and reconciles the original operation; it does not blindly create another charge.
