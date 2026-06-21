// Supabase Edge Function: verify-invoice-payment
// Browser clients submit invoice_id + tx_hash; this function verifies Arc Testnet USDC transfer
// before marking the invoice paid with the Supabase service role.

const ARC_RPC_URL = Deno.env.get('ARC_RPC_URL') || 'https://rpc.testnet.arc.network';
const ARC_CHAIN_ID = (Deno.env.get('ARC_CHAIN_ID') || '0x4cef52').toLowerCase(); // 5042002
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const USDC_TOKEN = (Deno.env.get('USDC_TOKEN') || '0x3600000000000000000000000000000000000000').toLowerCase();
const USDC_DECIMALS = Number(Deno.env.get('USDC_DECIMALS') || '6');
const NATIVE_USDC_DECIMALS = Number(Deno.env.get('NATIVE_USDC_DECIMALS') || '18');
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type'
    }
  });
}
function isHash(v: unknown) { return typeof v === 'string' && /^0x[0-9a-fA-F]{64}$/.test(v); }
function isUuid(v: unknown) { return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v); }
function isAddress(v: unknown) { return typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v); }
function padAddress(addr: string) { return addr.toLowerCase().replace(/^0x/, '').padStart(64, '0'); }
function amountToUnits(value: unknown, decimals = USDC_DECIMALS) {
  const raw = String(value ?? '0').trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) throw new Error('Invalid invoice amount');
  const [whole, frac = ''] = raw.split('.');
  return BigInt((whole || '0') + frac.slice(0, decimals).padEnd(decimals, '0'));
}
async function rpc(method: string, params: unknown[]) {
  const r = await fetch(ARC_RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params })
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || 'RPC error');
  return j.result;
}
async function supabase(path: string, init: RequestInit = {}) {
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
async function sendTelegramPaymentAlert(invoiceId: string, txHash: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/telegram-payment-alert`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ invoice_id: invoiceId, tx_hash: txHash })
    });
    if (!res.ok) console.warn('Telegram payment alert failed', await res.text());
  } catch (error) {
    console.warn('Telegram payment alert unavailable', error);
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return json({ ok: true });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: 'Function is not configured' }, 500);
    if (!isAddress(USDC_TOKEN)) return json({ error: 'USDC_TOKEN is not configured' }, 500);

    const chainId = String(await rpc('eth_chainId', [])).toLowerCase();
    if (chainId !== ARC_CHAIN_ID) return json({ error: 'RPC is not Arc Testnet', chainId }, 500);

    const { invoice_id, tx_hash } = await req.json().catch(() => ({}));
    if (!isUuid(invoice_id) || !isHash(tx_hash)) return json({ error: 'valid invoice_id and tx_hash are required' }, 400);

    const existing = await supabase(`arcflow_invoices?tx_hash=eq.${encodeURIComponent(tx_hash)}&select=id`);
    if (existing.length && existing[0].id !== invoice_id) return json({ error: 'Transaction hash already used' }, 409);

    const rows = await supabase(`arcflow_invoices?id=eq.${encodeURIComponent(invoice_id)}&select=*`);
    const invoice = rows[0];
    if (!invoice) return json({ error: 'Invoice not found' }, 404);
    if (invoice.status === 'paid') {
      if (String(invoice.tx_hash || '').toLowerCase() === String(tx_hash).toLowerCase()) await sendTelegramPaymentAlert(invoice_id, tx_hash);
      return json({ status: 'paid', invoice_id, tx_hash: invoice.tx_hash || tx_hash });
    }
    if (!['unpaid', 'pending'].includes(invoice.status)) return json({ error: `Invoice is ${invoice.status}` }, 409);
    if (!isAddress(invoice.from_wallet)) return json({ error: 'Invoice recipient wallet is invalid' }, 409);
    if (invoice.token && String(invoice.token).toUpperCase() !== 'USDC') return json({ error: 'Invoice token is not USDC' }, 409);
    if (invoice.expires_at && new Date(invoice.expires_at).getTime() < Date.now()) return json({ error: 'Invoice expired' }, 409);

    const receipt = await rpc('eth_getTransactionReceipt', [tx_hash]);
    if (!receipt) return json({ status: 'pending', invoice_id }, 202);
    if (String(receipt.status).toLowerCase() !== '0x1') return json({ error: 'Transaction failed' }, 409);

    const tx = await rpc('eth_getTransactionByHash', [tx_hash]);
    const nativeExpectedAmount = amountToUnits(invoice.amount, NATIVE_USDC_DECIMALS);
    const nativeMatched = tx
      && String(tx.to || '').toLowerCase() === String(invoice.from_wallet).toLowerCase()
      && (() => { try { return BigInt(tx.value || '0x0') >= nativeExpectedAmount; } catch (_) { return false; } })();

    const expectedRecipientTopic = '0x' + padAddress(invoice.from_wallet);
    const tokenExpectedAmount = amountToUnits(invoice.amount, USDC_DECIMALS);
    const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
    const tokenMatched = logs.some((log) => {
      const topics = log.topics || [];
      if (String(log.address || '').toLowerCase() !== USDC_TOKEN) return false;
      if (String(topics[0] || '').toLowerCase() !== TRANSFER_TOPIC) return false;
      if (String(topics[2] || '').toLowerCase() !== expectedRecipientTopic) return false;
      try { return BigInt(log.data || '0x0') >= tokenExpectedAmount; } catch (_) { return false; }
    });
    if (!nativeMatched && !tokenMatched) return json({ error: 'No matching native or token USDC transfer for invoice' }, 409);

    const patch = { status: 'paid', tx_hash, paid_at: new Date().toISOString() };
    const updated = await supabase(`arcflow_invoices?id=eq.${encodeURIComponent(invoice_id)}&status=in.(unpaid,pending)&select=id`, {
      method: 'PATCH',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify(patch)
    });
    if (Array.isArray(updated) && updated.length) await sendTelegramPaymentAlert(invoice_id, tx_hash);
    return json({ status: 'paid', invoice_id, tx_hash });
  } catch (error) {
    console.error(error);
    return json({ error: 'Verification failed' }, 500);
  }
});
