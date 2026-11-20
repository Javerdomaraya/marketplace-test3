import { PaymentError } from './types';
export async function paymentResponse(action:()=>Promise<unknown>):Promise<Response> {
  try {
    const result=await action();
    return result instanceof Response?result:Response.json(result,{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    if(error instanceof PaymentError) return Response.json({error:error.message,code:error.code},{status:error.status,headers:{'Cache-Control':'no-store'}});
    console.error('Marketplace payment request failed.');
    return Response.json({error:'Payments are temporarily unavailable. Please try again.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
export async function requestBody(request:Request,origin:string):Promise<Record<string,unknown>> {
  const suppliedOrigin=request.headers.get('origin');
  if(suppliedOrigin&&suppliedOrigin!==origin)throw new PaymentError('This request could not be accepted.',403);
  if(!request.headers.get('content-type')?.includes('application/json'))throw new PaymentError('Expected a JSON request.');
  const raw=await request.text();if(raw.length>8192)throw new PaymentError('Request is too large.',413);
  try { const data=JSON.parse(raw);if(data&&typeof data==='object'&&!Array.isArray(data))return data; } catch {}
  throw new PaymentError('Invalid request.');
}
export function requiredString(data:Record<string,unknown>,name:string):string {
  const value=data[name];if(typeof value!=='string'||!value.trim()||value.length>2048)throw new PaymentError('Invalid '+name+'.');
  return value;
}
export function redirectTo(url:string):Response {
  return new Response(null,{status:303,headers:{Location:url,'Cache-Control':'no-store'}});
}
