// Supabase Edge Function: telegram-payment-alert
// Mirrors local Arqis payment Telegram flow: payer receipt + seller payment received.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const TOKEN_KEY = Deno.env.get('TELEGRAM_TOKEN_ENCRYPTION_KEY') || '';

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' } });
}
function isUuid(v: unknown) { return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim()); }
function getInvoiceId(body: Record<string, unknown>) { return String(body.invoice_id || body.invoiceId || (body.invoice && typeof body.invoice === 'object' ? (body.invoice as Record<string, unknown>).id : '') || '').trim(); }
function getTxHash(body: Record<string, unknown>) { return String(body.tx_hash || body.txHash || '').trim(); }
function isHash(v: unknown) { return typeof v === 'string' && /^0x[0-9a-fA-F]{64}$/.test(v); }
function bytesFromB64(v: string) { return Uint8Array.from(atob(v), c => c.charCodeAt(0)); }
async function shaKey(secret: string) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)); return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['decrypt']); }
async function decryptToken(cipherText: string) { if (TOKEN_KEY.length < 24) throw new Error('TELEGRAM_TOKEN_ENCRYPTION_KEY is not configured'); const [ivB64, dataB64] = String(cipherText || '').split(':'); if (!ivB64 || !dataB64) throw new Error('Stored bot token is invalid'); const key = await shaKey(TOKEN_KEY); const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytesFromB64(ivB64) }, key, bytesFromB64(dataB64)); return new TextDecoder().decode(plain); }
async function telegram(token: string, method: string, body: Record<string, unknown> = {}) { const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const data = await res.json().catch(() => ({})); if (!res.ok || data.ok === false) throw new Error(data.description || `Telegram ${method} failed`); return data.result; }
async function supabase(path: string, init: RequestInit = {}) { const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'content-type': 'application/json', ...(init.headers || {}) } }); const text = await r.text(); if (!r.ok) throw new Error(text); return text ? JSON.parse(text) : null; }
function clean(value: unknown, fallback = '-') { return String(value ?? fallback).replace(/[<>]/g, '').slice(0, 180); }
function shortAddr(addr: unknown) { const s = String(addr || ''); return s.length > 12 ? `${s.slice(0, 6)}...${s.slice(-4)}` : s; }
function fmtDate(v: unknown) { const d = new Date(String(v || '')); return Number.isFinite(d.getTime()) ? d.toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '-'; }
async function claimDelivery(row: Record<string, unknown>) {
  try {
    const rows = await supabase('telegram_alert_deliveries?select=id', { method: 'POST', headers: { prefer: 'return=representation' }, body: JSON.stringify({ ...row, status: 'sending' }) });
    return rows && rows[0] && rows[0].id;
  } catch (error) {
    const msg = String(error && error.message || error || '');
    if (msg.includes('telegram_alert_deliveries_payment_idempotency_idx') || msg.includes('duplicate key value')) return null;
    throw error;
  }
}
async function recordDelivery(row: Record<string, unknown>) { await supabase('telegram_alert_deliveries', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify(row) }); }
async function patchDelivery(id: string, patch: Record<string, unknown>) { await supabase(`telegram_alert_deliveries?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify(patch) }); }
async function botFor(username: unknown) { const key = String(username || '').replace(/^@/, '').toLowerCase(); if (!key) return null; const rows = await supabase(`seller_telegram_bots?arqis_username=eq.${encodeURIComponent(key)}&disconnected_at=is.null&tested_at=not.is.null&select=*&limit=1`); return rows[0] || null; }
async function sendToUser(params: { invoiceId: string; sellerUsername: string; recipientUsername: string; alertType: string; txHash: string; text: string; }) {
  const deliveryId = await claimDelivery({ invoice_id: params.invoiceId, seller_username: params.sellerUsername, recipient_username: params.recipientUsername, alert_type: params.alertType, tx_hash: params.txHash });
  if (!deliveryId) return { ok: true, skipped: true, reason: 'alert already claimed or sent', alert_type: params.alertType };
  try {
    const bot = await botFor(params.recipientUsername);
    if (!bot || !bot.chat_id) {
      await patchDelivery(deliveryId, { status: 'skipped', error: params.recipientUsername + ' has no tested Telegram bot' });
      return { ok: true, skipped: true, reason: params.recipientUsername + ' has no tested Telegram bot', alert_type: params.alertType };
    }
    const token = await decryptToken(bot.bot_token_cipher);
    await telegram(token, 'sendMessage', { chat_id: bot.chat_id, text: params.text, disable_web_page_preview: true });
    await patchDelivery(deliveryId, { telegram_bot_username: bot.bot_username, telegram_chat_id: bot.chat_id, status: 'sent', sent_at: new Date().toISOString() });
    return { ok: true, sent: true, recipient: params.recipientUsername, bot_username: bot.bot_username, alert_type: params.alertType };
  } catch (error) {
    await patchDelivery(deliveryId, { status: 'failed', error: String(error && error.message || error || 'Telegram send failed').slice(0, 500) });
    throw error;
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return json({ ok: true });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: 'Function is not configured' }, 500);
    const body = await req.json().catch(() => ({}));
    const invoice_id = getInvoiceId(body);
    const tx_hash = getTxHash(body);
    if (!isUuid(invoice_id) || !isHash(tx_hash)) return json({ error: 'valid invoice_id and tx_hash are required' }, 400);
    const invoices = await supabase(`arcflow_invoices?id=eq.${encodeURIComponent(invoice_id)}&select=*`);
    const invoice = invoices[0];
    if (!invoice) return json({ error: 'Invoice not found' }, 404);
    if (invoice.status !== 'paid') return json({ error: 'Invoice is not paid yet' }, 409);
    if (String(invoice.tx_hash || '').toLowerCase() !== String(tx_hash).toLowerCase()) return json({ error: 'Transaction hash does not match invoice' }, 409);
    const amountLine = `${clean(invoice.amount, '0.00')} ${clean(invoice.token, 'USDC')} · ${clean(invoice.invoice_no, 'INV')}`;
    const sellerUsername = clean(invoice.from_username, 'seller');
    const payerUsername = clean(invoice.to_username, 'payer');
    const shortTx = shortAddr(tx_hash);
    const paidAt = fmtDate(invoice.paid_at || new Date().toISOString());
    const payerText = ['✅ Invoice paid', '', amountLine, `Paid to: @${sellerUsername}`, `Memo: ${clean(invoice.memo, '-')}`, '', `Paid at: ${paidAt}`, `Tx: ${shortTx}`, '', 'Receipt:', 'https://www.arqis.site/#tab-pay'].join('\n');
    const sellerText = ['💸 Payment received', '', amountLine, `Paid by: @${payerUsername}`, `Memo: ${clean(invoice.memo, '-')}`, '', `Paid at: ${paidAt}`, `Tx: ${shortTx}`, '', 'Open Seller Console:', 'https://www.arqis.site/#tab-console'].join('\n');
    const results = [];
    results.push(await sendToUser({ invoiceId: invoice_id, sellerUsername, recipientUsername: payerUsername, alertType: 'payer_receipt', txHash: tx_hash, text: payerText }));
    results.push(await sendToUser({ invoiceId: invoice_id, sellerUsername, recipientUsername: sellerUsername, alertType: 'payment_received', txHash: tx_hash, text: sellerText }));
    return json({ ok: true, results });
  } catch (error) {
    console.error(error);
    return json({ error: 'Telegram payment alert failed' }, 500);
  }
});
