import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNotifySellerHandler,
  parseInsertWebhook,
  createSellerEmail,
  type NotificationConfig,
} from '../supabase/functions/notify-seller/notification';

const listingId = 'd01842a3-23ce-4489-a2de-659dc04636c2';
const messageId = 'e1b91c49-ce70-4b44-b5d1-22e01cc3d12d';
const config: NotificationConfig = {
  webhookSecret: 'replace-with-long-random-webhook-secret',
  resendApiKey: 're_test_server_only',
  fromEmail: 'Marketplace <messages@example.test>',
  supabaseUrl: 'https://example.supabase.co',
  supabaseAdminKey: 'server-only-secret',
  siteUrl: 'https://marketplace.example.test',
};

const event = {
  type: 'INSERT',
  schema: 'public',
  table: 'messages',
  record: { id: messageId, listing_id: listingId, buyer_email: 'buyer@example.test', message: 'Interested' },
  old_record: null,
};

test('only a real INSERT into public.messages is eligible for email', () => {
  assert.equal(parseInsertWebhook(event), messageId);
  assert.equal(parseInsertWebhook({ ...event, type: 'UPDATE' }), null);
  assert.equal(parseInsertWebhook({ ...event, table: 'listings' }), null);
  assert.equal(parseInsertWebhook({ ...event, record: { id: 'bad-id' } }), null);
  assert.equal(parseInsertWebhook({ ...event, record: null }), null);
});

test('email escapes buyer message and listing title, and links to the actual listing', () => {
  const mail = createSellerEmail({
    messageId, listingId, buyerEmail: 'buyer@example.test',
    message: '<script>alert("oops")</script> & hi',
    listingTitle: 'Bike <great> \r\n Special',
    sellerEmail: 'seller@example.test',
    ...{fromEmail: config.fromEmail, siteUrl: config.siteUrl},
  });
  assert.deepEqual(mail.to, ['seller@example.test']);
  assert.equal(mail.reply_to, 'buyer@example.test');
  assert.ok(mail.html.includes('&lt;script&gt;'));
  assert.ok(!mail.html.includes('<script>'));
  assert.ok(!mail.subject.includes('\n'));
  assert.ok(mail.html.includes('/item/' + listingId));
});

test('edge handler rejects unauthenticated calls before any database access', async () => {
  let fetchCount = 0;
  const handler = createNotifySellerHandler(config, async () => { fetchCount++; throw Error('unexpected'); });
  const response = await handler(new Request('https://example.test', { method: 'POST', body: JSON.stringify(event) }));
  assert.equal(response.status, 401);
  assert.equal(fetchCount, 0);
});

test('edge handler rejects invalid event and non-POST requests', async () => {
  const handler = createNotifySellerHandler(config, async () => { throw Error('unexpected'); });
  const badRequest = new Request('https://example.test', {
    method: 'POST', headers: { 'x-marketplace-webhook-secret': config.webhookSecret },
    body: JSON.stringify({ ...event, type: 'UPDATE' }),
  });
  assert.equal((await handler(badRequest)).status, 400);
  assert.equal((await handler(new Request('https://example.test'))).status, 405);
});

test('authenticated insert loads private message and real seller from database then requests email', async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.includes('/messages?')) return Response.json([{
      id: messageId, listing_id: listingId, buyer_email: 'buyer@example.test',
      message: 'Do you still have the bike?', created_at: new Date().toISOString(),
    }]);
    if (url.includes('/listings?')) return Response.json([{
      id: listingId, title: 'Red bicycle', seller_email: 'seller@example.test',
    }]);
    if (url.includes('api.resend.com')) return Response.json({ id: 'resend-email-id' });
    throw Error('unexpected fetch ' + url);
  };
  const handler = createNotifySellerHandler(config, fakeFetch);
  const response = await handler(new Request('https://example.test', {
    method: 'POST',
    headers: { 'x-marketplace-webhook-secret': config.webhookSecret },
    body: JSON.stringify({ ...event, record: { ...event.record, buyer_email: 'attacker@evil.test' } }),
  }));
  assert.equal(response.status, 200);
  const resendCall = requests.find(({url}) => url.includes('api.resend.com'));
  assert.ok(resendCall);
  const sent = JSON.parse(String(resendCall.init?.body));
  assert.deepEqual(sent.to, ['seller@example.test']);
  assert.equal(sent.reply_to, 'buyer@example.test');
  assert.ok(!JSON.stringify(sent).includes('attacker@evil.test'));
  assert.equal((resendCall.init?.headers as Record<string, string>)['Idempotency-Key'], 'marketplace-message/' + messageId);
});

test('email send failures are visible to the webhook, without reporting success', async () => {
  const fakeFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('/messages?')) return Response.json([{ id: messageId, listing_id: listingId, buyer_email: 'buyer@example.test', message: 'Hello' }]);
    if (url.includes('/listings?')) return Response.json([{ id: listingId, title: 'Bike', seller_email: 'seller@example.test' }]);
    return Response.json({ error: { message: 'invalid sender' } }, { status: 403 });
  };
  const handler = createNotifySellerHandler(config, fakeFetch);
  const response = await handler(new Request('https://example.test', {
    method: 'POST',
    headers: { 'x-marketplace-webhook-secret': config.webhookSecret },
    body: JSON.stringify(event),
  }));
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes('server-only-secret'));
});

test('new Supabase secret keys are sent as apikey only, never as an invalid Bearer token', async () => {
  const seen: Record<string, string>[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    if (String(input).includes('/rest/v1/')) {
      seen.push(init?.headers as Record<string, string>);
      if (String(input).includes('/messages?')) return Response.json([{
        id: messageId, listing_id: listingId, buyer_email: 'buyer@example.test', message: 'Hello seller',
      }]);
      return Response.json([{ id: listingId, title: 'Bike', seller_email: 'seller@example.test' }]);
    }
    return Response.json({ id: 'accepted-by-provider' });
  };
  const handler = createNotifySellerHandler({ ...config, supabaseAdminKey: 'sb_secret_fake_value_for_testing' }, fetcher);
  const response = await handler(new Request('https://example.test', {
    method: 'POST',
    headers: { 'x-marketplace-webhook-secret': config.webhookSecret },
    body: JSON.stringify(event),
  }));
  assert.equal(response.status, 200);
  assert.equal(seen.length, 2);
  for (const headers of seen) {
    assert.equal(headers.apikey, 'sb_secret_fake_value_for_testing');
    assert.ok(!('Authorization' in headers));
  }
});
