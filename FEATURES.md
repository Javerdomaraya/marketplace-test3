# Marketplace features

This document describes the implemented source behavior for Hiring Test 3. Deployment and live-service acceptance checks are in [SETUP.md](SETUP.md).

## Required features

| Assessment feature | User entry point | Stored result |
| --- | --- | --- |
| Create Listing | `/create` → **Item for sale** → `/create/item` | One image in Supabase Storage and a row in `public.listings` |
| Browse and category filtering | `/` | Reads listings from Supabase; filters the loaded collection |
| Listing Detail | Click a card → `/item/[id]` | Fetches the listing matching its UUID |
| Message Seller | Detail page → **Message Seller** | Inserts a row in `public.messages` linked to that item |

All four flows are available without an account.

## Create a listing

The item form accepts a photo, title, description, price, seller email, and category, plus an optional location. A live preview shows the selected image and entered details before publishing. On wide screens, the preview places the photo beside the details; its image height is bounded, and the desktop preview can scroll within the available viewport. Smaller screens use a stacked preview. The complete image remains visible without cropping. The image can be removed or replaced before submission using keyboard-accessible buttons.

On valid submission, the app:

1. Uploads the image with a random UUID filename to `listing-images`.
2. Inserts the listing fields and image object path into `public.listings`.
3. Opens the new listing's detail URL.

A disabled submit button and an in-flight lock block repeated submissions during the same request. Validation and service errors appear in the form. Image upload and row insertion are separate operations; a failed insert can leave an orphaned image.

Leaving the create form clears its draft fields, selected photo, preview, and feedback. Selecting **Item for sale** again starts a blank form without a manual refresh. If a submitted request finishes after leaving the form, it cannot redirect the new draft or replace its feedback.

### Field rules

| Field | Rule |
| --- | --- |
| Photo | Required; one non-empty JPG, PNG, or WebP; up to 5,242,880 bytes (5 MiB) |
| Title | 3–100 characters after trimming |
| Description | 10–2,000 characters after trimming |
| Price | Greater than 0, at most 100,000,000; decimal input with at most 2 decimal places |
| Seller email | Required; email-pattern validation; at most 254 characters |
| Category | Must exactly match a supported category |
| Location | Optional; 2–100 characters after trimming when supplied |

Client validation gives immediate feedback. Database constraints enforce the persisted text, numeric, category, email, and image-path rules; the Storage bucket enforces its MIME-type and size restrictions. Accepted images are not scanned or moderated by this app.

Prices display in **USD**. There is no currency selector or free/zero-price mode.

## Browse, filter, and search

- Responsive listing-card grid with photo, title, and formatted price.
- Newest listings first, ordered by `created_at` and then `id`, both descending.
- Desktop category navigation and horizontally scrollable category buttons on smaller screens.
- **All Categories** and **Clear filters** controls.
- Bonus keyword search across title, description, and optional location.
- Case-insensitive, trimmed substring matching; category and search apply together.
- Matching result count, loading skeletons, an empty-results state, and a load-error retry button.

The app loads successive Supabase ranges of 200 rows until it reaches the end, then filters in the browser. It does not stop at the first database response. This suits a small assessment dataset; the interface has no page controls, infinite-scroll behavior, or list-view toggle.

### Supported categories

The category source is [lib/categories.ts](lib/categories.ts), mirrored by the SQL constraint in [supabase/schema.sql](supabase/schema.sql).

| Categories | Categories | Categories |
| --- | --- | --- |
| Vehicles | Free Stuff | Sporting Goods |
| Property Rentals | Garden & Outdoor | Toys & Games |
| Apparel | Hobbies | Buy and sell groups |
| Classifieds | Home Goods | Furniture |
| Electronics | Home Improvement | Home & Garden |
| Entertainment | Home Sales | Fashion |
| Family | Musical Instruments | Sports |
| Office Supplies | Pet Supplies | Other |

Category names are labels for the same generic item form. For example, choosing Vehicles does not enable dedicated vehicle fields. The **Free Stuff** label still uses the positive-price rule.

## Listing detail page

Each item has a shareable `/item/<uuid>` route showing:

- Full item photo, title, USD price, category, and description with line breaks.
- Public seller email, posted date, and optional location.
- A back link and the Message Seller section.

The detail image uses a viewport-bounded frame and preserves the full photo without cropping. Desktop columns balance the photo with the details; the image stays visible while scrolling longer details. On smaller screens, the image and details stack.

The page checks the UUID before querying and displays an unavailable state for invalid IDs, missing records, missing configuration, or returned query errors. Loading feedback appears while fetching.

## Message Seller

Buyers expand the message form, enter their email and message, and submit without signing in.

| Field | Rule |
| --- | --- |
| Buyer email | Required email-pattern match; at most 254 characters |
| Message | 1–2,000 characters after trimming |
| Listing reference | The detail page supplies the listing UUID; a database foreign key requires an existing item |

The app stores `listing_id`, `buyer_email`, and `message`; Supabase generates the row ID and timestamp. The browser performs an INSERT without selecting the private row afterward.

Success confirms the saved inquiry and offers **Send another message**. Failed inserts display an error, and duplicate clicks are blocked while submitting. There is no in-app conversation history, seller inbox, or reply thread.

## Optional seller email notification

The repository includes a Supabase Edge Function, `notify-seller`, and a Resend integration. It requires a separate deployment, server-side secrets, and a Database Webhook on `public.messages` INSERT.

The function verifies a shared secret, validates the event, and retrieves the actual message and seller address from Postgres. The email includes the item title, buyer email, message, and an optional listing link. Reply-To is set to the buyer. HTML is escaped, and a per-message provider idempotency key reduces duplicate sends within the provider's supported window.

Database persistence happens first. The buyer's confirmation does not guarantee notification delivery. Configuration and live-delivery checks are documented in [supabase/EMAIL_NOTIFICATIONS.md](supabase/EMAIL_NOTIFICATIONS.md).

## Data visibility and access

Under the supplied schema:

| Data or operation | Visitor access |
| --- | --- |
| Listing fields, including seller email | Public SELECT and INSERT |
| Listing UPDATE or DELETE | Not granted |
| Product images | Public URLs; uploads constrained to the marketplace bucket and UUID filenames |
| Image overwrite or deletion | Not granted |
| Buyer email and message | INSERT only; no public SELECT, UPDATE, or DELETE |

Administrators can inspect private messages using Supabase administrative tools. With optional notifications enabled, the intended seller receives the inquiry by email.

The public key is used with database privileges and RLS. Privileged database/email credentials remain server-side. Anonymous access does not verify seller identity or ownership of a submitted email address.

## Current boundaries

- No login, profiles, seller dashboard, listing edit/delete, checkout, payments, favorites, or chat.
- One image per listing; no photo gallery or batch creation.
- The chooser's multiple-listing, dedicated vehicle, and dedicated real-estate forms are disabled and labeled **Coming later**.
- No automatic live refresh; reload or revisit the home page to fetch new data.
- No built-in CAPTCHA, rate limiting, content moderation, or seller-email verification.
- Browse downloads all listings before filtering; larger datasets would need database-side filtering and visible pagination.
- Local automated checks do not establish that Supabase, production hosting, or email delivery has passed live verification.
