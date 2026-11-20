export async function paymentJson<T>(response:Response):Promise<T> {
  let data;
  try { data=await response.json(); } catch { throw new Error('The request could not be completed. Please try again.'); }
  if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'The request could not be completed.');
  return data as T;
}
