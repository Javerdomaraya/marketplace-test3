# Local-currency Checkout implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this focused task inline. A separate agent researches/reviews provider compatibility.

**Goal:** Offer eligible local-currency Checkout and an explicit buyer-name field with optional Stripe-managed information saving.

**Architecture:** Version the privately persisted Checkout request settings. Keep existing USD settlement checks and use Stripe-hosted Adaptive Pricing and Link UI.

**Tech stack:** Existing Next.js/TypeScript, Stripe 23.2 SDK, Supabase JSONB and node:test/tsx.

**Spec:** [Local-currency Checkout](../specs/2026-11-21-local-currency-checkout.md).

## Task 1: Versioned hosted Checkout options

Files: `lib/payments/types.ts`, `checkout.ts`, `stripe-gateway.ts`; payment protocol/checkout/webhook tests; setup and interview documentation.

- [ ] Write real-SDK regression for Adaptive Pricing/name/optional Link defaults and legacy exact-parameter replay; observe expected failures.
- [ ] Persist version 2 for new orders and implement version-dependent SDK options.
- [ ] Test PHP-presentment completion while retaining exact USD/account/fee checks.
- [ ] Verify targeted and full tests, lint/build and documentation/credential checks.
- [ ] Inspect an owned sandbox preview if available; expire only resources created for this check.
- [ ] Update explanatory notes and report actual verification/deployment status.

Review focus: unversioned outstanding orders; copied/incorrect amounts in presentment metadata; optional card saving without forced future-charge consent; Stripe eligibility and account-level overrides; existing production APP_URL/webhook setup remains a separate deployment requirement.
