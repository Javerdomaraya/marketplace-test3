import 'server-only';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { createHash, createHmac } from 'node:crypto';
import { requireTestSecret } from './policy';
import { SupabasePaymentRepository } from './repository';
import { StripeGateway } from './stripe-gateway';
import { PaymentError, type PaymentContext } from './types';
let stripe:Stripe|null=null;
export function getStripe():Stripe {
  const secret=requireTestSecret(process.env.STRIPE_SECRET_KEY??'');
  return stripe??=new Stripe(secret,{maxNetworkRetries:2,timeout:20000});
}
function adminKey():string {
  const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
  if(key.startsWith('sb_secret_'))return key;
  try { if(JSON.parse(Buffer.from(key.split('.')[1]??'','base64url').toString('utf8')).role==='service_role')return key; } catch {}
  throw new PaymentError('Payments are temporarily unavailable.',503,'not_configured');
}
export function siteUrl():string {
  const raw=process.env.APP_URL||(process.env.VERCEL_PROJECT_PRODUCTION_URL?'https://'+process.env.VERCEL_PROJECT_PRODUCTION_URL:'http://localhost:3000');
  try {
    const url=new URL(raw);
    if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||
      (url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))))throw new Error('Invalid origin');
    return url.origin;
  } catch { throw new PaymentError('Payments are temporarily unavailable.',503,'not_configured'); }
}
export function getPaymentContext():PaymentContext {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  if(!url)throw new PaymentError('Payments are temporarily unavailable.',503,'not_configured');
  const key=adminKey();
  const appId='marketplace-'+createHash('sha256').update(url).digest('hex').slice(0,20);
  // The assessment Stripe key is shared. Bind flow tokens/proofs to this
  // project's private database key instead of that shared Stripe key.
  const secret=createHmac('sha256',key).update('marketplace-payment-flow:'+appId).digest('hex');
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  return {repo:new SupabasePaymentRepository(db),gateway:new StripeGateway(getStripe()),secret,siteUrl:siteUrl(),appId};
}
export function webhookSecret():string {
  const secret=process.env.STRIPE_WEBHOOK_SECRET??'';
  if(!secret.startsWith('whsec_')||secret.length<12)throw new PaymentError('Webhook is not configured.',503,'not_configured');
  return secret;
}
