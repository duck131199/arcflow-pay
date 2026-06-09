// Supabase Edge Function: verify-invoice-payment
// Deploy with Supabase CLI after setting SUPABASE_SERVICE_ROLE_KEY in function secrets.
// This keeps browser clients from being the source of truth for paid invoices.

const ARC_RPC_URL = Deno.env.get('ARC_RPC_URL') || 'https://rpc.testnet.arc.network';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const USDC_TOKEN = '0x3600000000000000000000000000000000000000'.toLowerCase();
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type'
    }
  });
}
function isHash(v) { return typeof v === 'string' && /^0x[0-9a-fA-F]{64}$/.test(v); }
function padAddress(addr) { return String(addr || '').toLowerCase().replace(/^0x/, '').padStart(64, '0'); }
function amountToUnits(value, decimals = 6) {
  const [whole, frac = ''] = String(value || '0').split('.');
  return BigInt((whole || '0') + frac.slice(0, decimals).padEnd(decimals, '0'));
}
async function rpc(method, params) {
  const r = await fetch(ARC_RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params })
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || 'RPC error');
  return j.result;
}
async function supabase(path, init = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      ...(init.headers || {})
    }
  });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : await r.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: 'Function is not configured' }, 500);

  const { invoice_id, tx_hash } = await req.json().catch(() => ({}));
  if (!invoice_id || !isHash(tx_hash)) return json({ error: 'invoice_id and valid tx_hash are required' }, 400);

  const existing = await supabase(`arcflow_invoices?tx_hash=eq.${encodeURIComponent(tx_hash)}&select=id`);
  if (existing.length && existing[0].id !== invoice_id) return json({ error: 'Transaction hash already used' }, 409);

  const rows = await supabase(`arcflow_invoices?id=eq.${encodeURIComponent(invoice_id)}&select=*`);
  const invoice = rows[0];
  if (!invoice) return json({ error: 'Invoice not found' }, 404);
  if (invoice.status === 'paid') return json({ status: 'paid', invoice_id });
  if (!['unpaid', 'pending'].includes(invoice.status)) return json({ error: `Invoice is ${invoice.status}` }, 409);
  if (invoice.expires_at && new Date(invoice.expires_at).getTime() < Date.now()) return json({ error: 'Invoice expired' }, 409);

  const receipt = await rpc('eth_getTransactionReceipt', [tx_hash]);
  if (!receipt) return json({ status: 'pending', invoice_id }, 202);
  if (receipt.status !== '0x1') return json({ error: 'Transaction failed' }, 409);

  const expectedRecipientTopic = '0x' + padAddress(invoice.from_wallet);
  const expectedAmount = amountToUnits(invoice.amount, 6);
  const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
  const matched = logs.some((log) => {
    const topics = log.topics || [];
    if (String(log.address || '').toLowerCase() !== USDC_TOKEN) return false;
    if (String(topics[0] || '').toLowerCase() !== TRANSFER_TOPIC) return false;
    if (String(topics[2] || '').toLowerCase() !== expectedRecipientTopic) return false;
    try { return BigInt(log.data || '0x0') >= expectedAmount; } catch (_) { return false; }
  });
  if (!matched) return json({ error: 'No matching USDC transfer for invoice' }, 409);

  const patch = { status: 'paid', tx_hash, paid_at: new Date().toISOString() };
  await supabase(`arcflow_invoices?id=eq.${encodeURIComponent(invoice_id)}&status=in.(unpaid,pending)`, {
    method: 'PATCH',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify(patch)
  });
  return json({ status: 'paid', invoice_id, tx_hash });
});
