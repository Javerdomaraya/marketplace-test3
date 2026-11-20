import Stripe from 'stripe';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

async function main() {
  const key=process.env.STRIPE_SECRET_KEY??'';
  if(!key.startsWith('sk_test_'))throw new Error('Set the supplied sandbox STRIPE_SECRET_KEY in .env.local.');
  const base=new URL(process.env.APP_URL??'');
  if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw new Error('APP_URL must be your public HTTPS Test 4 production origin.');
  const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
  if(!supabaseUrl)throw new Error('Set NEXT_PUBLIC_SUPABASE_URL first.');
  const appId='marketplace-'+createHash('sha256').update(supabaseUrl).digest('hex').slice(0,20);
  const stripe=new Stripe(key);
  const target=base.origin+'/api/stripe/webhook';
  const statePath='.stripe-webhook.json';
  const previous=existsSync(statePath)?JSON.parse(readFileSync(statePath,'utf8')):null;
  if(previous) {
    if(previous.appId!==appId)throw new Error('This local webhook state belongs to a different project.');
    const endpoint=await stripe.webhookEndpoints.retrieve(previous.id);
    if(endpoint.metadata.marketplace_app_id!==appId||endpoint.metadata.managed_by!=='marketplace-test4')throw new Error('Endpoint ownership could not be verified. Nothing changed.');
    const secretHash=createHash('sha256').update(process.env.STRIPE_WEBHOOK_SECRET??'').digest('hex');
    if(endpoint.url===target&&endpoint.status==='enabled'&&secretHash===previous.secretHash&&!process.argv.includes('--replace')) {
      console.log('Owned webhook is already configured: '+endpoint.id);return;
    }
    if(!process.argv.includes('--replace'))throw new Error('An owned endpoint exists with a different URL or secret. Use --replace only to replace this project endpoint.');
    await stripe.webhookEndpoints.update(endpoint.id,{disabled:true});
  }
  const endpoint=await stripe.webhookEndpoints.create({
    url:target,connect:true,enabled_events:['checkout.session.completed','checkout.session.expired','account.updated'],
    metadata:{marketplace_app_id:appId,managed_by:'marketplace-test4'},
  });
  if(!endpoint.secret)throw new Error('Stripe did not return a signing secret.');
  let env=existsSync('.env.local')?readFileSync('.env.local','utf8'):'';
  const entry='STRIPE_WEBHOOK_SECRET='+endpoint.secret;
  env=/^STRIPE_WEBHOOK_SECRET=.*$/m.test(env)?env.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m,entry):env.trimEnd()+'\n'+entry;
  writeFileSync('.env.local',env.trimEnd()+'\n');
  writeFileSync(statePath,JSON.stringify({id:endpoint.id,url:target,appId,secretHash:createHash('sha256').update(endpoint.secret).digest('hex')},null,2)+'\n');
  console.log('Created this project Connect webhook: '+endpoint.id);
  console.log('Signing secret saved privately as STRIPE_WEBHOOK_SECRET in .env.local. It was not printed.');
  console.log('Copy that variable into your Test 4 Vercel project, then redeploy.');
}
main().catch(error=>{
  console.error(error&&typeof error==='object'&&'type' in error?'Stripe refused webhook registration. Check sandbox access and configuration.':error instanceof Error?error.message:'Webhook registration failed.');
  process.exitCode=1;
});
