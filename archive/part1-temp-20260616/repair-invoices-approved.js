const fs=require('fs');
const url='https://mvoisxrxysfherkxrrpt.supabase.co';
const key='sb_publishable_g7Hr_E_HePl5CcQF70RjGg__avh8bN8';
const candidates=JSON.parse(fs.readFileSync('invoice-repair-candidates-20260614-1454.json','utf8'));
async function patchInvoice(id,body){
  const r=await fetch(`${url}/rest/v1/arcflow_invoices?id=eq.${id}`,{
    method:'PATCH',
    headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'},
    body:JSON.stringify(body)
  });
  const text=await r.text();
  if(!r.ok) throw new Error(`${r.status} ${text}`);
  return text?JSON.parse(text):[];
}
(async()=>{
  const results=[];
  for(const c of candidates){
    const body={status:c.suggested_restore_status,tx_hash:null,paid_at:null};
    const updated=await patchInvoice(c.id,body);
    results.push({invoice_no:c.invoice_no,id:c.id,restore:c.suggested_restore_status,updated});
    console.log('repaired',c.invoice_no,'->',c.suggested_restore_status);
  }
  fs.writeFileSync('invoice-repair-applied-20260614-1508.json',JSON.stringify(results,null,2));
  console.log('done',results.length);
})().catch(e=>{console.error(e); process.exit(1)});
