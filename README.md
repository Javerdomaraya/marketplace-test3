# Marketplace — Hiring Test 4: Stripe Connect

This branch adds sandbox Stripe Connect onboarding, Buy Now, a 10% application fee, webhook-confirmed orders, and Sold listings. Start with [TEST4_SETUP.md](TEST4_SETUP.md) for the migration, server credentials, webhook, and Test 4 submission steps. The passed Test 3 source remains on `main`.

A Facebook-inspired mini-marketplace where visitors can publish an item, browse and filter listings, open an item's detail page, and save an inquiry for the seller. No account or login is required.

Built with **Next.js 16.4.6 (App Router), React 19.3, TypeScript, Tailwind CSS 4, shadcn-style UI components, Lucide icons, Supabase Postgres, and Supabase Storage**. Vercel is the intended deployment target.

## Documentation

| Document | Purpose |
| --- | --- |
| [TEST4_SETUP.md](TEST4_SETUP.md) | Sandbox payment setup, architecture, live testing, and Test 4 submission |
| [SETUP.md](SETUP.md) | Local installation, Supabase configuration, optional email setup, Vercel deployment, and troubleshooting |
| [FEATURES.md](FEATURES.md) | User flows, validation rules, categories, and current limitations |
| [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) | Architecture, database and access model, code organization, testing, and maintenance |

## Assessment requirements

| Requirement | Implementation | Production acceptance check |
| --- | --- | --- |
| Create a listing with photo, title, description, price, email, and category | `/create/item` uploads to Storage and inserts into `public.listings` | Create an item and inspect its row and uploaded image |
| Browse all listings and filter by category | Responsive home-page grid with desktop category navigation and mobile category tabs | Create items in two categories, refresh, and filter |
| Dedicated listing page with photo and full details | `/item/[id]` | Open and refresh the new item's URL |
| Message Seller saves the buyer's message in Supabase | Inserts buyer email, message, and listing ID into `public.messages` | Submit an inquiry and verify it using Supabase administrative access |
| Bonus: keyword search | Case-insensitive title, description, and location filtering | Search for a known word and combine it with a category |
| Bonus: seller email notification | Optional Supabase Edge Function and Resend integration included | Configure the webhook and verify actual delivery separately |

This table describes the source implementation. A passing local build does not establish that the deployed app, database policies, or email delivery have been verified.

## Quick start

Use Node.js **20.9 or newer** and npm. For a fresh checkout:

1. Create a dedicated Supabase project for Marketplace.
2. Run [supabase/schema.sql](supabase/schema.sql), then the [Test 4 migration](supabase/migrations/20261121000000_stripe_connect.sql), in the SQL Editor. Verify with [supabase/verify-payments.sql](supabase/verify-payments.sql) and configure payment credentials using [TEST4_SETUP.md](TEST4_SETUP.md).
3. From the project root, install dependencies and create the local configuration:

   ```powershell
   npm ci
   Copy-Item .env.example .env.local
   ```

4. Edit `.env.local` using the project's public connection values:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
   ```

5. Start the app:

   ```powershell
   npm run dev
   ```

Open [localhost:3000](http://localhost:3000). An empty database shows an empty state; the app does not supply fake products. See [SETUP.md](SETUP.md) for the full process, expected SQL results, and deployment instructions.

Only the Supabase publishable key (or legacy anon key) belongs in browser configuration. Privileged Supabase keys, Resend credentials, and webhook secrets stay server-side.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Browse, category filters, and keyword search |
| `/create` | Listing-type chooser; select **Item for sale** |
| `/create/item` | Item form with photo and live preview |
| `/item/[id]` | Item details and Message Seller form; `id` is a real listing UUID |

## Development commands

```powershell
npm test
npm run lint
npm run build
npm start
```

`npm start` serves an existing production build. Unit tests cover validation, listing pagination, message-form behavior, and seller-email logic with a mocked provider. See [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) for coverage and manual acceptance checks.

## Submission checklist

For this branch, submit at [apply.capm.us](https://apply.capm.us) and choose **4) Stripe Connect**:

- [ ] Public Test 4 Vercel production URL with an available listing from an onboarded seller.
- [ ] Public [Test 4 implementation branch](https://github.com/Javerdomaraya/marketplace-test3/tree/test4-stripe-connect), clearly identified in reviewer notes.
- [ ] Screenshots of hosted onboarding, Buy Now/Checkout, confirmed success, and the paid Supabase order.
- [ ] Verified 4242 sandbox purchase, saved paid order, and Sold listing.
- [ ] Another available listing the reviewer can purchase.
- [ ] Optional public/unlisted demo video, at most 3 minutes, and notes naming the seller/item.

The live URL and evidence must come from the actual deployment. Green local checks do not prove live onboarding, webhook delivery, or settlement. Use the full checklist in [TEST4_SETUP.md](TEST4_SETUP.md).

## Scope and operational notes

- One photo per listing, JPG/PNG/WebP, up to 5 MiB; prices must be greater than zero and display in USD.
- Seller email is public. Buyer emails and messages have no public read access under the supplied schema.
- The listing chooser's batch, vehicle-specific, and real-estate-specific forms are marked **Coming later**.
- There is no in-app seller inbox, marketplace login, listing edit/delete flow, cart, or real-money payment support.
- Anonymous writes can attract spam and unwanted uploads. Abuse controls and moderation are future operational work.
- An image uploaded before a failed listing insert can remain orphaned; trusted administrative cleanup may be needed.
- Email notifications require separate setup; a saved message does not confirm email delivery.

See [FEATURES.md](FEATURES.md) for the complete feature description and [supabase/EMAIL_NOTIFICATIONS.md](supabase/EMAIL_NOTIFICATIONS.md) for the optional notification service.
