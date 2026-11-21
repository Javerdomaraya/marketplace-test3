import test from 'node:test';
import assert from 'node:assert/strict';
import { stageOwnedWebhook } from '../scripts/webhook-state.mjs';
test('webhook replacement leaves the active endpoint enabled on provider or local-save failure',async()=>{
  for(const failure of ['create','save']){
    const updates:string[]=[];
    const stripe={webhookEndpoints:{
      retrieve:async()=>({id:'we_old',url:'https://old.example/api/stripe/webhook',status:'enabled',metadata:{marketplace_app_id:'own-app',managed_by:'marketplace-test4'}}),
      update:async(id:string)=>{updates.push(id);},
      create:async()=>{if(failure==='create')throw new Error('Provider unavailable');return {id:'we_new',secret:'whsec_fake_only'};},
    }};
    await assert.rejects(()=>stageOwnedWebhook({stripe,appId:'own-app',target:'https://new.example/api/stripe/webhook',previous:{id:'we_old',appId:'own-app'},secretHash:'',replace:true,save:async()=>{throw new Error('Disk unavailable');}}));
    assert.deepEqual(updates,[],'old delivery remains active until verified production cutover');
  }
});
test('staged webhook tracks the previous owned endpoint for deliberate retirement after verification',async()=>{
  let saved:unknown;
  const stripe={webhookEndpoints:{retrieve:async()=>({id:'we_old',url:'https://old.example/api/stripe/webhook',status:'enabled',metadata:{marketplace_app_id:'own-app',managed_by:'marketplace-test4'}}),create:async()=>({id:'we_new',secret:'whsec_fake_only'})}};
  const result=await stageOwnedWebhook({stripe,appId:'own-app',target:'https://new.example/api/stripe/webhook',previous:{id:'we_old',appId:'own-app'},secretHash:'',replace:true,save:async(value:unknown)=>{saved=value;}});
  assert.deepEqual(result.previousIds,['we_old']);assert.ok(saved);
});
