# Automatic seller emails (Supabase + Resend)

The Marketplace browser already inserts buyer messages into `public.messages`.
An **INSERT Database Webhook** calls the private `notify-seller` Supabase Edge Function,
which retrieves the actual message and seller address from Postgres and asks Resend to
send the seller an email. This requires no additional Next.js API route and works
even before Vercel deployment.

## Before starting

- Use the dedicated **Marketplace** Supabase project, not your Wall Test 2 project.
- Run `supabase/schema.sql` and `supabase/verify.sql` if you haven't already.
- A seller email comes from `listings.seller_email`. It is **not**
  the buyer's email entered in the Message Seller form.
- You need a Resend account at https://resend.com.
- For sending to arbitrary sellers, verify a domain you control under
  Resend **Domains**. Complete the DNS records Resend asks for.
  A free Gmail/Yahoo address is not a verified sending domain.
- Without a verified domain, you can try a **single-account test only**:
  use `Marketplace <onboarding@resend.dev>` as the sender and make the seller's
  listing email match the address used to register your Resend account.
  That shared testing sender cannot freely send to other people.

## 1. Create a Resend API key

1. Log in to https://resend.com/api-keys.
2. Create a key with **Sending access** for this marketplace (if offered).
3. Copy it to your password manager. **Never put it in NEXT_PUBLIC variables,
   commit it to Git, or paste it into a chat.**

## 2. Generate an independent webhook secret

Use PowerShell. This produces a cryptographically random value.

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Save this value privately. You will enter **exactly the same value in TWO places**:
the Edge Function secret `MARKETPLACE_WEBHOOK_SECRET` and the Database Webhook
HTTP header `x-marketplace-webhook-secret`.

## 3. Set Edge Function secrets in Supabase

In your Marketplace project, open **Edge Functions → Secrets** (sometimes shown
under project Settings). Add:

| Name | Value |
| --- | --- |
| `RESEND_API_KEY` | Your real Resend API key |
| `RESEND_FROM_EMAIL` | `Marketplace <notifications@YOUR_VERIFIED_DOMAIN>` for real sending, or `Marketplace <onboarding@resend.dev>` for the limited initial test |
| `MARKETPLACE_WEBHOOK_SECRET` | The long random value generated in step 2 |
| `MARKETPLACE_SITE_URL` | Optional: your real production URL, e.g. `https://your-marketplace.vercel.app` |

Supabase already supplies `SUPABASE_URL`, `SUPABASE_SECRET_KEYS` and/or
the legacy `SUPABASE_SERVICE_ROLE_KEY` to its hosted Edge Functions. Do not
copy these privileged keys into `.env.local` or the React frontend.

If you do not have a production URL yet, omit `MARKETPLACE_SITE_URL`.
The email will include the listing title and message without a broken link.

## 4. Deploy the function

In **PowerShell** at the root of your project:

```powershell
cd C:\Personal\marketplace-test3
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy notify-seller --no-verify-jwt
```

Replace `YOUR_PROJECT_REF` with your project ID from its Supabase dashboard URL
or Project Settings. During `supabase login` follow the browser authorization.
The login/token step is interactive. Do not share tokens or passwords.

The deploy flag `--no-verify-jwt` is **required for a webhook** that uses
a custom secret rather than a Supabase user JWT. The function is *not public*:
it rejects requests that do not contain the matching secret header.

Confirm the function named `notify-seller` appears under Supabase **Edge Functions**.

## 5. Create the database webhook in the Supabase Dashboard

1. Open **Database → Webhooks** (sidebar labels may vary).
2. Click **Create webhook**, or **Enable Webhooks** if prompted first.
3. Set **Name**: `notify-seller-on-message`.
4. Set **Schema**: `public` and **Table**: `messages`.
5. Select **INSERT only**. Uncheck UPDATE and DELETE.
6. Use **Supabase Edge Functions** as the target type, then select
   `notify-seller`. If your Dashboard offers an HTTP target instead, use the
   URL shown on that function's details page:
   `https://YOUR_PROJECT_REF.supabase.co/functions/v1/notify-seller`.
7. Set **Method**: POST (if the UI asks).
8. Under **HTTP Headers**, add:
   - `Content-Type`: `application/json`
   - `x-marketplace-webhook-secret`: the same random secret from step 2
9. Save the webhook. Do not add the secret to client code.

The function checks the header secret and event type, then re-queries the
private message and corresponding listing using its server-side Supabase
secret. It does not trust the webhook body for the email recipient.

## 6. Test with an actual buyer message

1. In the Marketplace homepage, open a real listing.
2. For an unverified Resend domain, **the seller email for this test listing
   must be the email address on your Resend account**.
3. In **Message Seller**, enter a different buyer email and a short message.
4. Press **Send Message**.
5. Confirm the message row appears under `public.messages` in Supabase
   Table Editor or SQL Editor. (Visitors should not be able to SELECT it.)
6. Open **Supabase → Edge Functions → notify-seller → Invocations/Logs**.
   You should see a webhook invocation with HTTP 200.
7. Open **Resend → Emails/Logs**. Check the new email and its delivery status.
8. Look in the seller inbox and Spam folder. Sending acceptance is not the
   same as confirmed inbox delivery.

**Expected email:** subject `New Marketplace inquiry: <item title>`;
contains the buyer's email and message, and the listing link if configured.
Its Reply-To is the buyer's email address.

## If an email doesn't arrive

| Symptom | Check |
| --- | --- |
| No Edge Function invocation | Is the Database Webhook enabled on `public.messages` INSERT? |
| 401 Unauthorized | Do `MARKETPLACE_WEBHOOK_SECRET` and the webhook header value match exactly? |
| 404 Message / Listing not found | Is the event from your *Marketplace* project and a real existing message? |
| 502 Email provider rejected notification | Check the Resend sender verification, API-key permissions, email quota, and provider logs. |
| Resend 403 testing-only restriction | Verify your sending domain, or initially send only to the email registered with your Resend account. |
| Resend accepted the email but inbox empty | Check spam, the destination address, and the Resend delivery status. |

## Security notes

- The **buyer-facing success message means the message was saved**. The
  webhook sends the notification *asynchronously*, so the frontend cannot
  guarantee its immediate delivery.
- Resend's `Idempotency-Key` uses each message UUID, reducing duplicate
  sends when the same webhook is delivered more than once within the
  provider's idempotency window.
- No public SELECT policy is added for the private `messages` table.
- A no-login marketplace can be misused to send unwanted notifications
  to emails entered as sellers. Before real public traffic, add abuse
  prevention (CAPTCHA, rate limits, moderation) and consider seller-email
  ownership verification. This implementation alone is **not** a full
  production anti-spam solution.
- Keep the webhook secret, Resend key and Supabase secret keys out of Git,
  frontend `NEXT_PUBLIC_` variables, logs, screenshots and support chats.

## Automated local checks

The notification module includes tests for signed webhook handling,
recipient lookup, HTML escaping, email idempotency and provider failure
handling. Run:

```powershell
npm test
npm run lint
npm run build
```

These tests use a **mocked email provider**. Actual delivery requires
deploying the function, configuring Resend, adding the webhook, and sending
a live test message.
