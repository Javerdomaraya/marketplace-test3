import { createNotifySellerHandler } from './notification.ts';

// The Supabase-hosted runtime provides Deno and database connection secrets.
// No privileged key or Resend API key is ever sent to a browser.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

function getAdminKey(): string {
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretKeys) {
    try {
      const values = JSON.parse(secretKeys) as Record<string, string>;
      if (values.default) return values.default;
    } catch { /* legacy project, fall back below */ }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

Deno.serve(createNotifySellerHandler({
  webhookSecret: Deno.env.get('MARKETPLACE_WEBHOOK_SECRET') ?? '',
  resendApiKey: Deno.env.get('RESEND_API_KEY') ?? '',
  fromEmail: Deno.env.get('RESEND_FROM_EMAIL') ?? '',
  supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
  supabaseAdminKey: getAdminKey(),
  siteUrl: Deno.env.get('MARKETPLACE_SITE_URL'),
}));
