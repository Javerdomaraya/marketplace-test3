import Stripe from 'stripe';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { stageOwnedWebhook } from './webhook-state.mjs';

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
  const result=await stageOwnedWebhook({stripe,appId,target,previous,
    secretHash:createHash('sha256').update(process.env.STRIPE_WEBHOOK_SECRET??'').digest('hex'),
    replace:process.argv.includes('--replace'),
    save:async({endpoint,previousIds})=>{
      // Write recovery state before changing the active local environment.
      writeFileSync(statePath,JSON.stringify({id:endpoint.id,url:target,appId,previousIds,secretHash:createHash('sha256').update(endpoint.secret).digest('hex')},null,2)+'\n');
      let env=existsSync('.env.local')?readFileSync('.env.local','utf8'):'';
      const entry='STRIPE_WEBHOOK_SECRET='+endpoint.secret;
      env=/^STRIPE_WEBHOOK_SECRET=.*$/m.test(env)?env.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m,entry):env.trimEnd()+'\n'+entry;
      writeFileSync('.env.local',env.trimEnd()+'\n');
    },
  });
  if(result.reused){console.log('Owned webhook is already configured: '+result.id);return;}
  console.log('Created this project Connect webhook: '+result.id);
  console.log('Signing secret saved privately as STRIPE_WEBHOOK_SECRET in .env.local. It was not printed.');
  console.log('Copy that variable into your Test 4 Vercel project, then redeploy.');
  if(result.previousIds.length)console.log('Previous owned endpoints remain enabled: '+result.previousIds.join(', ')+'. Disable them only after successful signed delivery with the new production secret.');
}
main().catch(error=>{
  console.error(error&&typeof error==='object'&&'type' in error?'Stripe refused webhook registration. Check sandbox access and configuration.':error instanceof Error?error.message:'Webhook registration failed.');
  process.exitCode=1;
});
