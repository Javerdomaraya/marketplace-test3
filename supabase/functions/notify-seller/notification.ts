/**
 * Pure, testable notification logic. Runs server-side in a Supabase Edge Function.
 * Nothing in this file should be imported into browser code.
 */

export type NotificationConfig = {
  webhookSecret: string;
  resendApiKey: string;
  fromEmail: string;
  supabaseUrl: string;
  supabaseAdminKey: string;
  siteUrl?: string;
};

type Message = { id: string; listing_id: string; buyer_email: string; message: string };
type Listing = { id: string; title: string; seller_email: string };

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseInsertWebhook(value: unknown): string | null {
  if (!isRecord(value) || value.type !== 'INSERT' || value.schema !== 'public' || value.table !== 'messages') return null;
  const row = value.record;
  if (!isRecord(row) || typeof row.id !== 'string' || !uuid.test(row.id)) return null;
  if (typeof row.listing_id !== 'string' || !uuid.test(row.listing_id)) return null;
  return row.id;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function createSellerEmail(values: {
  messageId: string;
  listingId: string;
  buyerEmail: string;
  message: string;
  listingTitle: string;
  sellerEmail: string;
  fromEmail: string;
  siteUrl?: string;
}) {
  const cleanTitle = values.listingTitle.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 100);
  const link = values.siteUrl ? new URL('/item/' + values.listingId, values.siteUrl).toString() : null;
  const text = [
    'Someone sent a message about your Marketplace listing.',
    'Listing: ' + cleanTitle,
    'Buyer email: ' + values.buyerEmail,
    '',
    'Message:',
    values.message,
    ...(link ? ['', 'View listing: ' + link] : []),
    '',
    'Reply directly to the buyer email above. Do not share payment credentials.',
  ].join('\n');
  const html = `<!doctype html><html lang="en"><body style="font-family:Arial,sans-serif;line-height:1.6;color:#172033">
    <h2 style="color:#1877F2">New Marketplace message</h2>
    <p>Someone has contacted you about <strong>${escapeHtml(cleanTitle)}</strong>.</p>
    <p><strong>Buyer email:</strong> ${escapeHtml(values.buyerEmail)}</p>
    <p><strong>Message:</strong></p>
    <div style="white-space:pre-wrap;word-wrap:break-word;border:1px solid #dbe2ea;border-radius:8px;padding:16px;background:#f8fafc">${escapeHtml(values.message)}</div>
    ${link ? `<p><a href="${escapeHtml(link)}" style="color:#1877F2">View your listing</a></p>` : ''}
    <p style="font-size:12px;color:#64748b">To reply, use the buyer's email address. Never share payment passwords or codes.</p>
  </body></html>`;
  return {
    from: values.fromEmail,
    to: [values.sellerEmail],
    reply_to: values.buyerEmail,
    subject: 'New Marketplace inquiry: ' + cleanTitle,
    html,
    text,
  };
}

function validMessage(value: unknown): value is Message {
  return isRecord(value) && typeof value.id === 'string' && uuid.test(value.id)
    && typeof value.listing_id === 'string' && uuid.test(value.listing_id)
    && typeof value.buyer_email === 'string' && email.test(value.buyer_email) && value.buyer_email.length <= 254
    && typeof value.message === 'string' && value.message.trim().length > 0 && value.message.length <= 2000;
}

function validListing(value: unknown): value is Listing {
  return isRecord(value) && typeof value.id === 'string' && uuid.test(value.id)
    && typeof value.title === 'string' && value.title.length > 0
    && typeof value.seller_email === 'string' && email.test(value.seller_email) && value.seller_email.length <= 254;
}

function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

async function matchesWebhookSecret(received: string | null, expected: string): Promise<boolean> {
  if (!received || !expected) return false;
  // Compare hashes so the comparison has fixed length; the secret itself is never logged.
  const bytes = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest('SHA-256', bytes.encode(received)),
    crypto.subtle.digest('SHA-256', bytes.encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function createNotifySellerHandler(config: NotificationConfig, requestFetch: typeof fetch = fetch) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return jsonError(405, 'Method not allowed');
    if (!config.webhookSecret || !config.resendApiKey || !config.fromEmail || !config.supabaseUrl || !config.supabaseAdminKey) {
      return jsonError(503, 'Notification service has not been configured');
    }
    if (!(await matchesWebhookSecret(req.headers.get('x-marketplace-webhook-secret'), config.webhookSecret))) {
      return jsonError(401, 'Unauthorized');
    }
    // The database webhook body is only a *signal*. Fetch the message and seller
    // from Postgres instead of trusting the webhook's buyer or recipient details.
    let payload: unknown;
    try {
      const body = await req.text();
      if (body.length > 16000) return jsonError(413, 'Payload too large');
      payload = JSON.parse(body);
    } catch {
      return jsonError(400, 'Invalid JSON');
    }
    const messageId = parseInsertWebhook(payload);
    if (!messageId) return jsonError(400, 'Not a Marketplace message insert');

    const base = config.supabaseUrl.replace(/\/$/, '');
    const headers = {
      apikey: config.supabaseAdminKey,
      // New sb_secret_ keys are not JWTs and must never be sent as Bearer.
      // Legacy service_role keys remain JWTs and support the header.
      ...(config.supabaseAdminKey.startsWith('sb_secret_')
        ? {}
        : { Authorization: 'Bearer ' + config.supabaseAdminKey }),
    };

    try {
      const msgUrl = new URL(base + '/rest/v1/messages');
      msgUrl.searchParams.set('select', 'id,listing_id,buyer_email,message');
      msgUrl.searchParams.set('id', 'eq.' + messageId);
      const msgRes = await requestFetch(msgUrl, { headers });
      if (!msgRes.ok) return jsonError(502, 'Could not retrieve message');
      const messages: unknown = await msgRes.json();
      const message = Array.isArray(messages) ? messages[0] : undefined;
      if (!validMessage(message) || message.id !== messageId) return jsonError(404, 'Message not found');

      const listingUrl = new URL(base + '/rest/v1/listings');
      listingUrl.searchParams.set('select', 'id,title,seller_email');
      listingUrl.searchParams.set('id', 'eq.' + message.listing_id);
      const listingRes = await requestFetch(listingUrl, { headers });
      if (!listingRes.ok) return jsonError(502, 'Could not retrieve listing');
      const listings: unknown = await listingRes.json();
      const listing = Array.isArray(listings) ? listings[0] : undefined;
      if (!validListing(listing) || listing.id !== message.listing_id) return jsonError(404, 'Listing not found');

      const emailPayload = createSellerEmail({
        messageId: message.id,
        listingId: message.listing_id,
        listingTitle: listing.title,
        sellerEmail: listing.seller_email,
        buyerEmail: message.buyer_email,
        message: message.message,
        fromEmail: config.fromEmail,
        siteUrl: config.siteUrl,
      });
      const send = await requestFetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + config.resendApiKey,
          'Content-Type': 'application/json',
          'Idempotency-Key': 'marketplace-message/' + message.id,
        },
        body: JSON.stringify(emailPayload),
      });
      if (!send.ok) {
        // Detailed provider errors appear in the server logs only, never in the public response.
        console.error('notify-seller: Resend rejected notification (HTTP ' + send.status + ')');
        return jsonError(502, 'Email provider rejected notification');
      }
      return Response.json({ ok: true, notified: true });
    } catch {
      console.error('notify-seller: Unexpected server-side delivery error');
      return jsonError(502, 'Notification service temporarily unavailable');
    }
  };
}
