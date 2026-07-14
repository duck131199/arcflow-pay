const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
      'access-control-allow-methods': 'POST, OPTIONS'
    }
  });
}
function isWallet(v: unknown) { return typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v.trim()); }
function wallet(v: unknown) { return String(v || '').trim().toLowerCase(); }
function normalizeName(v: unknown) { return String(v || '').trim().replace(/^@/, '').toLowerCase(); }
function isName(v: unknown) { return /^[a-z0-9_]{3,24}$/.test(normalizeName(v)); }
function isUuid(v: unknown) { return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v); }
function cleanMemo(v: unknown) { return String(v || '').trim().slice(0, 99); }
function validAmount(v: unknown) { const raw = String(v || '').trim(); if (!/^\d+(\.\d+)?$/.test(raw)) return false; const n = Number(raw); return Number.isFinite(n) && n >= 1 && n <= 50000; }
function validExpiry(v: unknown) { return ['6h', '12h', '24h', '3d', '7d'].includes(String(v || '')); }
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
function expiryDate(expiry: string) {
  const d = new Date();
  if (expiry === '6h') d.setHours(d.getHours() + 6);
  else if (expiry === '12h') d.setHours(d.getHours() + 12);
  else if (expiry === '24h') d.setHours(d.getHours() + 24);
  else if (expiry === '3d') d.setDate(d.getDate() + 3);
  else d.setDate(d.getDate() + 7);
  return d.toISOString();
}
function invoiceNo() { return 'AF-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 8).toUpperCase(); }

async function getUserByWallet(w: string) {
  const rows = await supabase(`arcflow_users?wallet_address=eq.${encodeURIComponent(w)}&select=id,username,display_name,wallet_address,created_at,updated_at&limit=1`);
  return rows[0] || null;
}
async function getUserByName(name: string) {
  const rows = await supabase(`arcflow_users?username=eq.${encodeURIComponent(name)}&select=id,username,display_name,wallet_address,created_at,updated_at&limit=1`);
  return rows[0] || null;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return json({ ok: true });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: 'Function is not configured' }, 500);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');

    if (action === 'current-user') {
      if (!isWallet(body.wallet_address)) return json({ error: 'wallet_address is required' }, 400);
      return json({ ok: true, user: await getUserByWallet(wallet(body.wallet_address)) });
    }
    if (action === 'find-user-by-name') {
      if (!isName(body.username)) return json({ error: 'valid username is required' }, 400);
      return json({ ok: true, user: await getUserByName(normalizeName(body.username)) });
    }
    if (action === 'find-user-by-wallet') {
      if (!isWallet(body.wallet_address)) return json({ error: 'wallet_address is required' }, 400);
      return json({ ok: true, user: await getUserByWallet(wallet(body.wallet_address)) });
    }
    if (action === 'register-name') {
      if (!isWallet(body.wallet_address) || !isName(body.username)) return json({ error: 'valid wallet_address and username are required' }, 400);
      const w = wallet(body.wallet_address);
      const username = normalizeName(body.username);
      const existingWallet = await getUserByWallet(w);
      if (existingWallet) return json({ ok: true, user: existingWallet, already_registered: true });
      const existingName = await getUserByName(username);
      if (existingName) return json({ error: 'Arqis name is already taken' }, 409);
      const display = String(body.display_name || username).trim().replace(/^@/, '').slice(0, 24) || username;
      const rows = await supabase('arcflow_users?select=id,username,display_name,wallet_address,created_at,updated_at', {
        method: 'POST',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify({ username, display_name: display, wallet_address: w })
      });
      return json({ ok: true, user: rows[0] });
    }
    if (action === 'create-invoice') {
      if (!isWallet(body.wallet_address) || !isName(body.to_username) || !validAmount(body.amount) || !validExpiry(body.expiry)) return json({ error: 'valid invoice fields are required' }, 400);
      const sender = await getUserByWallet(wallet(body.wallet_address));
      if (!sender) return json({ error: 'Sender wallet is not registered' }, 403);
      const recipient = await getUserByName(normalizeName(body.to_username));
      if (!recipient) return json({ error: 'Payer is not registered' }, 404);
      if (recipient.username === sender.username || wallet(recipient.wallet_address) === wallet(sender.wallet_address)) return json({ error: 'Cannot create an invoice to yourself' }, 400);
      const memo = cleanMemo(body.memo);
      if (!memo) return json({ error: 'Memo is required' }, 400);
      const row = {
        invoice_no: invoiceNo(),
        from_username: sender.username,
        from_wallet: sender.wallet_address,
        to_username: recipient.username,
        to_wallet: recipient.wallet_address,
        amount: Number(String(body.amount)),
        token: 'USDC',
        memo,
        expiry: String(body.expiry),
        status: 'unpaid',
        expires_at: expiryDate(String(body.expiry))
      };
      const rows = await supabase('arcflow_invoices?select=*', {
        method: 'POST',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify(row)
      });
      return json({ ok: true, invoice: rows[0] });
    }
    if (action === 'list-created') {
      if (!isWallet(body.wallet_address)) return json({ error: 'wallet_address is required' }, 400);
      const user = await getUserByWallet(wallet(body.wallet_address));
      if (!user) return json({ ok: true, invoices: [] });
      const rows = await supabase(`arcflow_invoices?from_username=eq.${encodeURIComponent(user.username)}&select=*&order=created_at.desc&limit=200`);
      return json({ ok: true, invoices: rows });
    }
    if (action === 'list-inbox') {
      if (!isWallet(body.wallet_address)) return json({ error: 'wallet_address is required' }, 400);
      const user = await getUserByWallet(wallet(body.wallet_address));
      if (!user) return json({ ok: true, invoices: [] });
      const rows = await supabase(`arcflow_invoices?to_username=eq.${encodeURIComponent(user.username)}&select=*&order=created_at.desc&limit=200`);
      return json({ ok: true, invoices: rows });
    }
    if (action === 'get-invoice') {
      if (!isUuid(body.invoice_id)) return json({ error: 'valid invoice_id is required' }, 400);
      const rows = await supabase(`arcflow_invoices?id=eq.${encodeURIComponent(String(body.invoice_id))}&select=*&limit=1`);
      return json({ ok: true, invoice: rows[0] || null });
    }
    if (action === 'invoices-by-tx-hashes') {
      const hashes = Array.isArray(body.tx_hashes) ? body.tx_hashes.filter((v) => typeof v === 'string' && /^0x[0-9a-fA-F]{64}$/.test(v)).slice(0, 50) : [];
      if (!hashes.length) return json({ ok: true, invoices: [] });
      const rows = await supabase(`arcflow_invoices?tx_hash=in.(${hashes.map((h) => encodeURIComponent(h)).join(',')})&select=*`);
      return json({ ok: true, invoices: rows });
    }
    if (action === 'mark-submitted') {
      if (!isUuid(body.invoice_id) || typeof body.tx_hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(body.tx_hash)) return json({ error: 'valid invoice_id and tx_hash are required' }, 400);
      const invoiceId = String(body.invoice_id);
      const txHash = String(body.tx_hash);
      const existingTx = await supabase(`arcflow_invoices?tx_hash=eq.${encodeURIComponent(txHash)}&select=id,status&limit=1`);
      if (existingTx.length && existingTx[0].id !== invoiceId) return json({ error: 'Transaction hash already used', failure_reason: 'duplicate_tx_hash' }, 409);
      const invoiceRows = await supabase(`arcflow_invoices?id=eq.${encodeURIComponent(invoiceId)}&select=id,status,expires_at&limit=1`);
      const invoice = invoiceRows[0];
      if (!invoice) return json({ error: 'Invoice not found' }, 404);
      if (!['unpaid', 'pending'].includes(String(invoice.status || '').toLowerCase())) return json({ error: `Invoice is ${invoice.status || 'not payable'}` }, 409);
      if (invoice.expires_at && new Date(invoice.expires_at).getTime() < Date.now()) return json({ error: 'Invoice expired', failure_reason: 'invoice_expired' }, 409);
      await supabase(`arcflow_invoices?id=eq.${encodeURIComponent(invoiceId)}&status=in.(unpaid,pending)`, {
        method: 'PATCH',
        headers: { prefer: 'return=minimal' },
        body: JSON.stringify({
          status: 'pending',
          tx_hash: txHash,
          payment_method: 'standard_arc_usdc',
          payment_status: 'verifying',
          receipt_version: '1.1',
          settlement_chain: 'arc-testnet',
          source_chains: ['arc-testnet'],
          verification_checks: { submitted: true, backend_verifying: true }
        })
      });
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: 'Arqis app request failed' }, 500);
  }
});
