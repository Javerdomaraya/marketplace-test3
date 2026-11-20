# Marketplace setup and deployment

**Test 4 branch:** follow [TEST4_SETUP.md](TEST4_SETUP.md) for the payment migration, server credentials, webhook, and separate production deployment. The sections below describe the Marketplace foundation.

This guide configures the existing Marketplace app for local use and Vercel hosting. For user behavior, see [FEATURES.md](FEATURES.md); for internals, see [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md).

## 1. Prerequisites

- Node.js **20.9 or newer**, matching the installed Next.js package's minimum requirement.
- npm, plus Git if cloning or publishing the repository.
- A Supabase account and a dedicated Marketplace project.
- GitHub and Vercel accounts for the required public deployment.
- A Resend account only if enabling the optional seller-email bonus.

Run commands from the project root. On the original Windows checkout:

```powershell
Set-Location C:\Personal\marketplace-test3
node --version
npm --version
npm ci
```

For another machine, clone your Marketplace repository and use that checkout's path. `npm ci` installs the versions recorded in `package-lock.json`.

## 2. Set up Supabase Postgres and Storage

Use a **separate Supabase project for Marketplace**, so the earlier Wall assessment is unaffected.

1. Create the project in [Supabase Dashboard](https://supabase.com/dashboard).
2. Open the project's SQL Editor.
3. Paste and run the complete [supabase/schema.sql](supabase/schema.sql).
4. Run [supabase/verify.sql](supabase/verify.sql) in a separate query.

The schema creates:

- `public.listings` and `public.messages`, validation constraints, indexes, and row-level security.
- A public `listing-images` Storage bucket.
- Listing SELECT/INSERT permissions, private-message INSERT permissions, and an image-upload policy for visitors.

Expected verification results:

| Check | Expected result |
| --- | --- |
| Tables | `listings` and `messages` |
| `can_browse_listings` | `true` |
| `can_create_listings` | `true` |
| `can_send_message` | `true` |
| `can_read_messages_should_be_false` | **`false`** |
| Bucket | `listing-images`, `public = true` |
| Bucket size limit | `5242880` bytes (5 MiB) |
| Allowed MIME types | `image/jpeg`, `image/png`, `image/webp` |
| Listing columns | `category` and nullable `location` |
| Storage upload policy | `Upload marketplace images` |

The verification SQL checks configuration without inserting sample records. It is an inspection aid, not a substitute for live upload and messaging tests.

The schema can also upgrade an earlier version of this assessment's database with the location column and current category constraints. Back up existing data and review the script before rerunning it on a populated project. Existing rows must satisfy the new constraints.

Do not grant visitors SELECT access to `messages`. The app inserts a message without asking Supabase to return private rows. Administrative Table Editor or SQL Editor access is used to inspect inquiries.

## 3. Configure environment variables

In the Supabase project's connection/API settings, obtain the Project URL and publishable key. The exact dashboard labels may vary; see the official [Supabase API key guide](https://supabase.com/docs/guides/getting-started/api-keys) for public and privileged key types.

For a fresh clone without an existing `.env.local`:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

Set:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL of the Marketplace Supabase project |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public publishable key; a legacy anon key can also be used here |

Both values are required. The `NEXT_PUBLIC_` prefix means the values are included in the browser bundle. Never use a Supabase secret/service-role key or a Resend key in either variable.

The repository ignores `.env.local` and permits the placeholder-only `.env.example`. Keep actual local values private. Restart the dev server after changes; production changes require a new build/deployment.

## 4. Run locally

```powershell
npm run dev
```

Open [localhost:3000](http://localhost:3000).

- The home page loads real listings from Supabase.
- A new project starts with **No listings found**.
- Select **Create listing**, then **Item for sale** to reach `/create/item`.
- Missing configuration or failed database requests produce visible error states.

There is no required sign-in, database seed, or separate Next.js API server.

## 5. Run checks and a production build

```powershell
npm test
npm run lint
npm run build
npm start
```

Run `npm start` after the build succeeds and after stopping any other server on port 3000. These checks validate local code and compilation. They do not prove that your remote database, Storage policies, or optional email service work.

## 6. Optional: enable real seller emails

Message persistence works independently of email notifications. To enable the bonus, follow [supabase/EMAIL_NOTIFICATIONS.md](supabase/EMAIL_NOTIFICATIONS.md).

That guide covers:

1. Resend sender/domain verification and its restricted test-sender mode.
2. Server-side secrets: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `MARKETPLACE_WEBHOOK_SECRET`.
3. Optional `MARKETPLACE_SITE_URL` for a production listing link in the email.
4. Deploying the `notify-seller` Supabase Edge Function.
5. A `public.messages` INSERT Database Webhook with the matching `x-marketplace-webhook-secret` header.
6. Verifying function invocation, provider status, and seller inbox delivery.

Keep these secrets in the Supabase function environment. A buyer's success screen confirms the database insert; email is asynchronous and must be tested separately.

## 7. Deploy to Vercel

1. Publish the reviewed project files to a dedicated **public GitHub repository**. Do not reuse the Wall repository.
2. Review the files being committed. Exclude `.env.local`, credentials, local Supabase CLI `supabase/.temp/` state, and local build/dependency folders.
3. In [Vercel](https://vercel.com/new), import that repository.
4. Select Next.js and the root containing `package.json`; the package's build script is `npm run build`.
5. Add both public Supabase variables from section 3 for the **Production** environment. Add them to Preview/Development too only if you intend to use those environments.
6. Deploy. Open the assigned **production domain** in a signed-out or private browser session and confirm that reviewers can access it.
7. Run the acceptance checklist below on that production domain.
8. If optional emails are enabled, set `MARKETPLACE_SITE_URL` to the production URL in Supabase and redeploy the function as described in its guide.

Environment variables are read into the frontend build. If you add or change them after a deployment, redeploy the app, as described in [Vercel's environment variable guide](https://vercel.com/docs/environment-variables/managing-environment-variables). Share the public production URL on the assessment form.

## 8. Verify the four required flows on the live site

Use a real JPG/PNG/WebP image up to 5 MiB and email addresses you control when testing notifications.

### Create a listing

1. Open `/create`, choose **Item for sale**.
2. Upload a photo; enter a title of at least 3 characters, a description of at least 10 characters, a positive price, seller email, and category. Location is optional.
3. Confirm the live preview updates and publish once.
4. Confirm redirection to `/item/<uuid>`.
5. Check the new row in `public.listings` and the object in Storage → `listing-images`. The row's `image_path` must match the uploaded object name.

### Browse and filter

1. Create a second item in a different category.
2. Return home and refresh. Both items must persist.
3. Select each category; only matching listings should remain.
4. Search for a word in a title, description, or location. Combine search with a category, then use **Clear filters**.
5. Check the layout on a narrow/mobile screen as well as desktop.

### Open a listing's dedicated page

1. Click a listing card and confirm its photo, title, USD price, category, full description, seller email, posted date, and optional location.
2. Refresh its URL directly.
3. Try an invalid UUID and a valid-looking UUID with no matching row. Confirm a visible unavailable state.

### Save a buyer message

1. On a real item, select **Message Seller**.
2. Enter a buyer email and a non-empty message; submit.
3. Confirm **Message submitted successfully**.
4. In the Supabase SQL Editor, inspect the latest records:

   ```sql
   select id, listing_id, buyer_email, message, created_at
   from public.messages
   order by created_at desc
   limit 10;
   ```

5. Confirm `listing_id` matches the item's UUID and the email/message match the test.
6. Rerun the privilege check: `can_read_messages_should_be_false` must remain `false`.

Also test missing/invalid fields, price `0`, unsupported and oversized photos, and repeated clicks while a request is pending. If email is enabled, verify its separate function/provider/inbox results.

## 9. Capture submission evidence

Capture the browse page with category filters, filled create form/live preview, dedicated detail page, and message confirmation. A database or Storage screenshot can support persistence verification, but crop credentials and private buyer data.

At [apply.capm.us](https://apply.capm.us), select **3) Marketplace** and include the production URL, public GitHub repository URL, and screenshots. A demo video of at most 3 minutes and reviewer notes are optional. See the [README submission checklist](README.md#submission-checklist).

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Missing Supabase configuration | Exact variable names, actual values, project-root `.env.local`, and a dev-server restart |
| Local app works but Vercel fails to connect | Production variables exist on Vercel, target the same project, and were present for the latest build |
| Table or `location` column is missing | Run the current schema against the intended Marketplace project; rerun verification |
| Upload fails | Bucket ID, upload policy, accepted MIME type, non-empty image, and 5 MiB limit |
| Listing insert fails after upload | Inspect the form error and database constraints; a leftover image may need administrative cleanup |
| Home page is empty | Confirm listings exist in the configured project, clear filters, and verify listing SELECT privileges/policy |
| Detail page is unavailable | Use a real listing UUID and confirm that row still exists in the configured project |
| Message INSERT is denied | Verify message INSERT grant and RLS policy; do not solve this by adding public SELECT |
| Message saved but no seller email | Follow the optional email guide's webhook, secret, sender-verification, and provider-log checks |
| Price `0` is rejected in Free Stuff | The current price rule is greater than zero in every category |
