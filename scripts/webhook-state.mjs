// Stage a replacement without interrupting the active endpoint. Secret activation
// and verified delivery in production must precede retiring any previous ID.
export async function stageOwnedWebhook({stripe,appId,target,previous,secretHash,replace,save}) {
  if(previous) {
    if(previous.appId!==appId)throw new Error('This local webhook state belongs to a different project.');
    const endpoint=await stripe.webhookEndpoints.retrieve(previous.id);
    if(endpoint.metadata.marketplace_app_id!==appId||endpoint.metadata.managed_by!=='marketplace-test4')throw new Error('Endpoint ownership could not be verified. Nothing changed.');
    if(endpoint.url===target&&endpoint.status==='enabled'&&secretHash===previous.secretHash&&!replace)return {...previous,reused:true};
    if(!replace)throw new Error('An owned endpoint exists with a different URL or secret. Use --replace to stage a replacement.');
  }
  const endpoint=await stripe.webhookEndpoints.create({
    url:target,connect:true,enabled_events:['checkout.session.completed','checkout.session.expired','account.updated'],
    metadata:{marketplace_app_id:appId,managed_by:'marketplace-test4'},
  });
  if(!endpoint.secret)throw new Error('Stripe did not return a signing secret.');
  const previousIds=[...new Set([...(previous?.previousIds??[]),...(previous?[previous.id]:[])])];
  await save({endpoint,previousIds});
  return {id:endpoint.id,previousIds,reused:false};
}
