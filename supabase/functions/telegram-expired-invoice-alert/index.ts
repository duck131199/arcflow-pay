// Supabase Edge Function: telegram-expired-invoice-alert
// Marks overdue unpaid/pending invoices as expired and sends deduped Telegram alerts.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const TOKEN_KEY = Deno.env.get('TELEGRAM_TOKEN_ENCRYPTION_KEY') || '';
const PUBLIC_APP_URL = 'https://www.arqis.site';
const MAX_ALERT_AGE_MS = 30 * 60 * 1000;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' } });
}
function isUuid(v: unknown) { return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim()); }
function getInvoiceId(body: Record<string, unknown>) { return String(body.invoice_id || body.invoiceId || (body.invoice && typeof body.invoice === 'object' ? (body.invoice as Record<string, unknown>).id : '') || '').trim(); }
function bytesFromB64(v: string) { return Uint8Array.from(atob(v), c => c.charCodeAt(0)); }
async function shaKey(secret: string) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)); return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['decrypt']); }
async function decryptToken(cipherText: string) { if (TOKEN_KEY.length < 24) throw new Error('TELEGRAM_TOKEN_ENCRYPTION_KEY is not configured'); const [ivB64, dataB64] = String(cipherText || '').split(':'); if (!ivB64 || !dataB64) throw new Error('Stored bot token is invalid'); const key = await shaKey(TOKEN_KEY); const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytesFromB64(ivB64) }, key, bytesFromB64(dataB64)); return new TextDecoder().decode(plain); }
async function telegram(token: string, method: string, body: Record<string, unknown> = {}) { const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const data = await res.json().catch(() => ({})); if (!res.ok || data.ok === false) throw new Error(data.description || `Telegram ${method} failed`); return data.result; }
async function supabase(path: string, init: RequestInit = {}) { const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'content-type': 'application/json', ...(init.headers || {}) } }); const text = await r.text(); if (!r.ok) throw new Error(text); return text ? JSON.parse(text) : null; }
function clean(value: unknown, fallback = '-') { return String(value ?? fallback).replace(/[<>]/g, '').slice(0, 180); }
function fmtDate(v: unknown) { const d = new Date(String(v || '')); return Number.isFinite(d.getTime()) ? d.toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '-'; }
async function deliveryAlreadySent(invoiceId: string, alertType: string) { const rows = await supabase(`telegram_alert_deliveries?invoice_id=eq.${encodeURIComponent(invoiceId)}&alert_type=eq.${encodeURIComponent(alertType)}&status=eq.sent&select=id&limit=1`); return rows.length > 0; }
async function recordDelivery(row: Record<string, unknown>) { await supabase('telegram_alert_deliveries', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify(row) }); }
async function botFor(username: unknown) { const key = String(username || '').replace(/^@/, '').toLowerCase(); if (!key) return null; const rows = await supabase(`seller_telegram_bots?arqis_username=eq.${encodeURIComponent(key)}&disconnected_at=is.null&tested_at=not.is.null&select=*&limit=1`); return rows[0] || null; }
async function sendToUser(params: { invoiceId: string; sellerUsername: string; recipientUsername: string; alertType: string; text: string; }) {
  if (await deliveryAlreadySent(params.invoiceId, params.alertType)) return { ok: true, skipped: true, reason: 'alert already sent', alert_type: params.alertType };
  const bot = await botFor(params.recipientUsername);
  if (!bot || !bot.chat_id) {
    await recordDelivery({ invoice_id: params.invoiceId, seller_username: params.sellerUsername, recipient_username: params.recipientUsername, alert_type: params.alertType, status: 'skipped', error: params.recipientUsername + ' has no tested Telegram bot' });
    return { ok: true, skipped: true, reason: params.recipientUsername + ' has no tested Telegram bot', alert_type: params.alertType };
  }
  const token = await decryptToken(bot.bot_token_cipher);
  await telegram(token, 'sendMessage', { chat_id: bot.chat_id, text: params.text, disable_web_page_preview: true });
  await recordDelivery({ invoice_id: params.invoiceId, seller_username: params.sellerUsername, recipient_username: params.recipientUsername, alert_type: params.alertType, telegram_bot_username: bot.bot_username, telegram_chat_id: bot.chat_id, status: 'sent', sent_at: new Date().toISOString() });
  return { ok: true, sent: true, recipient: params.recipientUsername, bot_username: bot.bot_username, alert_type: params.alertType };
}
async function expiredInvoices(invoiceId: string) {
  if (invoiceId) return await supabase(`arcflow_invoices?id=eq.${encodeURIComponent(invoiceId)}&select=*`);
  return await supabase(`arcflow_invoices?status=in.(unpaid,pending)&expires_at=lt.${encodeURIComponent(new Date().toISOString())}&select=*&order=expires_at.asc&limit=25`);
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return json({ ok: true });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: 'Function is not configured' }, 500);
    const body = await req.json().catch(() => ({}));
    const requestedInvoiceId = getInvoiceId(body);
    if (requestedInvoiceId && !isUuid(requestedInvoiceId)) return json({ error: 'valid invoice_id is required' }, 400);
    const invoices = await expiredInvoices(requestedInvoiceId);
    const results = [];
    for (const invoice of invoices) {
      const status = String(invoice.status || '').toLowerCase();
      if (!['unpaid', 'pending', 'expired'].includes(status)) {
        results.push({ invoice_id: invoice.id, skipped: true, reason: `Invoice is ${status || 'not expirable'}` });
        continue;
      }
      if (!invoice.expires_at || new Date(invoice.expires_at).getTime() >= Date.now()) {
        results.push({ invoice_id: invoice.id, skipped: true, reason: 'Invoice is not expired yet' });
        continue;
      }
      if (status !== 'expired') {
        await supabase(`arcflow_invoices?id=eq.${encodeURIComponent(invoice.id)}&status=in.(unpaid,pending)`, {
          method: 'PATCH',
          headers: { prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'expired' })
        });
      }
      const expiredAt = new Date(invoice.expires_at).getTime();
      if (Date.now() - expiredAt > MAX_ALERT_AGE_MS) {
        results.push({ invoice_id: invoice.id, skipped: true, reason: 'Invoice expired more than 30 minutes ago; marked expired without Telegram catch-up alert' });
        continue;
      }
      const amountLine = `${clean(invoice.amount, '0.00')} ${clean(invoice.token, 'USDC')} · ${clean(invoice.invoice_no, 'INV')}`;
      const sellerUsername = clean(invoice.from_username, 'seller');
      const payerUsername = clean(invoice.to_username, 'payer');
      const sellerText = ['⌛ Invoice expired', '', amountLine, `To: @${payerUsername}`, `Memo: ${clean(invoice.memo, '-')}`, '', `Expired at: ${fmtDate(invoice.expires_at)}`, 'Status: Expired', '', 'Open Seller Console:', `${PUBLIC_APP_URL}/#tab-console`].join('\n');
      const payerText = ['⌛ Invoice expired', '', amountLine, `From: @${sellerUsername}`, `Memo: ${clean(invoice.memo, '-')}`, '', `Expired at: ${fmtDate(invoice.expires_at)}`, 'Status: Expired', '', 'Open Pay Invoice:', `${PUBLIC_APP_URL}/#tab-pay`].join('\n');
      const invoiceResults = [];
      invoiceResults.push(await sendToUser({ invoiceId: invoice.id, sellerUsername, recipientUsername: sellerUsername, alertType: 'invoice_expired_seller', text: sellerText }));
      invoiceResults.push(await sendToUser({ invoiceId: invoice.id, sellerUsername, recipientUsername: payerUsername, alertType: 'invoice_expired_payer', text: payerText }));
      results.push({ invoice_id: invoice.id, results: invoiceResults });
    }
    return json({ ok: true, results });
  } catch (error) {
    console.error(error);
    return json({ error: 'Telegram expired invoice alert failed' }, 500);
  }
});
