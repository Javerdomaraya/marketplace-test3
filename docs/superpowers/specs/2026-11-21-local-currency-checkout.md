# Local-currency hosted Checkout

The user requested the example's currency choice and buyer-information form, and accepted the proposed Stripe Adaptive Pricing approach by asking to implement it. Extend the existing Stripe-hosted Checkout rather than collecting card details in Marketplace.

## Choice and boundaries

Enable Adaptive Pricing for new sessions, require an individual buyer name through Stripe, and leave optional saved-information handling with Stripe Link. Preserve card eligibility filtering and Stripe's automatic billing-country collection. Do not force full street addresses, save cards in Marketplace, hard-code exchange rates, or introduce an app-managed customer wallet.

Keep listing/order/fee accounting in USD. Stripe reports its original integration currency and amount alongside any presentment details; existing exact USD fulfillment checks remain mandatory. PHP/USD availability depends on Stripe eligibility/location/settlement settings and is not a guaranteed dropdown for every buyer. Stripe supplies the exchange rate and any displayed conversion fee.

## Compatibility

Persist `checkoutVersion: 2` inside each new private immutable `checkout_spec`. An absent version retains the previous exact request options for idempotent recovery. No database migration is needed because the specification already uses JSONB.

## Acceptance

- Real SDK request regression proves new sessions enable localization and collect buyer name; legacy sessions retain their exact original parameters.
- A PHP-presentment webhook still settles only against the correct USD amount, account, proof and fee; mismatches remain rejected.
- Full tests, lint, production build and credential/document checks pass.
- Where sandbox access permits, verify Stripe accepts the settings and inspect a PH-localized hosted preview. Report any Stripe-controlled limits honestly.
